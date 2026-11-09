from datetime import datetime, timedelta, timezone

import pytest

from app.core.exceptions import BusinessRuleError
from app.schemas.track import TrackPoint
from app.services.track_service import (
    TrackLimits,
    TrackService,
    simplify_track,
    summarize_track,
)

NOW = datetime(2026, 11, 8, 12, tzinfo=timezone.utc)
MOVING = 5.0


def point(minute: int, lat: float, lon: float, speed: float = 40) -> TrackPoint:
    return TrackPoint(
        time=NOW - timedelta(hours=1) + timedelta(minutes=minute),
        latitude=lat,
        longitude=lon,
        speed_kmh=speed,
    )


class FakeTrackSource:
    def __init__(self, points: list[TrackPoint] | None, total: int | None = None):
        self._points = points
        self._total = total
        self.requests: list[tuple[int, datetime, datetime, int]] = []

    async def load_track(self, vehicle_id, start, end, *, max_messages):
        self.requests.append((vehicle_id, start, end, max_messages))
        if self._points is None:
            return None
        return self._points, self._total if self._total is not None else len(self._points)


def service(source: FakeTrackSource, **limits) -> TrackService:
    return TrackService(
        source, moving_speed_kmh=MOVING, limits=TrackLimits(**limits), clock=lambda: NOW
    )


STRAIGHT = [point(i, 4.0 + i * 0.001, -74.0) for i in range(10)]


async def test_returns_a_simplified_route_with_totals_from_every_point():
    track = await service(FakeTrackSource(STRAIGHT)).get_track(
        500, NOW - timedelta(hours=2), NOW - timedelta(minutes=1)
    )

    assert track.vehicle_id == 500
    assert track.total_points == 10
    assert track.simplified is True
    assert [p.time for p in track.points] == [STRAIGHT[0].time, STRAIGHT[-1].time]
    assert track.summary.distance_km == pytest.approx(1.0, abs=0.01)
    assert track.summary.max_speed_kmh == 40
    assert track.summary.started_at == STRAIGHT[0].time


async def test_asks_wialon_for_the_range_with_the_message_limit():
    source = FakeTrackSource(STRAIGHT)
    start = NOW - timedelta(hours=3)
    await service(source, max_messages=1234).get_track(500, start, NOW - timedelta(hours=1))
    assert source.requests == [(500, start, NOW - timedelta(hours=1), 1234)]


async def test_an_end_in_the_future_is_cut_to_now():
    source = FakeTrackSource(STRAIGHT)
    track = await service(source).get_track(500, NOW - timedelta(hours=1), NOW + timedelta(days=1))
    assert track.end == NOW
    assert source.requests[0][2] == NOW


async def test_dates_without_time_zone_are_taken_as_utc():
    source = FakeTrackSource(STRAIGHT)
    await service(source).get_track(500, datetime(2026, 11, 8, 10), datetime(2026, 11, 8, 11))
    assert source.requests[0][1] == datetime(2026, 11, 8, 10, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("start", "end", "message"),
    [
        (NOW - timedelta(hours=1), NOW - timedelta(hours=1), "posterior a la inicial"),
        (NOW - timedelta(hours=1), NOW - timedelta(hours=2), "posterior a la inicial"),
        (NOW + timedelta(minutes=1), NOW + timedelta(hours=1), "en el futuro"),
        (NOW - timedelta(days=7, minutes=1), NOW, "máximo es de 7 días"),
    ],
)
async def test_rejects_ranges_that_make_no_sense_or_are_too_long(start, end, message):
    source = FakeTrackSource(STRAIGHT)
    with pytest.raises(BusinessRuleError, match=message) as error:
        await service(source).get_track(500, start, end)
    assert error.value.status_code == 422
    assert source.requests == []


async def test_exactly_the_maximum_range_is_allowed():
    await service(FakeTrackSource(STRAIGHT)).get_track(500, NOW - timedelta(days=7), NOW)


async def test_an_unknown_vehicle_is_404():
    with pytest.raises(BusinessRuleError) as error:
        await service(FakeTrackSource(None)).get_track(1, NOW - timedelta(hours=1), NOW)
    assert error.value.status_code == 404


async def test_too_many_messages_asks_for_a_shorter_range():
    source = FakeTrackSource(STRAIGHT, total=60_000)
    with pytest.raises(BusinessRuleError, match="60.000 posiciones y el máximo es 50.000"):
        await service(source).get_track(500, NOW - timedelta(hours=1), NOW)


async def test_an_empty_range_is_an_empty_route_not_an_error():
    track = await service(FakeTrackSource([])).get_track(500, NOW - timedelta(hours=1), NOW)
    assert track.points == []
    assert track.total_points == 0
    assert track.simplified is False
    assert track.summary.distance_km == 0
    assert track.summary.average_speed_kmh is None
    assert track.summary.started_at is None


def test_a_stop_in_a_straight_line_keeps_when_it_began_and_ended():
    # Drive north, park for 5 minutes on the same line, keep driving north.
    route = (
        [point(i, 4.0 + i * 0.001, -74.0) for i in range(5)]
        + [point(5 + i, 4.004, -74.0, speed=0) for i in range(5)]
        + [point(10 + i, 4.005 + i * 0.001, -74.0) for i in range(5)]
    )
    kept = simplify_track(route, moving_speed_kmh=MOVING, tolerance_m=10, max_points=100)

    stopped = [p for p in kept if p.speed_kmh == 0]
    assert [p.time for p in stopped] == [route[5].time, route[9].time]
    assert kept[0] == route[0] and kept[-1] == route[-1]
    assert len(kept) < len(route)


def test_never_returns_more_than_the_maximum_points():
    zigzag = [point(i, 4.0 + (i % 2) * 0.01, -74.0 + i * 0.01) for i in range(200)]
    kept = simplify_track(zigzag, moving_speed_kmh=MOVING, tolerance_m=10, max_points=20)
    assert len(kept) <= 20
    assert kept[0] == zigzag[0] and kept[-1] == zigzag[-1]


def test_gps_jitter_while_parked_does_not_add_distance():
    parked = [point(i, 4.0 + (i % 2) * 0.0002, -74.0, speed=0) for i in range(20)]
    summary = summarize_track(parked, moving_speed_kmh=MOVING)
    assert summary.distance_km == 0
    assert summary.average_speed_kmh is None


def test_average_speed_counts_only_while_moving():
    route = [point(0, 4.0, -74.0, 30), point(1, 4.001, -74.0, 50), point(2, 4.001, -74.0, 0)]
    assert summarize_track(route, moving_speed_kmh=MOVING).average_speed_kmh == 40

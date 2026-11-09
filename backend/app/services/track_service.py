import asyncio
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import fmean
from typing import Protocol

from app.core.exceptions import BusinessRuleError
from app.domain.track_geometry import douglas_peucker, haversine_m
from app.schemas.track import TrackPoint, TrackSummary, VehicleTrack

SIMPLIFY_ROUNDS = 6
"""How many times the tolerance doubles before falling back to evenly spaced points."""


class TrackSource(Protocol):
    async def load_track(
        self, vehicle_id: int, start: datetime, end: datetime, *, max_messages: int
    ) -> tuple[list[TrackPoint], int] | None: ...


@dataclass(frozen=True)
class TrackLimits:
    """How much history one request may ask for, so a big range cannot exhaust the server."""

    max_days: int = 7
    max_messages: int = 50_000
    """Messages read from Wialon. A busy vehicle sends about 11 000 in a week."""
    max_points: int = 2_000
    """Points sent to the browser after simplifying."""
    tolerance_m: float = 10.0
    """How far, at most, the simplified line may move away from the real one."""


def _utc(value: datetime) -> datetime:
    """A date without a time zone is taken as UTC."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _thousands(number: int) -> str:
    return f"{number:,}".replace(",", ".")


def _is_moving(point: TrackPoint, moving_speed_kmh: float) -> bool:
    # The same threshold as the vehicle status (domain/vehicle_status.py).
    return point.speed_kmh > moving_speed_kmh


def _simplify_once(
    points: Sequence[TrackPoint], moving_speed_kmh: float, tolerance_m: float
) -> list[TrackPoint]:
    # Cut the route wherever the vehicle starts or stops moving, and simplify each piece on its
    # own. Those cut points are always kept, so a stop keeps the time it began and ended and the
    # playback really pauses there, instead of crawling through it.
    cuts = {0, len(points) - 1}
    for i in range(1, len(points)):
        if _is_moving(points[i], moving_speed_kmh) != _is_moving(points[i - 1], moving_speed_kmh):
            cuts.update((i - 1, i))
    ordered = sorted(cuts)

    keep: set[int] = set(ordered)
    coordinates = [(p.latitude, p.longitude) for p in points]
    for first, last in zip(ordered, ordered[1:]):
        if last - first > 1:
            piece = douglas_peucker(coordinates[first : last + 1], tolerance_m)
            keep.update(first + i for i in piece)
    return [points[i] for i in sorted(keep)]


def _evenly_spaced(points: Sequence[TrackPoint], count: int) -> list[TrackPoint]:
    last = len(points) - 1
    indexes = sorted({round(k * last / (count - 1)) for k in range(count)})
    return [points[i] for i in indexes]


def simplify_track(
    points: Sequence[TrackPoint],
    *,
    moving_speed_kmh: float,
    tolerance_m: float,
    max_points: int,
) -> list[TrackPoint]:
    """Fewer points with the same shape (Douglas-Peucker), never more than `max_points`.

    If the line still has too many points, the tolerance doubles and it tries again; as a last
    resort (stop-and-go traffic with hundreds of stops) it keeps evenly spaced points.
    """
    if len(points) <= 2:
        return list(points)
    kept = list(points)
    tolerance = tolerance_m
    for _ in range(SIMPLIFY_ROUNDS):
        kept = _simplify_once(points, moving_speed_kmh, tolerance)
        if len(kept) <= max_points:
            return kept
        tolerance *= 2
    return _evenly_spaced(kept, max_points)


def summarize_track(points: Sequence[TrackPoint], *, moving_speed_kmh: float) -> TrackSummary:
    """Distance and speeds from every valid point (the real route, not the simplified line)."""
    distance_m = 0.0
    for previous, current in zip(points, points[1:]):
        # While parked the GPS position jitters a few meters; counting it would add distance the
        # vehicle never drove. A stretch counts if the vehicle was moving at either end.
        if _is_moving(previous, moving_speed_kmh) or _is_moving(current, moving_speed_kmh):
            distance_m += haversine_m(
                (previous.latitude, previous.longitude), (current.latitude, current.longitude)
            )
    moving_speeds = [p.speed_kmh for p in points if _is_moving(p, moving_speed_kmh)]
    return TrackSummary(
        distance_km=round(distance_m / 1000, 2),
        max_speed_kmh=max((p.speed_kmh for p in points), default=0),
        average_speed_kmh=round(fmean(moving_speeds), 1) if moving_speeds else None,
        started_at=points[0].time if points else None,
        ended_at=points[-1].time if points else None,
    )


class TrackService:
    """A vehicle's route history (RF-24): checks the range, reads Wialon, simplifies the line."""

    def __init__(
        self,
        source: TrackSource,
        *,
        moving_speed_kmh: float,
        limits: TrackLimits = TrackLimits(),
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ):
        self._source = source
        self._moving_speed_kmh = moving_speed_kmh
        self._limits = limits
        self._clock = clock

    async def get_track(self, vehicle_id: int, start: datetime, end: datetime) -> VehicleTrack:
        start, end = _utc(start), _utc(end)
        limits = self._limits
        now = self._clock()

        if end <= start:
            raise BusinessRuleError("La fecha final debe ser posterior a la inicial.")
        if start >= now:
            raise BusinessRuleError("La fecha inicial no puede estar en el futuro.")
        end = min(end, now)
        if end - start > timedelta(days=limits.max_days):
            raise BusinessRuleError(f"El rango máximo es de {limits.max_days} días. Elige uno más corto.")

        loaded = await self._source.load_track(
            vehicle_id, start, end, max_messages=limits.max_messages
        )
        if loaded is None:
            raise BusinessRuleError("El vehículo no existe.", status_code=404, title="No encontrado")
        points, total_messages = loaded
        if total_messages > limits.max_messages:
            raise BusinessRuleError(
                f"Ese rango tiene {_thousands(total_messages)} posiciones y el máximo es "
                f"{_thousands(limits.max_messages)}. Elige un rango más corto."
            )

        # Simplifying tens of thousands of points takes about a second of pure calculation. In a
        # worker thread the server keeps answering other requests meanwhile.
        kept, summary = await asyncio.to_thread(self._process, points)
        return VehicleTrack(
            vehicle_id=vehicle_id,
            start=start,
            end=end,
            total_points=len(points),
            simplified=len(kept) < len(points),
            points=kept,
            summary=summary,
        )

    def _process(self, points: list[TrackPoint]) -> tuple[list[TrackPoint], TrackSummary]:
        kept = simplify_track(
            points,
            moving_speed_kmh=self._moving_speed_kmh,
            tolerance_m=self._limits.tolerance_m,
            max_points=self._limits.max_points,
        )
        return kept, summarize_track(points, moving_speed_kmh=self._moving_speed_kmh)

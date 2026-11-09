from datetime import datetime, timedelta, timezone

import pytest

from app.integrations.wialon.exceptions import WialonError
from app.integrations.wialon.units_gateway import WialonUnitGateway
from tests.fakes import FakeWialonClient, wialon_error

START = datetime(2026, 11, 8, 10, tzinfo=timezone.utc)
END = datetime(2026, 11, 8, 11, tzinfo=timezone.utc)
T0 = int(START.timestamp())


def message(t: int, y: float | None, x: float | None, s: float | None = 40, c: int = 90) -> dict:
    return {"t": t, "f": 7, "tp": "ud", "pos": {"y": y, "x": x, "s": s, "c": c, "z": 2600, "sc": 9}}


def gateway(client: FakeWialonClient) -> WialonUnitGateway:
    return WialonUnitGateway(client, moving_speed_kmh=5, offline_after=timedelta(hours=1))


def loaded(*messages: dict, count: int | None = None) -> dict:
    return {"count": len(messages) if count is None else count, "messages": list(messages)}


async def test_asks_for_position_messages_in_the_range_and_frees_them_after():
    client = FakeWialonClient({"messages/load_interval": loaded(), "messages/unload": {}})
    await gateway(client).load_track(500, START, END, max_messages=1000)

    assert client.params_of("messages/load_interval") == [
        {
            "itemId": 500,
            "timeFrom": T0,
            "timeTo": int(END.timestamp()),
            "flags": 0x0001,
            "flagsMask": 0xFF01,
            "loadCount": 1000,
        }
    ]
    assert [svc for svc, _ in client.calls] == ["messages/load_interval", "messages/unload"]


async def test_maps_messages_to_our_points_dropping_invalid_positions_oldest_first():
    client = FakeWialonClient(
        {
            "messages/load_interval": loaded(
                message(T0 + 60, 4.66, -74.06, s=55, c=180),
                message(T0, 4.65, -74.05, s=None),
                message(T0 + 30, 0, 0),
                message(T0 + 40, None, -74.0),
                message(T0 + 50, 95, -74.0),
                {"t": T0 + 45, "f": 0, "tp": "ud", "pos": None},
            ),
            "messages/unload": {},
        }
    )
    points, total = await gateway(client).load_track(500, START, END, max_messages=1000)

    assert total == 6
    assert [(p.latitude, p.longitude, p.speed_kmh, p.heading) for p in points] == [
        (4.65, -74.05, 0, 90),
        (4.66, -74.06, 55, 180),
    ]
    assert points[0].time == START


async def test_reports_the_real_count_when_wialon_has_more_than_the_limit():
    client = FakeWialonClient(
        {"messages/load_interval": loaded(message(T0, 4.65, -74.05), count=90_000), "messages/unload": {}}
    )
    _, total = await gateway(client).load_track(500, START, END, max_messages=1)
    assert total == 90_000


@pytest.mark.parametrize("code", [4, 6, 7])
async def test_unknown_or_invisible_vehicle_is_none(code):
    client = FakeWialonClient({"messages/load_interval": wialon_error(code), "messages/unload": {}})
    assert await gateway(client).load_track(1, START, END, max_messages=10) is None
    assert client.params_of("messages/unload") == [{}]


async def test_other_errors_are_not_hidden_and_messages_are_still_freed():
    client = FakeWialonClient({"messages/load_interval": wialon_error(5), "messages/unload": {}})
    with pytest.raises(WialonError):
        await gateway(client).load_track(500, START, END, max_messages=10)
    assert client.params_of("messages/unload") == [{}]


async def test_a_failed_unload_does_not_lose_the_route():
    client = FakeWialonClient(
        {"messages/load_interval": loaded(message(T0, 4.65, -74.05)), "messages/unload": wialon_error(5)}
    )
    points, _ = await gateway(client).load_track(500, START, END, max_messages=10)
    assert len(points) == 1


async def test_holds_the_messages_lock_while_wialon_has_the_messages_loaded():
    client = FakeWialonClient({})
    held: list[bool] = []

    async def call(svc, params=None):
        held.append(client.messages_lock.locked())
        return loaded() if svc == "messages/load_interval" else {}

    client.call = call
    await gateway(client).load_track(500, START, END, max_messages=10)
    assert held == [True, True]
    assert not client.messages_lock.locked()

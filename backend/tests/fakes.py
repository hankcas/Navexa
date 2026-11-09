import asyncio
from types import SimpleNamespace
from typing import Any

from app.integrations.wialon.exceptions import WialonError
from app.schemas.driver import Driver
from app.schemas.passenger import Passenger


class Script(list):
    """Several answers for one service, given one per call. The last one repeats."""


class FakeWialonClient:
    """Stands in for WialonClient in tests: answers each service from `responses`
    and records every call, so tests can check exactly what was sent to Wialon.

    An answer that is an exception is raised instead of returned.
    """

    def __init__(self, responses: dict[str, Any]):
        self._responses = {
            svc: list(answer) if isinstance(answer, Script) else [answer]
            for svc, answer in responses.items()
        }
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.messages_lock = asyncio.Lock()

    async def call(self, svc: str, params: dict[str, Any] | None = None) -> Any:
        self.calls.append((svc, params or {}))
        if svc not in self._responses:
            raise AssertionError(f"Unexpected Wialon call: {svc}")
        queue = self._responses[svc]
        answer = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(answer, Exception):
            raise answer
        return answer

    def params_of(self, svc: str) -> list[dict[str, Any]]:
        return [params for called, params in self.calls if called == svc]


def wialon_error(code: int) -> WialonError:
    return WialonError(f"Wialon error {code}", code)


class FakeSession:
    """Stands in for the SQLAlchemy session: keeps what is added and counts commits."""

    def __init__(self):
        self.added: list[Any] = []
        self.commits = 0

    def add(self, item: Any) -> None:
        self.added.append(item)

    async def commit(self) -> None:
        self.commits += 1


class _InMemoryResourceItems:
    """Drivers or passengers kept in memory, with the same behaviour as the Wialon gateways."""

    model: Any

    def __init__(self, *items: Any):
        self.items = {item.id: item for item in items}
        self.events: list[tuple[str, str, int]] = []
        self._next_id = 100

    async def _list(self):
        return list(self.items.values())

    async def _get(self, ref):
        return self.items.get(ref.public_id)

    async def _create(self, changes):
        self._next_id += 1
        item = self.model(id=f"1-{self._next_id}", **changes.model_dump(exclude_none=True))
        self.items[item.id] = item
        return item

    async def _update(self, ref, changes):
        current = self.items.get(ref.public_id)
        if current is None:
            return None
        updated = current.model_copy(update=changes.model_dump(exclude_none=True))
        self.items[updated.id] = updated
        return updated

    async def _delete(self, ref):
        return self.items.pop(ref.public_id, None) is not None

    async def bind_to_vehicle(self, ref, vehicle_id):
        self.events.append(("bind", ref.public_id, vehicle_id))
        self.items[ref.public_id] = self.items[ref.public_id].model_copy(update={"vehicle_id": vehicle_id})

    async def unbind_from_vehicle(self, ref, vehicle_id):
        self.events.append(("unbind", ref.public_id, vehicle_id))
        self.items[ref.public_id] = self.items[ref.public_id].model_copy(update={"vehicle_id": None})


class FakeDriverGateway(_InMemoryResourceItems):
    """In-memory drivers with the same methods as WialonDriverGateway."""

    model = Driver
    list_drivers = _InMemoryResourceItems._list
    get_driver = _InMemoryResourceItems._get
    create_driver = _InMemoryResourceItems._create
    update_driver = _InMemoryResourceItems._update
    delete_driver = _InMemoryResourceItems._delete

    @property
    def drivers(self):
        return self.items


class FakePassengerGateway(_InMemoryResourceItems):
    """In-memory passengers with the same methods as WialonPassengerGateway."""

    model = Passenger
    list_passengers = _InMemoryResourceItems._list
    get_passenger = _InMemoryResourceItems._get
    create_passenger = _InMemoryResourceItems._create
    update_passenger = _InMemoryResourceItems._update
    delete_passenger = _InMemoryResourceItems._delete

    @property
    def passengers(self):
        return self.items


class FakeVehicles:
    """Only knows which vehicle IDs exist."""

    def __init__(self, *vehicle_ids: int):
        self._ids = vehicle_ids

    async def list_vehicles(self):
        return [SimpleNamespace(id=vehicle_id) for vehicle_id in self._ids]

from types import SimpleNamespace
from typing import Any

from app.integrations.wialon.exceptions import WialonError
from app.schemas.driver import Driver


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


class FakeDriverGateway:
    """In-memory drivers with the same methods as WialonDriverGateway."""

    def __init__(self, *drivers: Any):
        self.drivers = {d.id: d for d in drivers}
        self.events: list[tuple[str, str, int]] = []
        self._next_id = 100

    async def list_drivers(self):
        return list(self.drivers.values())

    async def get_driver(self, ref):
        return self.drivers.get(ref.public_id)

    async def create_driver(self, changes):
        self._next_id += 1
        driver = Driver(id=f"1-{self._next_id}", **changes.model_dump(exclude_none=True))
        self.drivers[driver.id] = driver
        return driver

    async def update_driver(self, ref, changes):
        current = self.drivers.get(ref.public_id)
        if current is None:
            return None
        updated = current.model_copy(update=changes.model_dump(exclude_none=True))
        self.drivers[updated.id] = updated
        return updated

    async def delete_driver(self, ref):
        return self.drivers.pop(ref.public_id, None) is not None

    async def bind_to_vehicle(self, ref, vehicle_id):
        self.events.append(("bind", ref.public_id, vehicle_id))
        self.drivers[ref.public_id] = self.drivers[ref.public_id].model_copy(update={"vehicle_id": vehicle_id})

    async def unbind_from_vehicle(self, ref, vehicle_id):
        self.events.append(("unbind", ref.public_id, vehicle_id))
        self.drivers[ref.public_id] = self.drivers[ref.public_id].model_copy(update={"vehicle_id": None})


class FakeVehicles:
    """Only knows which vehicle IDs exist."""

    def __init__(self, *vehicle_ids: int):
        self._ids = vehicle_ids

    async def list_vehicles(self):
        return [SimpleNamespace(id=vehicle_id) for vehicle_id in self._ids]

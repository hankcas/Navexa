import math
from typing import Protocol

from app.domain.vehicle_status import VehicleStatus
from app.schemas.pagination import Page
from app.schemas.vehicle import Vehicle


class VehicleProvider(Protocol):
    async def list_vehicles(self) -> list[Vehicle]: ...


class VehicleService:
    def __init__(self, provider: VehicleProvider):
        self._provider = provider

    async def list_vehicles(
        self,
        *,
        search: str | None = None,
        status: VehicleStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Page[Vehicle]:
        vehicles = await self._provider.list_vehicles()

        if search:
            term = search.strip().lower()
            vehicles = [v for v in vehicles if term in v.name.lower()]

        if status:
            vehicles = [v for v in vehicles if v.status == status]

        total = len(vehicles)
        start = (page - 1) * page_size
        return Page[Vehicle](
            items=vehicles[start : start + page_size],
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )
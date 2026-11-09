import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.domain.vehicle_status import VehicleStatus
from app.services.audit_service import AuditService
from app.services.csv_export import COLOMBIA, drivers_csv, passengers_csv, vehicles_csv
from app.services.driver_service import DriverService
from app.services.passenger_service import PassengerService
from app.services.vehicle_service import VehicleService

MAX_ROWS = 10_000
"""Far above the demo fleet (62 vehicles); keeps one download from growing without limit."""


@dataclass(frozen=True)
class CsvFile:
    filename: str
    content: str
    rows: int


def _filename(prefix: str, now: datetime) -> str:
    return f"{prefix}-{now.astimezone(COLOMBIA):%Y-%m-%d}.csv"


def _filters(**values: Any) -> dict[str, Any]:
    """Only the filters the user actually applied, for the audit log."""
    return {name: value for name, value in values.items() if value not in (None, "")}


class ExportService:
    """CSV downloads (RF-25). Reuses the list services, so a file has exactly the rows the
    user sees on screen with the same filters, and records every download in the audit log:
    exporting data is a sensitive action (who took a copy of the fleet, and when)."""

    def __init__(
        self,
        vehicles: VehicleService,
        drivers: DriverService,
        passengers: PassengerService,
        session: AsyncSession,
    ):
        self._vehicles = vehicles
        self._drivers = drivers
        self._passengers = passengers
        self._session = session
        self._audit = AuditService(session)

    async def vehicles(
        self, actor: User, *, search: str | None, status: VehicleStatus | None, ip: str | None
    ) -> CsvFile:
        page = await self._vehicles.list_vehicles(search=search, status=status, page_size=MAX_ROWS)
        content = vehicles_csv(page.items)
        return await self._done(
            "vehicles", "vehiculos", content, len(page.items), actor, ip,
            _filters(search=search, status=status.value if status else None),
        )

    async def drivers(
        self, actor: User, *, search: str | None, assigned: bool | None, ip: str | None
    ) -> CsvFile:
        page, names = await asyncio.gather(
            self._drivers.list_drivers(search=search, assigned=assigned, page_size=MAX_ROWS),
            self._vehicle_names(),
        )
        content = drivers_csv(page.items, names)
        return await self._done(
            "drivers", "conductores", content, len(page.items), actor, ip,
            _filters(search=search, assigned=assigned),
        )

    async def passengers(
        self, actor: User, *, search: str | None, assigned: bool | None, ip: str | None
    ) -> CsvFile:
        page, names = await asyncio.gather(
            self._passengers.list_passengers(search=search, assigned=assigned, page_size=MAX_ROWS),
            self._vehicle_names(),
        )
        content = passengers_csv(page.items, names)
        return await self._done(
            "passengers", "pasajeros", content, len(page.items), actor, ip,
            _filters(search=search, assigned=assigned),
        )

    async def _vehicle_names(self) -> dict[int, str]:
        page = await self._vehicles.list_vehicles(page_size=MAX_ROWS)
        return {vehicle.id: vehicle.name for vehicle in page.items}

    async def _done(
        self,
        entity: str,
        prefix: str,
        content: str,
        rows: int,
        actor: User,
        ip: str | None,
        filters: dict[str, Any],
    ) -> CsvFile:
        self._audit.record(
            f"{entity}.exported",
            actor=actor,
            entity_type=entity.removesuffix("s"),
            details={"rows": rows, "filters": filters},
            ip_address=ip,
        )
        await self._session.commit()
        return CsvFile(_filename(prefix, datetime.now(timezone.utc)), content, rows)

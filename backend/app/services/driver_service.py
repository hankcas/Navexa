import math
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError
from app.db.models import User
from app.domain.resource_item_ref import ResourceItemRef
from app.schemas.driver import Driver, DriverChanges, DriverCreate, DriverUpdate
from app.schemas.pagination import Page
from app.services.audit_service import AuditService
from app.services.vehicle_service import VehicleProvider


class DriverProvider(Protocol):
    """What the service needs from wherever drivers are stored (Wialon today)."""

    async def list_drivers(self) -> list[Driver]: ...
    async def get_driver(self, ref: ResourceItemRef) -> Driver | None: ...
    async def create_driver(self, changes: DriverChanges) -> Driver: ...
    async def update_driver(self, ref: ResourceItemRef, changes: DriverChanges) -> Driver | None: ...
    async def delete_driver(self, ref: ResourceItemRef) -> bool: ...
    async def bind_to_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None: ...
    async def unbind_from_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None: ...


def _not_found(what: str) -> BusinessRuleError:
    return BusinessRuleError(f"{what} no existe.", status_code=404, title="No encontrado")


def _conflict(message: str) -> BusinessRuleError:
    return BusinessRuleError(message, status_code=409, title="Conflicto")


class DriverService:
    """Driver use cases: validation, duplicate checks and audit around the provider."""

    def __init__(
        self,
        drivers: DriverProvider,
        vehicles: VehicleProvider,
        session: AsyncSession,
    ):
        self._drivers = drivers
        self._vehicles = vehicles
        self._session = session
        self._audit = AuditService(session)

    async def list_drivers(
        self,
        *,
        search: str | None = None,
        assigned: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Page[Driver]:
        drivers = sorted(await self._drivers.list_drivers(), key=lambda d: d.name.lower())

        if search:
            term = search.strip().lower()
            drivers = [
                d for d in drivers
                if any(term in (value or "").lower() for value in (d.name, d.code, d.phone))
            ]
        if assigned is not None:
            drivers = [d for d in drivers if (d.vehicle_id is not None) == assigned]

        total = len(drivers)
        start = (page - 1) * page_size
        return Page[Driver](
            items=drivers[start : start + page_size],
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )

    async def get_driver(self, public_id: str) -> Driver:
        driver = await self._drivers.get_driver(self._ref(public_id))
        if driver is None:
            raise _not_found("El conductor")
        return driver

    async def create_driver(self, actor: User, data: DriverCreate, ip: str | None) -> Driver:
        changes = data.to_changes()
        await self._check_duplicates(changes, exclude_id=None)
        driver = await self._drivers.create_driver(changes)
        await self._record("drivers.created", actor, driver.id, {"name": driver.name}, ip)
        return driver

    async def update_driver(
        self, actor: User, public_id: str, data: DriverUpdate, ip: str | None
    ) -> Driver:
        ref = self._ref(public_id)
        changes = data.to_changes()
        await self._check_duplicates(changes, exclude_id=public_id)
        driver = await self._drivers.update_driver(ref, changes)
        if driver is None:
            raise _not_found("El conductor")
        # Which fields changed, not their values: phones and IDs stay out of the audit log.
        fields = sorted(changes.model_dump(exclude_unset=True).keys())
        await self._record("drivers.updated", actor, driver.id, {"fields": fields}, ip)
        return driver

    async def delete_driver(self, actor: User, public_id: str, ip: str | None) -> None:
        driver = await self.get_driver(public_id)
        ref = self._ref(public_id)
        if driver.vehicle_id is not None:
            await self._drivers.unbind_from_vehicle(ref, driver.vehicle_id)
        if not await self._drivers.delete_driver(ref):
            raise _not_found("El conductor")
        await self._record("drivers.deleted", actor, driver.id, {"name": driver.name}, ip)

    async def assign_vehicle(
        self, actor: User, public_id: str, vehicle_id: int, ip: str | None
    ) -> Driver:
        driver = await self.get_driver(public_id)
        ref = self._ref(public_id)
        if driver.vehicle_id == vehicle_id:
            raise _conflict("El conductor ya está asignado a ese vehículo.")
        if not any(v.id == vehicle_id for v in await self._vehicles.list_vehicles()):
            raise _not_found("El vehículo")

        # A driver drives one vehicle at a time: leave the previous one first.
        if driver.vehicle_id is not None:
            await self._drivers.unbind_from_vehicle(ref, driver.vehicle_id)
        await self._drivers.bind_to_vehicle(ref, vehicle_id)
        await self._record(
            "drivers.vehicle_assigned",
            actor,
            driver.id,
            {"vehicle_id": vehicle_id, "previous_vehicle_id": driver.vehicle_id},
            ip,
        )
        return await self.get_driver(public_id)

    async def unassign_vehicle(self, actor: User, public_id: str, ip: str | None) -> Driver:
        driver = await self.get_driver(public_id)
        if driver.vehicle_id is None:
            raise _conflict("El conductor no tiene un vehículo asignado.")
        await self._drivers.unbind_from_vehicle(self._ref(public_id), driver.vehicle_id)
        await self._record(
            "drivers.vehicle_unassigned", actor, driver.id, {"vehicle_id": driver.vehicle_id}, ip
        )
        return await self.get_driver(public_id)

    async def _check_duplicates(self, changes: DriverChanges, *, exclude_id: str | None) -> None:
        """Clear messages for duplicates before Wialon rejects them (RF-18)."""
        if not changes.code and not changes.phone:
            return
        others = [d for d in await self._drivers.list_drivers() if d.id != exclude_id]
        if changes.code and any((d.code or "").lower() == changes.code.lower() for d in others):
            raise _conflict("Ya existe otro conductor con ese código.")
        if changes.phone and any(d.phone == changes.phone for d in others):
            raise _conflict("Ya existe otro conductor con ese teléfono.")

    async def _record(
        self, action: str, actor: User, driver_id: str, details: dict, ip: str | None
    ) -> None:
        self._audit.record(
            action,
            actor=actor,
            entity_type="driver",
            entity_id=driver_id,
            details=details,
            ip_address=ip,
        )
        await self._session.commit()

    @staticmethod
    def _ref(public_id: str) -> ResourceItemRef:
        ref = ResourceItemRef.parse(public_id)
        if ref is None:
            raise _not_found("El conductor")
        return ref

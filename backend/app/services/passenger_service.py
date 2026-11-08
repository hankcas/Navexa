import math
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError
from app.db.models import User
from app.domain.resource_item_ref import ResourceItemRef
from app.schemas.pagination import Page
from app.schemas.passenger import Passenger, PassengerChanges, PassengerCreate, PassengerUpdate
from app.services.audit_service import AuditService
from app.services.vehicle_service import VehicleProvider


class PassengerProvider(Protocol):
    """What the service needs from wherever passengers are stored (Wialon tags today)."""

    async def list_passengers(self) -> list[Passenger]: ...
    async def get_passenger(self, ref: ResourceItemRef) -> Passenger | None: ...
    async def create_passenger(self, changes: PassengerChanges) -> Passenger: ...
    async def update_passenger(
        self, ref: ResourceItemRef, changes: PassengerChanges
    ) -> Passenger | None: ...
    async def delete_passenger(self, ref: ResourceItemRef) -> bool: ...
    async def bind_to_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None: ...
    async def unbind_from_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None: ...


def _not_found(what: str) -> BusinessRuleError:
    return BusinessRuleError(f"{what} no existe.", status_code=404, title="No encontrado")


def _conflict(message: str) -> BusinessRuleError:
    return BusinessRuleError(message, status_code=409, title="Conflicto")


class PassengerService:
    """Passenger use cases (RF-08, RF-09, RF-27, RF-28): validation, duplicates and audit."""

    def __init__(
        self,
        passengers: PassengerProvider,
        vehicles: VehicleProvider,
        session: AsyncSession,
    ):
        self._passengers = passengers
        self._vehicles = vehicles
        self._session = session
        self._audit = AuditService(session)

    async def list_passengers(
        self,
        *,
        search: str | None = None,
        assigned: bool | None = None,
        vehicle_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Page[Passenger]:
        passengers = sorted(await self._passengers.list_passengers(), key=lambda p: p.name.lower())

        if search:
            term = search.strip().lower()
            passengers = [p for p in passengers if self._matches(p, term)]
        if assigned is not None:
            passengers = [p for p in passengers if (p.vehicle_id is not None) == assigned]
        if vehicle_id is not None:
            passengers = [p for p in passengers if p.vehicle_id == vehicle_id]

        total = len(passengers)
        start = (page - 1) * page_size
        return Page[Passenger](
            items=passengers[start : start + page_size],
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )

    async def get_passenger(self, public_id: str) -> Passenger:
        passenger = await self._passengers.get_passenger(self._ref(public_id))
        if passenger is None:
            raise _not_found("El pasajero")
        return passenger

    async def create_passenger(
        self, actor: User, data: PassengerCreate, ip: str | None
    ) -> Passenger:
        changes = data.to_changes()
        await self._check_duplicate_code(changes.code, exclude_id=None)
        passenger = await self._passengers.create_passenger(changes)
        await self._record("passengers.created", actor, passenger.id, {"name": passenger.name}, ip)
        return passenger

    async def update_passenger(
        self, actor: User, public_id: str, data: PassengerUpdate, ip: str | None
    ) -> Passenger:
        ref = self._ref(public_id)
        changes = data.to_changes()
        await self._check_duplicate_code(changes.code, exclude_id=public_id)
        passenger = await self._passengers.update_passenger(ref, changes)
        if passenger is None:
            raise _not_found("El pasajero")
        # Which fields changed, not their values: ID documents stay out of the audit log.
        fields = sorted(changes.model_dump(exclude_unset=True).keys())
        await self._record("passengers.updated", actor, passenger.id, {"fields": fields}, ip)
        return passenger

    async def delete_passenger(self, actor: User, public_id: str, ip: str | None) -> None:
        passenger = await self.get_passenger(public_id)
        ref = self._ref(public_id)
        if passenger.vehicle_id is not None:
            await self._passengers.unbind_from_vehicle(ref, passenger.vehicle_id)
        if not await self._passengers.delete_passenger(ref):
            raise _not_found("El pasajero")
        await self._record("passengers.deleted", actor, passenger.id, {"name": passenger.name}, ip)

    async def assign_vehicle(
        self, actor: User, public_id: str, vehicle_id: int, ip: str | None
    ) -> Passenger:
        passenger = await self.get_passenger(public_id)
        ref = self._ref(public_id)
        if passenger.vehicle_id == vehicle_id:
            raise _conflict("El pasajero ya está asignado a ese vehículo.")
        if not any(v.id == vehicle_id for v in await self._vehicles.list_vehicles()):
            raise _not_found("El vehículo")

        # A passenger rides one vehicle at a time; a vehicle carries many passengers.
        if passenger.vehicle_id is not None:
            await self._passengers.unbind_from_vehicle(ref, passenger.vehicle_id)
        await self._passengers.bind_to_vehicle(ref, vehicle_id)
        await self._record(
            "passengers.vehicle_assigned",
            actor,
            passenger.id,
            {"vehicle_id": vehicle_id, "previous_vehicle_id": passenger.vehicle_id},
            ip,
        )
        return await self.get_passenger(public_id)

    async def unassign_vehicle(self, actor: User, public_id: str, ip: str | None) -> Passenger:
        passenger = await self.get_passenger(public_id)
        if passenger.vehicle_id is None:
            raise _conflict("El pasajero no tiene un vehículo asignado.")
        await self._passengers.unbind_from_vehicle(self._ref(public_id), passenger.vehicle_id)
        await self._record(
            "passengers.vehicle_unassigned",
            actor,
            passenger.id,
            {"vehicle_id": passenger.vehicle_id},
            ip,
        )
        return await self.get_passenger(public_id)

    @staticmethod
    def _matches(passenger: Passenger, term: str) -> bool:
        """Name, code or any custom field value, so a passenger can be found by document."""
        texts = [passenger.name, passenger.code or "", *passenger.custom_fields.values()]
        return any(term in text.lower() for text in texts)

    async def _check_duplicate_code(self, code: str | None, *, exclude_id: str | None) -> None:
        if not code:
            return
        others = [p for p in await self._passengers.list_passengers() if p.id != exclude_id]
        if any((p.code or "").lower() == code.lower() for p in others):
            raise _conflict("Ya existe otro pasajero con ese código.")

    async def _record(
        self, action: str, actor: User, passenger_id: str, details: dict, ip: str | None
    ) -> None:
        self._audit.record(
            action,
            actor=actor,
            entity_type="passenger",
            entity_id=passenger_id,
            details=details,
            ip_address=ip,
        )
        await self._session.commit()

    @staticmethod
    def _ref(public_id: str) -> ResourceItemRef:
        ref = ResourceItemRef.parse(public_id)
        if ref is None:
            raise _not_found("El pasajero")
        return ref

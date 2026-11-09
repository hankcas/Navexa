from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError
from app.db.models import User
from app.schemas.vehicle import CustomField, CustomFieldCreate, CustomFieldUpdate, Vehicle
from app.services.audit_service import AuditService


class CustomFieldStore(Protocol):
    async def get_vehicle(self, vehicle_id: int) -> tuple[Vehicle, list[CustomField]] | None: ...
    async def create_custom_field(self, vehicle_id: int, name: str, value: str) -> CustomField: ...
    async def update_custom_field(
        self, vehicle_id: int, field_id: int, name: str, value: str
    ) -> CustomField: ...
    async def delete_custom_field(self, vehicle_id: int, field_id: int) -> None: ...


def _not_found(what: str) -> BusinessRuleError:
    return BusinessRuleError(f"{what} no existe.", status_code=404, title="No encontrado")


def _conflict(message: str) -> BusinessRuleError:
    return BusinessRuleError(message, status_code=409, title="Conflicto")


class VehicleFieldsService:
    """Create, edit and delete the custom fields of a vehicle in Wialon (RF-19, RF-22)."""

    def __init__(self, store: CustomFieldStore, session: AsyncSession):
        self._store = store
        self._session = session
        self._audit = AuditService(session)

    async def create(
        self, actor: User, vehicle_id: int, data: CustomFieldCreate, ip: str | None
    ) -> CustomField:
        fields = await self._fields(vehicle_id)
        # Wialon accepts two fields with the same name (checked live); we do not.
        self._check_unique_name(fields, data.name, exclude_id=None)
        field = await self._store.create_custom_field(vehicle_id, data.name, data.value)
        await self._record("vehicles.custom_field_created", actor, vehicle_id, field.name, ip)
        return field

    async def update(
        self, actor: User, vehicle_id: int, field_id: int, data: CustomFieldUpdate, ip: str | None
    ) -> CustomField:
        fields = await self._fields(vehicle_id)
        current = next((field for field in fields if field.id == field_id), None)
        if current is None:
            raise _not_found("El campo")
        if (
            data.expected_modified_at is not None
            and current.modified_at is not None
            and current.modified_at > data.expected_modified_at
        ):
            raise _conflict(
                "Este campo cambió en la plataforma de rastreo mientras lo editabas. "
                "Recarga para ver el valor actual."
            )

        name = data.name if data.name is not None else current.name
        value = data.value if data.value is not None else current.value
        self._check_unique_name(fields, name, exclude_id=field_id)
        field = await self._store.update_custom_field(vehicle_id, field_id, name, value)
        await self._record("vehicles.custom_field_updated", actor, vehicle_id, field.name, ip)
        return field

    async def delete(self, actor: User, vehicle_id: int, field_id: int, ip: str | None) -> None:
        fields = await self._fields(vehicle_id)
        field = next((f for f in fields if f.id == field_id), None)
        if field is None:
            raise _not_found("El campo")
        await self._store.delete_custom_field(vehicle_id, field_id)
        await self._record("vehicles.custom_field_deleted", actor, vehicle_id, field.name, ip)

    async def _fields(self, vehicle_id: int) -> list[CustomField]:
        found = await self._store.get_vehicle(vehicle_id)
        if found is None:
            raise _not_found("El vehículo")
        return found[1]

    @staticmethod
    def _check_unique_name(fields: list[CustomField], name: str, *, exclude_id: int | None) -> None:
        if any(f.name.lower() == name.lower() and f.id != exclude_id for f in fields):
            raise _conflict(f"El vehículo ya tiene un campo llamado «{name}».")

    async def _record(
        self, action: str, actor: User, vehicle_id: int, field_name: str, ip: str | None
    ) -> None:
        self._audit.record(
            action,
            actor=actor,
            entity_type="vehicle",
            entity_id=str(vehicle_id),
            details={"field": field_name},
            ip_address=ip,
        )
        await self._session.commit()

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, User


class AuditService:
    def __init__(self, session: AsyncSession):
        self._session = session

    def record(
        self,
        action: str,
        *,
        actor: User | None = None,
        actor_email: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> None:
        self._session.add(
            AuditLog(
                action=action,
                actor_id=actor.id if actor else None,
                actor_email=actor.email if actor else actor_email,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details,
                ip_address=ip_address,
            )
        )
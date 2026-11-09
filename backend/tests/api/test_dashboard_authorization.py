"""TST-02: every role sees the dashboard (section 5.3); without a session nobody does."""
import pytest

from app.api.dependencies import get_current_user, get_dashboard_service
from app.core.exceptions import AuthenticationError
from app.db.models import Permission, Role, User
from app.domain.permissions import DEFAULT_ROLE_PERMISSIONS, RoleName
from app.main import app
from app.services.dashboard_service import DashboardService
from tests.api.helpers import browser_client
from tests.unit.test_dashboard_service import DRIVERS, PASSENGERS, VEHICLES, Static


def user_with_role(role: RoleName) -> User:
    permissions = [Permission(code=code.value) for code in DEFAULT_ROLE_PERMISSIONS[role]]
    return User(
        id=1,
        email=f"{role.value}@navexa.co",
        full_name=role.value,
        must_change_password=False,
        is_active=True,
        token_version=0,
        role=Role(name=role.value, permissions=permissions),
    )


@pytest.fixture
def client():
    app.dependency_overrides[get_dashboard_service] = lambda: DashboardService(
        Static(VEHICLES), Static(DRIVERS), Static(PASSENGERS)
    )
    yield browser_client()
    app.dependency_overrides.clear()


def login_as(user: User | None) -> None:
    def current_user() -> User:
        if user is None:
            raise AuthenticationError("no session")
        return user

    app.dependency_overrides[get_current_user] = current_user


@pytest.mark.parametrize("role", list(RoleName))
def test_every_role_sees_the_dashboard(client, role):
    login_as(user_with_role(role))
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    assert response.json()["vehicles"]["total"] == 5


def test_without_session_it_is_401(client):
    login_as(None)
    assert client.get("/api/v1/dashboard/summary").status_code == 401

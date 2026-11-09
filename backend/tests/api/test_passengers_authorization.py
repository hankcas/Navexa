"""TST-02: each role can do exactly what the permission matrix (section 5.3) allows on passengers."""
import pytest

from app.api.dependencies import get_current_user, get_passenger_service
from app.core.exceptions import AuthenticationError
from app.db.models import Permission, Role, User
from app.domain.permissions import DEFAULT_ROLE_PERMISSIONS, RoleName
from app.main import app
from app.schemas.passenger import Passenger
from app.services.passenger_service import PassengerService
from tests.api.helpers import browser_client
from tests.fakes import FakePassengerGateway, FakeSession, FakeVehicles

FREE_PASSENGER = Passenger(id="1-1", name="Laura Ríos")

READ = [
    ("GET", "/api/v1/passengers", None),
    ("GET", "/api/v1/passengers?vehicle_id=500", None),
    ("GET", "/api/v1/passengers/1-1", None),
]
WRITE = [
    ("POST", "/api/v1/passengers", {"name": "Marta"}, 201),
    ("PATCH", "/api/v1/passengers/1-1", {"custom_fields": {"ruta": "Sur"}}, 200),
    ("PUT", "/api/v1/passengers/1-1/vehicle", {"vehicle_id": 500}, 200),
    ("DELETE", "/api/v1/passengers/1-1", None, 204),
]


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
    # No `with`: the app lifespan (real Wialon client) does not start in these tests.
    def fake_service():
        return PassengerService(FakePassengerGateway(FREE_PASSENGER), FakeVehicles(500), FakeSession())

    app.dependency_overrides[get_passenger_service] = fake_service
    yield browser_client()
    app.dependency_overrides.clear()


def login_as(user: User | None) -> None:
    def current_user() -> User:
        if user is None:
            raise AuthenticationError("no session")
        return user

    app.dependency_overrides[get_current_user] = current_user


@pytest.mark.parametrize(("method", "url", "body"), READ + [request[:3] for request in WRITE])
def test_without_session_everything_is_401(client, method, url, body):
    login_as(None)
    assert client.request(method, url, json=body).status_code == 401


@pytest.mark.parametrize("role", list(RoleName))
@pytest.mark.parametrize(("method", "url", "body"), READ)
def test_every_role_can_read(client, role, method, url, body):
    login_as(user_with_role(role))
    assert client.request(method, url, json=body).status_code == 200


@pytest.mark.parametrize(("method", "url", "body", "_"), WRITE)
def test_viewer_cannot_change_passengers(client, method, url, body, _):
    login_as(user_with_role(RoleName.VIEWER))
    assert client.request(method, url, json=body).status_code == 403


@pytest.mark.parametrize("role", [RoleName.ADMIN, RoleName.OPERATOR])
@pytest.mark.parametrize(("method", "url", "body", "expected"), WRITE)
def test_admin_and_operator_can_change_passengers(client, role, method, url, body, expected):
    login_as(user_with_role(role))
    assert client.request(method, url, json=body).status_code == expected


def test_assigning_to_an_unknown_vehicle_is_404(client):
    login_as(user_with_role(RoleName.OPERATOR))
    response = client.request("PUT", "/api/v1/passengers/1-1/vehicle", json={"vehicle_id": 999})
    assert response.status_code == 404
    assert response.json()["detail"] == "El vehículo no existe."

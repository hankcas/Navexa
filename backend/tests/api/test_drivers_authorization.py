"""TST-02: each role can do exactly what the permission matrix (section 5.3) allows."""
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user, get_driver_service
from app.core.exceptions import AuthenticationError
from app.db.models import Permission, Role, User
from app.domain.permissions import DEFAULT_ROLE_PERMISSIONS, RoleName
from app.main import app
from app.schemas.driver import Driver
from app.services.driver_service import DriverService
from tests.fakes import FakeDriverGateway, FakeSession, FakeVehicles

FREE_DRIVER = Driver(id="1-1", name="Ana Gómez")

READ = [("GET", "/api/v1/drivers", None), ("GET", "/api/v1/drivers/1-1", None)]
WRITE = [
    ("POST", "/api/v1/drivers", {"name": "Marta"}),
    ("PATCH", "/api/v1/drivers/1-1", {"name": "Ana G."}),
    ("PUT", "/api/v1/drivers/1-1/vehicle", {"vehicle_id": 500}),
    ("DELETE", "/api/v1/drivers/1-1", None),
]


def user_with_role(role: RoleName, *, must_change_password: bool = False) -> User:
    permissions = [Permission(code=code.value) for code in DEFAULT_ROLE_PERMISSIONS[role]]
    return User(
        id=1,
        email=f"{role.value}@navexa.co",
        full_name=role.value,
        must_change_password=must_change_password,
        is_active=True,
        token_version=0,
        role=Role(name=role.value, permissions=permissions),
    )


@pytest.fixture
def client():
    # No `with`: the app lifespan (real Wialon client) does not start in these tests.
    def fake_service():
        return DriverService(FakeDriverGateway(FREE_DRIVER), FakeVehicles(500), FakeSession())

    app.dependency_overrides[get_driver_service] = fake_service
    yield TestClient(app)
    app.dependency_overrides.clear()


def login_as(user: User | None) -> None:
    def current_user() -> User:
        if user is None:
            raise AuthenticationError("no session")
        return user

    app.dependency_overrides[get_current_user] = current_user


def send(client: TestClient, method: str, url: str, body: dict | None):
    return client.request(method, url, json=body)


@pytest.mark.parametrize(("method", "url", "body"), READ + WRITE)
def test_without_session_everything_is_401(client, method, url, body):
    login_as(None)
    response = send(client, method, url, body)
    assert response.status_code == 401
    assert response.headers["content-type"] == "application/problem+json"


@pytest.mark.parametrize("role", list(RoleName))
@pytest.mark.parametrize(("method", "url", "body"), READ)
def test_every_role_can_read(client, role, method, url, body):
    login_as(user_with_role(role))
    assert send(client, method, url, body).status_code == 200


@pytest.mark.parametrize(("method", "url", "body"), WRITE)
def test_viewer_cannot_change_drivers(client, method, url, body):
    login_as(user_with_role(RoleName.VIEWER))
    response = send(client, method, url, body)
    assert response.status_code == 403
    assert response.json()["title"] == "Acceso denegado"


@pytest.mark.parametrize("role", [RoleName.ADMIN, RoleName.OPERATOR])
@pytest.mark.parametrize(
    ("method", "url", "body", "expected"),
    [(*request, code) for request, code in zip(WRITE, [201, 200, 200, 204])],
)
def test_admin_and_operator_can_change_drivers(client, role, method, url, body, expected):
    login_as(user_with_role(role))
    assert send(client, method, url, body).status_code == expected


def test_a_temporary_password_blocks_everything_until_it_is_changed(client):
    login_as(user_with_role(RoleName.ADMIN, must_change_password=True))
    assert send(client, "GET", "/api/v1/drivers", None).status_code == 403


def test_badly_formed_driver_id_is_rejected_before_reaching_wialon(client):
    login_as(user_with_role(RoleName.ADMIN))
    assert send(client, "GET", "/api/v1/drivers/abc", None).status_code == 422


def test_invalid_input_is_422_with_field_errors(client):
    login_as(user_with_role(RoleName.ADMIN))
    response = send(client, "POST", "/api/v1/drivers", {"name": "Marta", "phone": "abc"})
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "phone"

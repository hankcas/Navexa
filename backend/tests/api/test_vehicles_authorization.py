"""TST-02 for vehicles: everyone reads the detail; only admin and operator edit custom fields."""
import pytest

from app.api.dependencies import get_current_user, get_vehicle_fields_service, get_vehicle_service
from app.db.models import Permission, Role, User
from app.domain.permissions import DEFAULT_ROLE_PERMISSIONS, RoleName
from app.main import app
from app.schemas.vehicle import CustomField
from app.services.vehicle_fields_service import VehicleFieldsService
from app.services.vehicle_service import VehicleService
from tests.api.helpers import browser_client
from tests.fakes import FakeSession
from tests.unit.test_vehicle_fields_service import FakeFieldStore
from tests.unit.test_vehicle_service import ANA, DetailVehicles, StaticDrivers, StaticPassengers, TRUCK

WRITES = [
    ("POST", "/api/v1/vehicles/500/custom-fields", {"name": "Marca", "value": "Volvo"}, 201),
    ("PATCH", "/api/v1/vehicles/500/custom-fields/1", {"value": "XYZ"}, 200),
    ("DELETE", "/api/v1/vehicles/500/custom-fields/1", None, 204),
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
    app.dependency_overrides[get_vehicle_service] = lambda: VehicleService(
        DetailVehicles(TRUCK), StaticDrivers(ANA), StaticPassengers()
    )
    app.dependency_overrides[get_vehicle_fields_service] = lambda: VehicleFieldsService(
        FakeFieldStore(CustomField(id=1, name="Placa", value="ABC123")), FakeSession()
    )
    return browser_client()


def login_as(role: RoleName) -> None:
    app.dependency_overrides[get_current_user] = lambda: user_with_role(role)


@pytest.mark.parametrize("role", list(RoleName))
def test_every_role_sees_the_vehicle_detail(client, role):
    login_as(role)
    response = client.get("/api/v1/vehicles/500")
    assert response.status_code == 200
    assert response.json()["driver"]["name"] == "Ana Gómez"
    assert response.json()["custom_fields"][0]["name"] == "Placa"


@pytest.mark.parametrize(("method", "url", "body", "_"), WRITES)
def test_viewer_cannot_edit_custom_fields(client, method, url, body, _):
    login_as(RoleName.VIEWER)
    assert client.request(method, url, json=body).status_code == 403


@pytest.mark.parametrize("role", [RoleName.ADMIN, RoleName.OPERATOR])
@pytest.mark.parametrize(("method", "url", "body", "expected"), WRITES)
def test_admin_and_operator_can_edit_custom_fields(client, role, method, url, body, expected):
    login_as(role)
    assert client.request(method, url, json=body).status_code == expected


def test_an_unknown_vehicle_is_404(client):
    login_as(RoleName.VIEWER)
    assert client.get("/api/v1/vehicles/999").status_code == 404

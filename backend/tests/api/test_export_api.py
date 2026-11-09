"""TST-02 for CSV downloads (RF-25): admin and operator export; the viewer role does not."""
import pytest

from app.api.dependencies import get_current_user, get_export_service, get_track_service
from app.db.models import Permission, Role, User
from app.domain.permissions import PermissionCode, RoleName
from app.main import app
from app.services.track_service import TrackService
from tests.api.helpers import browser_client
from tests.api.test_vehicles_authorization import user_with_role
from tests.fakes import FakeSession
from tests.unit.test_export_service import service
from tests.unit.test_track_service import NOW, STRAIGHT, FakeTrackSource

EXPORTS = ["/api/v1/vehicles/export", "/api/v1/drivers/export", "/api/v1/passengers/export"]


@pytest.fixture(autouse=True)
def fake_exports():
    app.dependency_overrides[get_export_service] = lambda: service(FakeSession())


def login_as(user: User) -> None:
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.mark.parametrize("role", [RoleName.ADMIN, RoleName.OPERATOR])
@pytest.mark.parametrize("url", EXPORTS)
def test_admin_and_operator_download_a_csv(role, url):
    login_as(user_with_role(role))
    response = browser_client().get(url)

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"].startswith('attachment; filename="')
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith("﻿Nombre;".encode())


@pytest.mark.parametrize("url", EXPORTS)
def test_the_viewer_role_cannot_export(url):
    login_as(user_with_role(RoleName.VIEWER))
    assert browser_client().get(url).status_code == 403


@pytest.mark.parametrize("url", EXPORTS)
def test_without_a_session_it_is_401(url):
    assert browser_client().get(url).status_code == 401


def test_filters_reach_the_file():
    login_as(user_with_role(RoleName.OPERATOR))
    response = browser_client().get(EXPORTS[0], params={"status": "moving"})
    assert response.headers["x-export-rows"] == "1"


def test_export_is_not_mistaken_for_a_vehicle_id():
    login_as(user_with_role(RoleName.ADMIN))
    assert browser_client().get(EXPORTS[0]).status_code == 200


def test_the_route_history_needs_the_history_permission():
    without_history = {
        Permission(code=code.value)
        for code in (PermissionCode.VEHICLES_READ, PermissionCode.DRIVERS_READ)
    }
    login_as(
        User(
            id=2,
            email="sin-historial@navexa.co",
            full_name="Sin historial",
            must_change_password=False,
            is_active=True,
            token_version=0,
            role=Role(name="custom", permissions=list(without_history)),
        )
    )
    app.dependency_overrides[get_track_service] = lambda: TrackService(
        FakeTrackSource(STRAIGHT), moving_speed_kmh=5, clock=lambda: NOW
    )
    response = browser_client().get(
        "/api/v1/vehicles/500/track",
        params={"from": "2026-11-08T10:00:00Z", "to": "2026-11-08T11:00:00Z"},
    )
    assert response.status_code == 403

"""TST-02 for the audit log (RF-26): only roles with audit:read see it."""
import pytest

from app.api.dependencies import get_audit_query_service, get_current_user
from app.domain.permissions import RoleName
from app.main import app
from app.services.audit_query_service import AuditQueryService
from tests.api.helpers import browser_client
from tests.api.test_vehicles_authorization import user_with_role
from tests.unit.test_audit_query_service import FakeAuditRepository, row

URL = "/api/v1/audit"


@pytest.fixture
def repository():
    fake = FakeAuditRepository([row(1, "auth.login_success")])
    app.dependency_overrides[get_audit_query_service] = lambda: AuditQueryService(fake)
    return fake


def login_as(role: RoleName) -> None:
    app.dependency_overrides[get_current_user] = lambda: user_with_role(role)


def test_the_administrator_reads_the_log(repository):
    login_as(RoleName.ADMIN)
    response = browser_client().get(URL)

    assert response.status_code == 200
    assert response.json()["items"][0]["action"] == "auth.login_success"


@pytest.mark.parametrize("role", [RoleName.OPERATOR, RoleName.VIEWER])
def test_other_roles_cannot_read_it(repository, role):
    login_as(role)
    assert browser_client().get(URL).status_code == 403
    assert repository.calls == []


def test_without_a_session_it_is_401(repository):
    assert browser_client().get(URL).status_code == 401


def test_filters_come_from_the_query_string(repository):
    login_as(RoleName.ADMIN)
    browser_client().get(
        URL,
        params={"category": "drivers", "search": "ana", "from": "2026-11-08T05:00:00Z", "page": 2},
    )
    filters = repository.calls[0]
    assert filters["category"].value == "drivers"
    assert filters["search"] == "ana"
    assert filters["offset"] == 20


@pytest.mark.parametrize("params", [{"category": "secretos"}, {"page_size": 500}, {"from": "ayer"}])
def test_invalid_filters_are_422(repository, params):
    login_as(RoleName.ADMIN)
    assert browser_client().get(URL, params=params).status_code == 422


def test_the_log_cannot_be_changed_through_the_api(repository):
    login_as(RoleName.ADMIN)
    client = browser_client()
    assert client.post(URL, json={}).status_code == 405
    assert client.delete(f"{URL}/1").status_code == 404

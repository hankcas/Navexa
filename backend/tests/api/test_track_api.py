"""TST-02 for the route history: every role reads it, nobody without a session does."""
from datetime import datetime, timedelta, timezone

import pytest

from app.api.dependencies import get_current_user, get_track_service
from app.domain.permissions import RoleName
from app.main import app
from app.services.track_service import TrackService
from tests.api.helpers import browser_client
from tests.api.test_vehicles_authorization import user_with_role
from tests.unit.test_track_service import NOW, STRAIGHT, FakeTrackSource

URL = "/api/v1/vehicles/500/track"
RANGE = {"from": "2026-11-08T10:00:00Z", "to": "2026-11-08T11:30:00Z"}


@pytest.fixture
def source():
    fake = FakeTrackSource(STRAIGHT)
    app.dependency_overrides[get_track_service] = lambda: TrackService(
        fake, moving_speed_kmh=5, clock=lambda: NOW
    )
    return fake


@pytest.mark.parametrize("role", list(RoleName))
def test_every_role_sees_the_route(source, role):
    app.dependency_overrides[get_current_user] = lambda: user_with_role(role)
    response = browser_client().get(URL, params=RANGE)

    assert response.status_code == 200
    body = response.json()
    assert body["total_points"] == 10
    assert len(body["points"]) == 2
    assert set(body["points"][0]) == {"time", "latitude", "longitude", "speed_kmh", "heading"}


def test_the_range_comes_from_the_from_and_to_parameters(source):
    app.dependency_overrides[get_current_user] = lambda: user_with_role(RoleName.VIEWER)
    browser_client().get(URL, params=RANGE)

    _, start, end, _ = source.requests[0]
    assert start == datetime(2026, 11, 8, 10, tzinfo=timezone.utc)
    assert end == NOW - timedelta(minutes=30)


def test_a_bad_range_is_a_problem_details_422(source):
    app.dependency_overrides[get_current_user] = lambda: user_with_role(RoleName.VIEWER)
    response = browser_client().get(URL, params={"from": RANGE["to"], "to": RANGE["from"]})

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    assert "posterior a la inicial" in response.json()["detail"]


@pytest.mark.parametrize("params", [{}, {"from": RANGE["from"]}, {"from": "ayer", "to": RANGE["to"]}])
def test_missing_or_unreadable_dates_are_422(source, params):
    app.dependency_overrides[get_current_user] = lambda: user_with_role(RoleName.VIEWER)
    assert browser_client().get(URL, params=params).status_code == 422
    assert source.requests == []


def test_without_a_session_it_is_401(source):
    assert browser_client().get(URL, params=RANGE).status_code == 401

import pytest

from app.domain.driver_ref import DriverRef


def test_public_id_joins_resource_and_driver():
    assert DriverRef(27668776, 1).public_id == "27668776-1"


def test_parse_reads_back_a_public_id():
    assert DriverRef.parse("27668776-1") == DriverRef(27668776, 1)


@pytest.mark.parametrize("value", ["", "27668776", "27668776-", "-1", "a-1", "1-2-3", "1 - 2", "../1-2"])
def test_parse_rejects_anything_else(value):
    assert DriverRef.parse(value) is None

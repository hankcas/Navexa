import pytest

from app.domain.resource_item_ref import ResourceItemRef


def test_public_id_joins_resource_and_item():
    assert ResourceItemRef(27668776, 1).public_id == "27668776-1"


def test_parse_reads_back_a_public_id():
    assert ResourceItemRef.parse("27668776-1") == ResourceItemRef(27668776, 1)


@pytest.mark.parametrize("value", ["", "27668776", "27668776-", "-1", "a-1", "1-2-3", "1 - 2", "../1-2"])
def test_parse_rejects_anything_else(value):
    assert ResourceItemRef.parse(value) is None

import pytest
from pydantic import ValidationError

from app.schemas.passenger import PassengerCreate, PassengerUpdate


def test_texts_are_trimmed():
    data = PassengerCreate(name="  Laura  ", code=" P-1 ", custom_fields={" ruta ": " Norte "})
    assert (data.name, data.code, data.custom_fields) == ("Laura", "P-1", {"ruta": "Norte"})


def test_name_is_required_to_create():
    with pytest.raises(ValidationError):
        PassengerCreate(name="")


def test_custom_fields_follow_the_shared_rules():
    with pytest.raises(ValidationError):
        PassengerCreate(name="Laura", custom_fields={"": "x"})
    with pytest.raises(ValidationError):
        PassengerCreate(name="Laura", custom_fields={"nota": "x" * 201})


def test_a_field_repeated_after_trimming_is_rejected():
    with pytest.raises(ValidationError):
        PassengerCreate(name="Laura", custom_fields={"ruta": "Norte", " ruta": "Sur"})


def test_update_only_carries_the_fields_that_were_sent():
    changes = PassengerUpdate(custom_fields={"ruta": "Sur"}).to_changes()
    assert changes.model_dump(exclude_unset=True) == {"custom_fields": {"ruta": "Sur"}}

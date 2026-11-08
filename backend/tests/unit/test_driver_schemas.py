import pytest
from pydantic import ValidationError

from app.schemas.driver import DriverCreate, DriverUpdate


def test_texts_are_trimmed():
    data = DriverCreate(name="  Ana  ", code=" A-1 ", phone=" +573001234567 ")
    assert (data.name, data.code, data.phone) == ("Ana", "A-1", "+573001234567")


@pytest.mark.parametrize("phone", ["+573001234567", "3001234567", "1234567"])
def test_accepts_valid_phones(phone):
    assert DriverCreate(name="Ana", phone=phone).phone == phone


@pytest.mark.parametrize("phone", ["300-123-4567", "+57 300", "abc1234567", "123456", "+1234567890123456"])
def test_rejects_invalid_phones(phone):
    with pytest.raises(ValidationError):
        DriverCreate(name="Ana", phone=phone)


def test_an_empty_phone_clears_it_on_update():
    assert DriverUpdate(phone="").to_changes().phone == ""


def test_name_is_required_to_create():
    with pytest.raises(ValidationError):
        DriverCreate(name=" ")


def test_custom_fields_are_trimmed_and_limited():
    assert DriverCreate(name="Ana", custom_fields={" cedula ": " 123 "}).custom_fields == {"cedula": "123"}

    with pytest.raises(ValidationError):
        DriverCreate(name="Ana", custom_fields={" ": "x"})
    with pytest.raises(ValidationError):
        DriverCreate(name="Ana", custom_fields={f"campo{i}": "x" for i in range(21)})


def test_update_only_carries_the_fields_that_were_sent():
    changes = DriverUpdate(phone="+573001234567").to_changes()
    assert changes.model_dump(exclude_unset=True) == {"phone": "+573001234567"}

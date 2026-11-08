MAX_CUSTOM_FIELDS = 20
MAX_NAME_LENGTH = 50
MAX_VALUE_LENGTH = 200


def clean_custom_fields(value: dict[str, str] | None) -> dict[str, str] | None:
    """Validation shared by drivers and passengers (RF-18, RF-27).

    Trims names and values and checks the limits. None means "not sent" and is kept as is.
    """
    if value is None:
        return None
    if len(value) > MAX_CUSTOM_FIELDS:
        raise ValueError(f"Se permiten como máximo {MAX_CUSTOM_FIELDS} campos personalizados.")
    cleaned: dict[str, str] = {}
    for name, field_value in value.items():
        name, field_value = name.strip(), field_value.strip()
        if not 1 <= len(name) <= MAX_NAME_LENGTH:
            raise ValueError(
                f"El nombre de cada campo personalizado debe tener entre 1 y {MAX_NAME_LENGTH} caracteres."
            )
        if len(field_value) > MAX_VALUE_LENGTH:
            raise ValueError(
                f"El valor de cada campo personalizado puede tener como máximo {MAX_VALUE_LENGTH} caracteres."
            )
        if name in cleaned:
            raise ValueError(f"El campo personalizado «{name}» está repetido.")
        cleaned[name] = field_value
    return cleaned

import re

MIN_LENGTH = 12
MAX_LENGTH = 128


def password_policy_errors(password: str) -> list[str]:
    errors = []
    if len(password) < MIN_LENGTH:
        errors.append(f"Debe tener al menos {MIN_LENGTH} caracteres.")
    if len(password) > MAX_LENGTH:
        errors.append(f"Debe tener como máximo {MAX_LENGTH} caracteres.")
    if not re.search(r"[a-z]", password):
        errors.append("Debe incluir al menos una letra minúscula.")
    if not re.search(r"[A-Z]", password):
        errors.append("Debe incluir al menos una letra mayúscula.")
    if not re.search(r"\d", password):
        errors.append("Debe incluir al menos un número.")
    if not re.search(r"[^A-Za-z0-9]", password):
        errors.append("Debe incluir al menos un símbolo.")
    return errors
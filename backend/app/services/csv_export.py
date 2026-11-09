"""CSV files for Excel (RF-25): safe against CSV injection and in Colombian format.

Pure functions: they receive our own models and return text. No Wialon, no database.
"""
import csv
import io
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timedelta, timezone

from app.domain.vehicle_status import VehicleStatus
from app.schemas.driver import Driver
from app.schemas.passenger import Passenger
from app.schemas.vehicle import Vehicle

# Excel with Colombian regional settings uses ";" between columns and "," for decimals
# (because "," is already the decimal mark). With "," between columns everything would land
# in a single column there.
DELIMITER = ";"
# UTF-8 "byte order mark": without it Excel reads the file as Latin-1 and breaks the accents.
BOM = "﻿"
COLOMBIA = timezone(timedelta(hours=-5), "America/Bogota")

# OWASP "CSV Injection": a cell that starts with one of these is run as a formula by Excel,
# LibreOffice or Google Sheets (e.g. =HYPERLINK(...) to steal data). Includes the full-width
# variants some spreadsheets also accept.
FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r", "\n", "＝", "＋", "－", "＠")

STATUS_LABELS = {
    VehicleStatus.MOVING: "En movimiento",
    VehicleStatus.STOPPED: "Detenido",
    VehicleStatus.OFFLINE: "Sin señal",
    VehicleStatus.NO_POSITION: "Sin posición",
}


def safe_text(value: str | None) -> str:
    """Text written by a user or read from Wialon, made harmless for a spreadsheet.

    A leading apostrophe makes Excel show the value as plain text instead of running it.
    Spaces before the symbol do not help an attacker either, so they are ignored when checking.
    """
    if not value:
        return ""
    return f"'{value}" if value.lstrip(" ").startswith(FORMULA_STARTS) else value


def number(value: float | None, decimals: int = 0) -> str:
    """A number we produced (never user text), with a decimal comma: 4,65432. Negative numbers
    such as longitudes are safe here, because they are not text a user could have typed."""
    if value is None:
        return ""
    return f"{value:.{decimals}f}".replace(".", ",")


def date_time(value: datetime | None) -> str:
    """Colombia time, in a form Excel recognizes as a date: 2026-11-08 07:00."""
    return value.astimezone(COLOMBIA).strftime("%Y-%m-%d %H:%M") if value else ""


def custom_fields(fields: Mapping[str, str]) -> str:
    return " | ".join(f"{name}: {value}" for name, value in sorted(fields.items()))


def build_csv(headers: Sequence[str], rows: Iterable[Sequence[str]]) -> str:
    buffer = io.StringIO()
    # The csv module adds quotes when a value contains ";", quotes or line breaks.
    writer = csv.writer(buffer, delimiter=DELIMITER, lineterminator="\r\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return BOM + buffer.getvalue()


def vehicles_csv(vehicles: Iterable[Vehicle]) -> str:
    headers = [
        "Nombre",
        "Estado",
        "Velocidad (km/h)",
        "Última actualización",
        "Latitud",
        "Longitud",
        "Conductor",
        "Teléfono del conductor",
    ]
    rows = (
        [
            safe_text(v.name),
            STATUS_LABELS[v.status],
            number(v.speed_kmh),
            date_time(v.last_update),
            number(v.position.latitude, 6) if v.position else "",
            number(v.position.longitude, 6) if v.position else "",
            safe_text(v.driver.name) if v.driver else "",
            safe_text(v.driver.phone) if v.driver else "",
        ]
        for v in vehicles
    )
    return build_csv(headers, rows)


def _vehicle_name(vehicle_id: int | None, vehicle_names: Mapping[int, str]) -> str:
    if vehicle_id is None:
        return ""
    return safe_text(vehicle_names.get(vehicle_id, f"Vehículo {vehicle_id}"))


def drivers_csv(drivers: Iterable[Driver], vehicle_names: Mapping[int, str]) -> str:
    headers = [
        "Nombre",
        "Código",
        "Teléfono",
        "Descripción",
        "Vehículo asignado",
        "Asignado desde",
        "Campos personalizados",
    ]
    rows = (
        [
            safe_text(d.name),
            safe_text(d.code),
            safe_text(d.phone),
            safe_text(d.description),
            _vehicle_name(d.vehicle_id, vehicle_names),
            date_time(d.bound_at),
            safe_text(custom_fields(d.custom_fields)),
        ]
        for d in drivers
    )
    return build_csv(headers, rows)


def passengers_csv(passengers: Iterable[Passenger], vehicle_names: Mapping[int, str]) -> str:
    headers = ["Nombre", "Código", "Vehículo asignado", "Asignado desde", "Campos personalizados"]
    rows = (
        [
            safe_text(p.name),
            safe_text(p.code),
            _vehicle_name(p.vehicle_id, vehicle_names),
            date_time(p.bound_at),
            safe_text(custom_fields(p.custom_fields)),
        ]
        for p in passengers
    )
    return build_csv(headers, rows)

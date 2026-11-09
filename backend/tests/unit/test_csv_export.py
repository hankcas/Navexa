import csv
import io
from datetime import datetime, timezone

import pytest

from app.domain.vehicle_status import VehicleStatus
from app.schemas.driver import Driver
from app.schemas.passenger import Passenger
from app.schemas.vehicle import Position, Vehicle, VehicleDriver
from app.services.csv_export import (
    BOM,
    date_time,
    drivers_csv,
    number,
    passengers_csv,
    safe_text,
    vehicles_csv,
)


def read(content: str) -> list[list[str]]:
    """Parse the file back the way a spreadsheet would."""
    assert content.startswith(BOM)
    return list(csv.reader(io.StringIO(content.removeprefix(BOM)), delimiter=";"))


@pytest.mark.parametrize(
    "dangerous",
    [
        '=HYPERLINK("http://malo.example","Clic")',
        "+57 300",
        "-2+3",
        "@SUM(A1)",
        "\t=1+1",
        "\r=1+1",
        "  =1+1",
        "＝1+1",
    ],
)
def test_text_that_a_spreadsheet_would_run_as_a_formula_is_neutralized(dangerous):
    assert safe_text(dangerous) == f"'{dangerous}"


@pytest.mark.parametrize("harmless", ["Camión 01", "ABC-123", "a=b", "Ana; Luis", 'Dice "hola"'])
def test_normal_text_is_left_alone(harmless):
    assert safe_text(harmless) == harmless


def test_empty_values_are_empty_cells():
    assert safe_text(None) == "" and safe_text("") == ""
    assert number(None) == "" and date_time(None) == ""


def test_numbers_use_a_decimal_comma_and_negatives_stay_numbers():
    assert number(-74.0721, 4) == "-74,0721"
    assert number(42.6) == "43"


def test_dates_are_written_in_colombia_time():
    assert date_time(datetime(2026, 11, 8, 12, 30, tzinfo=timezone.utc)) == "2026-11-08 07:30"


def test_vehicles_file_has_spanish_headers_and_one_row_per_vehicle():
    truck = Vehicle(
        id=500,
        name="=cmd|' /C calc'!A0",
        status=VehicleStatus.MOVING,
        speed_kmh=42.4,
        last_update=datetime(2026, 11, 8, 12, tzinfo=timezone.utc),
        position=Position(latitude=4.65, longitude=-74.05),
        driver=VehicleDriver(id="1-1", name="Ana; Gómez", phone="+573001234567"),
    )
    van = Vehicle(id=600, name="Van 07", status=VehicleStatus.NO_POSITION)

    header, first, second = read(vehicles_csv([truck, van]))

    assert header[0] == "Nombre" and header[3] == "Última actualización"
    assert first == [
        "'=cmd|' /C calc'!A0",
        "En movimiento",
        "42",
        "2026-11-08 07:00",
        "4,650000",
        "-74,050000",
        "Ana; Gómez",
        "'+573001234567",
    ]
    assert second == ["Van 07", "Sin posición", "", "", "", "", "", ""]


def test_a_value_with_the_separator_is_quoted_so_columns_do_not_shift():
    content = vehicles_csv([Vehicle(id=1, name="Ruta; Norte", status=VehicleStatus.STOPPED)])
    assert '"Ruta; Norte"' in content
    assert len(read(content)[1]) == 8


def test_drivers_file_shows_the_vehicle_name_and_custom_fields():
    ana = Driver(
        id="1-1",
        name="Ana Gómez",
        code="A-1",
        phone="3001234567",
        custom_fields={"Licencia": "C2", "Cédula": "=1+1"},
        vehicle_id=500,
        bound_at=datetime(2026, 11, 8, 13, tzinfo=timezone.utc),
    )
    lost = Driver(id="1-2", name="Luis", vehicle_id=999)

    _, first, second = read(drivers_csv([ana, lost], {500: "Camión 01"}))

    assert first == ["Ana Gómez", "A-1", "3001234567", "", "Camión 01", "2026-11-08 08:00", "Cédula: =1+1 | Licencia: C2"]
    assert second[4] == "Vehículo 999"


def test_passengers_file():
    sara = Passenger(id="1-12", name="@Sara", custom_fields={})
    header, row = read(passengers_csv([sara], {}))
    assert header == ["Nombre", "Código", "Vehículo asignado", "Asignado desde", "Campos personalizados"]
    assert row == ["'@Sara", "", "", "", ""]

from datetime import datetime

from pydantic import BaseModel


class VehiclesByStatus(BaseModel):
    moving: int
    stopped: int
    offline: int
    no_position: int


class VehicleSummary(BaseModel):
    total: int
    by_status: VehiclesByStatus
    with_driver: int
    without_driver: int


class PeopleSummary(BaseModel):
    total: int
    # Bound to a vehicle in Wialon, even one this account cannot see.
    assigned: int


class DashboardSummary(BaseModel):
    """KPIs of the panel home page (RF-23), computed in one request."""

    vehicles: VehicleSummary
    drivers: PeopleSummary
    passengers: PeopleSummary
    generated_at: datetime

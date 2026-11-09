from datetime import datetime

from pydantic import BaseModel


class TrackPoint(BaseModel):
    """One position of a vehicle's route, as our own model (never the raw Wialon message)."""

    time: datetime
    latitude: float
    longitude: float
    speed_kmh: float
    heading: int | None = None


class TrackSummary(BaseModel):
    """Totals computed from every valid point Wialon sent, before simplifying the line."""

    distance_km: float
    max_speed_kmh: float
    average_speed_kmh: float | None
    """Average while moving; None if the vehicle never moved in the range."""
    started_at: datetime | None
    ended_at: datetime | None


class VehicleTrack(BaseModel):
    """A vehicle's route between two dates, ready to draw and play back (RF-24)."""

    vehicle_id: int
    start: datetime
    end: datetime
    total_points: int
    """Valid positions Wialon had in the range."""
    simplified: bool
    """True when `points` keeps fewer positions than `total_points` (same shape, lighter)."""
    points: list[TrackPoint]
    summary: TrackSummary

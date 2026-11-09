"""Pure geometry for routes: distances and line simplification. No Wialon, no FastAPI."""
import math
from collections.abc import Sequence

EARTH_RADIUS_M = 6_371_000.0

Coordinate = tuple[float, float]
"""(latitude, longitude) in degrees."""


def haversine_m(a: Coordinate, b: Coordinate) -> float:
    """Distance in meters between two points on the Earth's surface (haversine formula)."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def douglas_peucker(coordinates: Sequence[Coordinate], tolerance_m: float) -> list[int]:
    """Indexes of the points to keep so the line never moves more than `tolerance_m` meters.

    Douglas-Peucker: join the first and last point; if the point farthest from that line is
    farther than the tolerance, keep it and repeat on both halves. Points on a straight road
    disappear; curves stay. A loop (stack) instead of recursion, so long routes cannot hit
    Python's recursion limit.
    """
    count = len(coordinates)
    if count <= 2:
        return list(range(count))

    # Flat x/y in meters around the route's average latitude: plenty precise for the few
    # kilometers between two points, and much cheaper than spherical math on every comparison.
    meters_per_degree = math.radians(1) * EARTH_RADIUS_M
    shrink = math.cos(math.radians(sum(lat for lat, _ in coordinates) / count))
    xs = [lon * meters_per_degree * shrink for _, lon in coordinates]
    ys = [lat * meters_per_degree for lat, _ in coordinates]
    # Squared distances, so the inner loop needs no square root.
    tolerance_sq = tolerance_m * tolerance_m

    keep = {0, count - 1}
    pending = [(0, count - 1)]
    while pending:
        first, last = pending.pop()
        ax, ay = xs[first], ys[first]
        dx, dy = xs[last] - ax, ys[last] - ay
        length_sq = dx * dx + dy * dy
        farthest, farthest_sq = -1, tolerance_sq
        for i in range(first + 1, last):
            px, py = xs[i] - ax, ys[i] - ay
            # Where the point falls along the segment (0 = first, 1 = last), kept inside it.
            t = (px * dx + py * dy) / length_sq if length_sq else 0.0
            t = 0.0 if t < 0 else 1.0 if t > 1 else t
            ex, ey = px - t * dx, py - t * dy
            distance_sq = ex * ex + ey * ey
            if distance_sq > farthest_sq:
                farthest, farthest_sq = i, distance_sq
        if farthest != -1:
            keep.add(farthest)
            pending.append((first, farthest))
            pending.append((farthest, last))
    return sorted(keep)

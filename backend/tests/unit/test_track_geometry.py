import pytest

from app.domain.track_geometry import douglas_peucker, haversine_m


def test_one_degree_of_latitude_is_about_111_km():
    assert haversine_m((4.0, -74.0), (5.0, -74.0)) == pytest.approx(111_195, rel=1e-3)


def test_the_same_point_is_zero_meters_away():
    assert haversine_m((4.65, -74.05), (4.65, -74.05)) == 0


def test_points_on_a_straight_road_are_dropped():
    # Five points on one meridian, about 111 m apart: only the ends are needed.
    line = [(4.0 + i * 0.001, -74.0) for i in range(5)]
    assert douglas_peucker(line, tolerance_m=5) == [0, 4]


def test_a_corner_is_kept():
    # East 2 points, then north 2 points: an "L" whose corner is index 2.
    route = [(4.0, -74.0), (4.0, -73.999), (4.0, -73.998), (4.001, -73.998), (4.002, -73.998)]
    assert douglas_peucker(route, tolerance_m=5) == [0, 2, 4]


def test_a_bump_smaller_than_the_tolerance_is_smoothed_away():
    # The middle point is about 2 m off the line: noise, not a turn.
    route = [(4.0, -74.0), (4.00002, -73.9995), (4.0, -73.999)]
    assert douglas_peucker(route, tolerance_m=5) == [0, 2]
    assert douglas_peucker(route, tolerance_m=1) == [0, 1, 2]


@pytest.mark.parametrize("count", [0, 1, 2])
def test_very_short_lines_are_returned_whole(count):
    line = [(4.0, -74.0 + i * 0.001) for i in range(count)]
    assert douglas_peucker(line, tolerance_m=5) == list(range(count))


def test_a_zigzag_wider_than_the_tolerance_keeps_every_point():
    zigzag = [(4.0 + (i % 2) * 0.001, -74.0 + i * 0.001) for i in range(300)]
    assert douglas_peucker(zigzag, tolerance_m=5) == list(range(300))

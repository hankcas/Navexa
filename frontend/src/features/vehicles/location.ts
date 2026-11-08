import type { Vehicle } from './types'

/** A vehicle whose position is known. Kept apart from the map code so it does not pull in Leaflet. */
export interface LocatedVehicle extends Vehicle {
  position: NonNullable<Vehicle['position']>
}

/** Vehicles without a valid position cannot be drawn; the map tells the user how many. */
export function withPosition(vehicles: Vehicle[]): LocatedVehicle[] {
  return vehicles.filter((vehicle): vehicle is LocatedVehicle => vehicle.position !== null)
}

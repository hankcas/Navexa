import type L from 'leaflet'
import { describe, expect, it } from 'vitest'

import { withPosition, type LocatedVehicle } from '../location'
import type { Vehicle } from '../types'
import { clusterIcon, vehicleIcon } from './markers'

const moving: LocatedVehicle = {
  id: 1,
  name: 'Camión 01',
  status: 'moving',
  speed_kmh: 50,
  last_update: '2026-11-07T15:30:00Z',
  position: { latitude: 4.65, longitude: -74.05, altitude_m: null, heading: 135, satellites: null },
  driver: null,
}

function markerElement(icon: L.DivIcon): HTMLElement {
  return icon.options.html as HTMLElement
}

describe('withPosition', () => {
  it('keeps only vehicles that can be drawn', () => {
    const lost: Vehicle = { ...moving, id: 2, position: null }
    expect(withPosition([moving, lost]).map((v) => v.id)).toEqual([1])
  })
})

describe('vehicleIcon', () => {
  it('points a moving vehicle in its heading', () => {
    const arrow = markerElement(vehicleIcon(moving, false)).firstElementChild as HTMLElement
    expect(arrow.style.transform).toBe('rotate(135deg)')
  })

  it('draws no arrow for a stopped vehicle', () => {
    const stopped: LocatedVehicle = { ...moving, status: 'stopped' }
    expect(markerElement(vehicleIcon(stopped, false)).childElementCount).toBe(0)
  })

  it('draws no arrow when the heading is unknown', () => {
    const noHeading: LocatedVehicle = { ...moving, position: { ...moving.position, heading: null } }
    expect(markerElement(vehicleIcon(noHeading, false)).childElementCount).toBe(0)
  })

  it('marks the selected vehicle with an extra class', () => {
    const normal = vehicleIcon(moving, false).options.className!.split(' ')
    const selected = vehicleIcon(moving, true).options.className!.split(' ')
    expect(selected.length).toBe(normal.length + 1)
  })
})

describe('clusterIcon', () => {
  it('shows how many vehicles the cluster groups, bigger for larger groups', () => {
    const small = clusterIcon({ getChildCount: () => 4 } as L.MarkerCluster)
    const large = clusterIcon({ getChildCount: () => 65 } as L.MarkerCluster)

    expect((small.options.html as HTMLElement).textContent).toBe('4')
    expect((large.options.html as HTMLElement).textContent).toBe('65')
    expect((large.options.iconSize as [number, number])[0]).toBeGreaterThan(
      (small.options.iconSize as [number, number])[0],
    )
  })
})

// Adds MarkerCluster and MarkerClusterGroup to Leaflet's types; no code is added to the bundle.
/// <reference types="leaflet.markercluster" />
import L from 'leaflet'

import type { LocatedVehicle } from '../location'
import type { VehicleStatus } from '../types'
import styles from './VehiclesMap.module.css'

const STATUS_CLASS: Record<VehicleStatus, string> = {
  moving: styles.moving,
  stopped: styles.stopped,
  offline: styles.offline,
  no_position: styles.stopped,
}

const MARKER_SIZE = 28

/**
 * Builds the marker as a DOM element. The heading arrow is rotated through element.style, which the
 * Content-Security-Policy allows; a style="" attribute inside an HTML string would be blocked.
 */
export function vehicleIcon(vehicle: LocatedVehicle, selected: boolean): L.DivIcon {
  const marker = document.createElement('span')
  marker.className = styles.markerBody

  const heading = vehicle.position.heading
  if (vehicle.status === 'moving' && heading !== null) {
    const arrow = document.createElement('span')
    arrow.className = styles.arrow
    arrow.style.transform = `rotate(${heading}deg)`
    marker.append(arrow)
  }

  return L.divIcon({
    html: marker,
    className: [styles.marker, STATUS_CLASS[vehicle.status], selected && styles.selected]
      .filter(Boolean)
      .join(' '),
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    popupAnchor: [0, -MARKER_SIZE / 2],
  })
}

/** Cluster bubble in the palette instead of the plugin's default green and yellow. */
export function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()
  const size = count < 10 ? 36 : count < 50 ? 42 : 48
  const label = document.createElement('span')
  label.textContent = String(count)
  return L.divIcon({
    html: label,
    className: styles.cluster,
    iconSize: [size, size],
  })
}

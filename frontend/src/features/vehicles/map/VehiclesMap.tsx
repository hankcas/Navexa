import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'

import L from 'leaflet'
import { useEffect, useRef, type RefObject } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'

import { formatDateTime, formatRelative, formatSpeed, headingToCardinal } from '../format'
import type { LocatedVehicle } from '../location'
import { StatusBadge } from '../StatusBadge'
import { clusterIcon, vehicleIcon } from './markers'
import styles from './VehiclesMap.module.css'

/** Bogotá, used only until the first vehicles arrive. */
const DEFAULT_CENTER: L.LatLngExpression = [4.711, -74.0721]
const DEFAULT_ZOOM = 6

export type SelectionSource = 'list' | 'map'

export interface VehiclesMapProps {
  vehicles: LocatedVehicle[]
  selectedId: number | null
  selectionSource: SelectionSource | null
  onSelect: (id: number) => void
}

/**
 * Leaflet measures its container once. On phones the map starts hidden behind the list, so it
 * must measure again when it becomes visible or the tiles come out cut.
 */
function ResizeWatcher() {
  const map = useMap()

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  return null
}

/** Zooms to fit every vehicle the first time they load; later refreshes keep the user's view. */
function FitToVehicles({ vehicles }: { vehicles: LocatedVehicle[] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current || vehicles.length === 0) return
    const bounds = L.latLngBounds(vehicles.map((v) => [v.position.latitude, v.position.longitude]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    fitted.current = true
  }, [map, vehicles])

  return null
}

interface FocusSelectedProps {
  selectedId: number | null
  selectionSource: SelectionSource | null
  markers: RefObject<Map<number, L.Marker>>
  cluster: RefObject<L.MarkerClusterGroup | null>
}

/** A vehicle chosen in the list: open its cluster, zoom to it and show its popup (RF-15). */
function FocusSelected({ selectedId, selectionSource, markers, cluster }: FocusSelectedProps) {
  const map = useMap()

  useEffect(() => {
    if (selectionSource !== 'list' || selectedId === null) return
    const marker = markers.current.get(selectedId)
    if (!marker || !cluster.current) return
    // On phones the map has just become visible: measure it before zooming.
    map.invalidateSize()
    cluster.current.zoomToShowLayer(marker, () => marker.openPopup())
  }, [map, selectedId, selectionSource, markers, cluster])

  return null
}

export function VehiclesMap({ vehicles, selectedId, selectionSource, onSelect }: VehiclesMapProps) {
  const clusterRef = useRef<L.MarkerClusterGroup>(null)
  const markerRefs = useRef(new Map<number, L.Marker>())

  return (
    <MapContainer
      className={styles.map}
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      aria-label="Mapa de vehículos"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ResizeWatcher />
      <FitToVehicles vehicles={vehicles} />
      <FocusSelected
        selectedId={selectedId}
        selectionSource={selectionSource}
        markers={markerRefs}
        cluster={clusterRef}
      />
      <MarkerClusterGroup ref={clusterRef} chunkedLoading iconCreateFunction={clusterIcon}>
        {vehicles.map((vehicle) => {
          const cardinal = headingToCardinal(vehicle.position.heading)
          return (
            <Marker
              key={vehicle.id}
              position={[vehicle.position.latitude, vehicle.position.longitude]}
              icon={vehicleIcon(vehicle, vehicle.id === selectedId)}
              title={vehicle.name}
              alt={vehicle.name}
              ref={(marker) => {
                if (marker) markerRefs.current.set(vehicle.id, marker)
                else markerRefs.current.delete(vehicle.id)
              }}
              eventHandlers={{ click: () => onSelect(vehicle.id) }}
            >
              <Popup>
                <div className={styles.popup}>
                  <p className={styles.popupTitle}>{vehicle.name}</p>
                  <StatusBadge status={vehicle.status} />
                  <dl className={styles.popupData}>
                    <dt>Velocidad</dt>
                    <dd>{formatSpeed(vehicle.speed_kmh)}</dd>
                    <dt>Rumbo</dt>
                    <dd>{cardinal ? cardinal.long : 'Sin dato'}</dd>
                    <dt>Actualizado</dt>
                    <dd title={formatDateTime(vehicle.last_update)}>{formatRelative(vehicle.last_update)}</dd>
                  </dl>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MarkerClusterGroup>
    </MapContainer>
  )
}

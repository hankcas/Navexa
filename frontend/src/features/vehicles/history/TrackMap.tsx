import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'

import { playbackIcon } from '../map/markers'
import type { PlaybackFrame } from './playback'
import { speedRuns, type SpeedBand } from './playback'
import styles from './TrackMap.module.css'
import type { TrackPoint } from './types'

const BAND_CLASS: Record<SpeedBand, string> = {
  stopped: styles.stopped,
  normal: styles.normal,
  fast: styles.fast,
}

export interface TrackMapProps {
  points: TrackPoint[]
  /** Where the playback is; null before the route has two points to play. */
  frame: PlaybackFrame | null
}

/** Leaflet measures its container once; measure again whenever it changes size. */
function ResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

/** Shows the whole route each time a new one loads. */
function FitToRoute({ points }: { points: TrackPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]))
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
  }, [map, points])
  return null
}

export function TrackMap({ points, frame }: TrackMapProps) {
  // Computed once per route: during playback the map re-renders ~60 times per second, and new
  // arrays here would make Leaflet redraw the whole line every time.
  const runs = useMemo(() => speedRuns(points), [points])
  const moving = frame?.moving ?? false
  const heading = frame?.heading ?? null
  // A new icon only when the look changes, not on every frame.
  const icon = useMemo(() => playbackIcon(moving, heading), [moving, heading])
  const first = points[0]
  const last = points.at(-1)

  return (
    <MapContainer
      className={styles.map}
      center={first ? [first.latitude, first.longitude] : [4.711, -74.0721]}
      zoom={13}
      scrollWheelZoom
      aria-label="Mapa del recorrido"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ResizeWatcher />
      <FitToRoute points={points} />
      {runs.map((run, index) => (
        // The color comes from CSS (a class per speed band), so it uses the palette tokens.
        <Polyline key={index} positions={run.positions} pathOptions={{ className: BAND_CLASS[run.band], weight: 5 }} />
      ))}
      {first && (
        <CircleMarker center={[first.latitude, first.longitude]} radius={8} pathOptions={{ className: styles.start }}>
          <Tooltip>Inicio</Tooltip>
        </CircleMarker>
      )}
      {last && points.length > 1 && (
        <CircleMarker center={[last.latitude, last.longitude]} radius={8} pathOptions={{ className: styles.end }}>
          <Tooltip>Fin</Tooltip>
        </CircleMarker>
      )}
      {frame && (
        <Marker position={[frame.latitude, frame.longitude]} icon={icon} title="Vehículo" alt="Vehículo" keyboard={false} />
      )}
    </MapContainer>
  )
}

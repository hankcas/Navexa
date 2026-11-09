import { zodResolver } from '@hookform/resolvers/zod'
import { lazy, Suspense, useEffect, useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'

import { ApiError } from '../../../shared/api/errors'
import { Button } from '../../../shared/ui/Button'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { StateMessage } from '../../../shared/ui/StateMessage'
import { TextField } from '../../../shared/ui/TextField'
import { formatDateTime, formatSpeed, headingToCardinal } from '../format'
import { useVehiclesMap } from '../queries'
import styles from './HistoryPage.module.css'
import { frameAt, SPEED_BANDS } from './playback'
import { useVehicleTrack } from './queries'
import {
  historyFormSchema,
  localInputToDate,
  MAX_RANGE_DAYS,
  presetRange,
  RANGE_PRESETS,
  type HistoryFormValues,
} from './range'
import type { TrackRequest, VehicleTrack } from './types'
import { PLAYBACK_RATES, usePlayback } from './usePlayback'

// Leaflet is heavy: the map loads in its own file, only once there is a route to draw.
const TrackMap = lazy(() => import('./TrackMap').then((module) => ({ default: module.TrackMap })))

const DEFAULT_HOURS = 24
const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

/** URL parameters, in Spanish like the routes: ?vehiculo=…&desde=…&hasta=… */
const PARAM = { vehicle: 'vehiculo', from: 'desde', to: 'hasta' } as const

function requestFromParams(params: URLSearchParams): TrackRequest | null {
  const vehicleId = Number(params.get(PARAM.vehicle))
  const from = localInputToDate(params.get(PARAM.from) ?? '')
  const to = localInputToDate(params.get(PARAM.to) ?? '')
  if (!Number.isInteger(vehicleId) || vehicleId <= 0 || !from || !to) return null
  return { vehicleId, from: from.toISOString(), to: to.toISOString() }
}

/** Route history: pick a vehicle and a range, see the route on the map and play it (RF-24). */
export function HistoryPage() {
  const [params, setParams] = useSearchParams()
  const request = useMemo(() => requestFromParams(params), [params])
  const track = useVehicleTrack(request)
  const vehicles = useVehiclesMap({ search: '', status: null })
  const sorted = useMemo(
    () => [...(vehicles.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [vehicles.data],
  )

  // Coming from a vehicle page (?vehiculo=… only): show its last 24 hours straight away.
  const onlyVehicle = params.has(PARAM.vehicle) && !params.has(PARAM.from) && !params.has(PARAM.to)
  useEffect(() => {
    if (!onlyVehicle) return
    const { from, to } = presetRange(DEFAULT_HOURS)
    setParams((current) => ({ [PARAM.vehicle]: current.get(PARAM.vehicle) ?? '', [PARAM.from]: from, [PARAM.to]: to }), {
      replace: true,
    })
  }, [onlyVehicle, setParams])

  function show(values: HistoryFormValues) {
    setParams({ [PARAM.vehicle]: values.vehicleId, [PARAM.from]: values.from, [PARAM.to]: values.to })
  }

  const defaults = params.has(PARAM.from)
    ? {
        vehicleId: params.get(PARAM.vehicle) ?? '',
        from: params.get(PARAM.from) ?? '',
        to: params.get(PARAM.to) ?? '',
      }
    : { vehicleId: params.get(PARAM.vehicle) ?? '', ...presetRange(DEFAULT_HOURS) }
  const vehicleName = sorted.find((v) => v.id === request?.vehicleId)?.name

  return (
    <>
      <title>Historial de recorrido · Navexa</title>
      <h1 className={styles.title}>Historial de recorrido</h1>

      {/* A new key when the URL changes (back/forward), so the form shows what is in the URL. */}
      <HistoryForm
        key={params.toString()}
        defaults={defaults}
        vehicles={sorted}
        vehiclesLoading={vehicles.isPending}
        searching={track.isFetching}
        onSubmit={show}
      />

      {request === null ? (
        <StateMessage
          title="Elige un vehículo y un rango"
          detail={`Verás su recorrido en el mapa, con la velocidad en cada tramo. Puedes pedir hasta ${MAX_RANGE_DAYS} días.`}
        />
      ) : track.isPending ? (
        <StateMessage loading title="Cargando el recorrido…" detail="Un rango largo puede tardar unos segundos." />
      ) : track.isError ? (
        <StateMessage
          title={
            track.error instanceof ApiError && track.error.status === 404
              ? 'No encontramos este vehículo'
              : 'No pudimos cargar el recorrido'
          }
          detail={track.error instanceof ApiError ? track.error.detail : undefined}
          action={<Button onClick={() => void track.refetch()}>Reintentar</Button>}
        />
      ) : track.data.points.length === 0 ? (
        <StateMessage
          title="No hay posiciones en este rango"
          detail="El vehículo no reportó su ubicación en esas fechas. Prueba con un rango más amplio."
        />
      ) : (
        // A new key per route, so the playback starts from the beginning each time.
        <TrackResult key={`${request.vehicleId}-${request.from}-${request.to}`} track={track.data} name={vehicleName} />
      )}
    </>
  )
}

interface HistoryFormProps {
  defaults: HistoryFormValues
  vehicles: { id: number; name: string }[]
  vehiclesLoading: boolean
  searching: boolean
  onSubmit: (values: HistoryFormValues) => void
}

function HistoryForm({ defaults, vehicles, vehiclesLoading, searching, onSubmit }: HistoryFormProps) {
  const selectId = useId()
  const schema = useMemo(() => historyFormSchema(), [])
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<HistoryFormValues>({ resolver: zodResolver(schema), defaultValues: defaults })

  function applyPreset(hours: number) {
    const { from, to } = presetRange(hours)
    setValue('from', from)
    setValue('to', to)
    if (getValues('vehicleId')) void handleSubmit(onSubmit)()
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Buscar recorrido">
      <div className={styles.field}>
        <label htmlFor={selectId} className={styles.label}>
          Vehículo
        </label>
        <select
          id={selectId}
          className={styles.select}
          aria-invalid={errors.vehicleId ? true : undefined}
          aria-describedby={errors.vehicleId ? `${selectId}-error` : undefined}
          disabled={vehiclesLoading}
          {...register('vehicleId')}
        >
          <option value="">{vehiclesLoading ? 'Cargando vehículos…' : 'Elige un vehículo'}</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name}
            </option>
          ))}
          {/* The vehicle in the URL, while the list is still loading. */}
          {vehiclesLoading && defaults.vehicleId && <option value={defaults.vehicleId}>Vehículo {defaults.vehicleId}</option>}
        </select>
        {errors.vehicleId && (
          <p id={`${selectId}-error`} className={styles.error}>
            {errors.vehicleId.message}
          </p>
        )}
      </div>
      <TextField label="Desde" type="datetime-local" error={errors.from?.message} {...register('from')} />
      <TextField label="Hasta" type="datetime-local" error={errors.to?.message} {...register('to')} />
      <Button type="submit" loading={searching} loadingText="Buscando…">
        Ver recorrido
      </Button>

      <div className={styles.presets} role="group" aria-label="Rangos rápidos">
        {RANGE_PRESETS.map((preset) => (
          <button key={preset.hours} type="button" className={styles.preset} onClick={() => applyPreset(preset.hours)}>
            {preset.label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>Horas de Colombia. Máximo {MAX_RANGE_DAYS} días por consulta.</p>
    </form>
  )
}

function TrackResult({ track, name }: { track: VehicleTrack; name: string | undefined }) {
  const { points, summary } = track
  const times = useMemo(() => points.map((p) => new Date(p.time).getTime()), [points])
  const startMs = times[0]
  const endMs = times.at(-1) ?? startMs
  const playback = usePlayback(startMs, endMs)
  const canPlay = points.length > 1 && endMs > startMs
  const frame = useMemo(() => frameAt(points, times, playback.time), [points, times, playback.time])
  const cardinal = headingToCardinal(frame.heading)
  const now = new Date(frame.time).toISOString()

  return (
    <div className={styles.result}>
      <section className={styles.card} aria-labelledby="summary-title">
        <h2 id="summary-title" className={styles.cardTitle}>
          {name ? `Resumen de ${name}` : 'Resumen'}
        </h2>
        <dl className={styles.summary}>
          <div>
            <dt>Distancia</dt>
            <dd>{numberFormat.format(summary.distance_km)} km</dd>
          </div>
          <div>
            <dt>Velocidad máxima</dt>
            <dd>{formatSpeed(summary.max_speed_kmh)}</dd>
          </div>
          <div>
            <dt>Promedio en movimiento</dt>
            <dd>{summary.average_speed_kmh === null ? 'No se movió' : formatSpeed(summary.average_speed_kmh)}</dd>
          </div>
          <div>
            <dt>Primera posición</dt>
            <dd>{formatDateTime(summary.started_at)}</dd>
          </div>
          <div>
            <dt>Última posición</dt>
            <dd>{formatDateTime(summary.ended_at)}</dd>
          </div>
        </dl>
        <p className={styles.hint}>
          {track.simplified
            ? `El mapa muestra ${numberFormat.format(points.length)} de ${numberFormat.format(track.total_points)} posiciones, sin cambiar la forma del recorrido. Las cifras usan todas.`
            : `${numberFormat.format(track.total_points)} posiciones en el rango.`}
        </p>
      </section>

      <section className={`${styles.card} ${styles.mapCard}`} aria-labelledby="route-title">
        <h2 id="route-title" className={styles.cardTitle}>
          Recorrido
        </h2>
        <div className={styles.map}>
          <ErrorBoundary fallback={<StateMessage title="No pudimos mostrar el mapa" />}>
            <Suspense fallback={<StateMessage loading title="Cargando mapa…" />}>
              <TrackMap points={points} frame={canPlay ? frame : null} />
            </Suspense>
          </ErrorBoundary>
        </div>
        <ul className={styles.legend} aria-label="Colores de la línea">
          {SPEED_BANDS.map(({ band, label }) => (
            <li key={band}>
              <span className={`${styles.swatch} ${styles[band]}`} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        {canPlay && (
          <div className={styles.player} role="group" aria-label="Reproducción del recorrido">
            <div className={styles.controls}>
              <Button onClick={playback.playing ? playback.pause : playback.play} className={styles.playButton}>
                {playback.playing ? 'Pausar' : 'Reproducir'}
              </Button>
              <label className={styles.rate}>
                <span className={styles.label}>Velocidad de reproducción</span>
                <select
                  className={styles.select}
                  value={playback.rate}
                  onChange={(event) => playback.setRate(Number(event.target.value))}
                >
                  {PLAYBACK_RATES.map(({ rate, label }) => (
                    <option key={rate} value={rate}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.timeline}>
              <span className={styles.label}>Momento del recorrido</span>
              <input
                type="range"
                min={startMs}
                max={endMs}
                step={1000}
                value={playback.time}
                aria-valuetext={formatDateTime(now)}
                onChange={(event) => {
                  playback.pause()
                  playback.seek(Number(event.target.value))
                }}
              />
            </label>
            <dl className={styles.readout}>
              <div>
                <dt>Hora</dt>
                <dd>{formatDateTime(now)}</dd>
              </div>
              <div>
                <dt>Velocidad</dt>
                <dd>{formatSpeed(frame.speed_kmh)}</dd>
              </div>
              <div>
                <dt>Rumbo</dt>
                <dd>{frame.moving && cardinal ? cardinal.long : 'Detenido'}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </div>
  )
}

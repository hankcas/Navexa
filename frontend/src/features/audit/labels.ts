import { roleLabel } from '../auth/roles'
import type { AuditCategory, AuditEntry } from './types'

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: 'Sesiones',
  users: 'Usuarios',
  vehicles: 'Vehículos',
  drivers: 'Conductores',
  passengers: 'Pasajeros',
}

/** Every action the backend records, in plain Spanish. An unknown one is shown as it comes. */
const ACTION_LABELS: Record<string, string> = {
  'auth.login_success': 'Inició sesión',
  'auth.login_failed': 'Intento fallido de inicio de sesión',
  'auth.logout': 'Cerró sesión',
  'auth.password_changed': 'Cambió su contraseña',
  'users.created': 'Creó un usuario',
  'users.updated': 'Editó un usuario',
  'users.password_reset': 'Restableció la contraseña de un usuario',
  'vehicles.custom_field_created': 'Agregó un campo a un vehículo',
  'vehicles.custom_field_updated': 'Editó un campo de un vehículo',
  'vehicles.custom_field_deleted': 'Eliminó un campo de un vehículo',
  'vehicles.exported': 'Descargó el CSV de vehículos',
  'drivers.created': 'Creó un conductor',
  'drivers.updated': 'Editó un conductor',
  'drivers.deleted': 'Eliminó un conductor',
  'drivers.vehicle_assigned': 'Asignó un vehículo a un conductor',
  'drivers.vehicle_unassigned': 'Quitó el vehículo a un conductor',
  'drivers.exported': 'Descargó el CSV de conductores',
  'passengers.created': 'Creó un pasajero',
  'passengers.updated': 'Editó un pasajero',
  'passengers.deleted': 'Eliminó un pasajero',
  'passengers.vehicle_assigned': 'Asignó un vehículo a un pasajero',
  'passengers.vehicle_unassigned': 'Quitó el vehículo a un pasajero',
  'passengers.exported': 'Descargó el CSV de pasajeros',
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

const FAILURE_REASONS: Record<string, string> = {
  unknown_email: 'el correo no existe',
  wrong_password: 'contraseña incorrecta',
  locked: 'cuenta bloqueada',
  inactive: 'usuario inactivo',
}

const CHANGE_LABELS: Record<string, string> = {
  full_name: 'nombre',
  role: 'rol',
  is_active: 'estado',
  name: 'nombre',
  code: 'código',
  phone: 'teléfono',
  description: 'descripción',
  custom_fields: 'campos personalizados',
}

const FILTER_LABELS: Record<string, string> = {
  search: 'búsqueda',
  status: 'estado',
  assigned: 'con vehículo',
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * The details each action saved, as one short sentence. Every shape the backend writes has its
 * own sentence; anything else falls back to "key: value", so nothing recorded is hidden.
 */
export function describeDetails(entry: AuditEntry): string {
  const details = entry.details
  if (!details || Object.keys(details).length === 0) return ''

  if (typeof details.reason === 'string') return `Motivo: ${FAILURE_REASONS[details.reason] ?? details.reason}`
  if (typeof details.rows === 'number') {
    const filters = Object.entries((details.filters as Record<string, unknown> | undefined) ?? {})
    const applied = filters.map(([name, value]) => `${FILTER_LABELS[name] ?? name}: ${text(value)}`)
    return `${details.rows} filas${applied.length ? ` · Filtros: ${applied.join(', ')}` : ''}`
  }
  if (typeof details.email === 'string' && typeof details.role === 'string') {
    return `${details.email} (${roleLabel(details.role)})`
  }
  if (typeof details.field === 'string') return `Campo «${details.field}»`
  if (Array.isArray(details.fields)) {
    return `Cambió: ${details.fields.map((name) => CHANGE_LABELS[String(name)] ?? String(name)).join(', ')}`
  }
  if (typeof details.name === 'string') return `«${details.name}»`
  if ('vehicle_id' in details) return `Vehículo ${text(details.vehicle_id)}`

  return Object.entries(details)
    .map(([name, value]) => {
      if (name === 'role' && value && typeof value === 'object') {
        const change = value as { from?: string; to?: string }
        return `rol: ${roleLabel(change.from ?? '')} → ${roleLabel(change.to ?? '')}`
      }
      return `${CHANGE_LABELS[name] ?? name}: ${text(value)}`
    })
    .join(' · ')
}

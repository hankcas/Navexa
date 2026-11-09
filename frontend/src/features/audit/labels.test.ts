import { describe, expect, it } from 'vitest'

import { actionLabel, describeDetails } from './labels'
import type { AuditEntry } from './types'

function entry(action: string, details: Record<string, unknown> | null): AuditEntry {
  return {
    id: 1,
    created_at: '2026-11-08T15:00:00Z',
    actor_email: 'admin@navexa.co',
    action,
    entity_type: null,
    entity_id: null,
    details,
    ip_address: null,
  }
}

describe('audit labels', () => {
  it('names each action in Spanish and shows unknown ones as they come', () => {
    expect(actionLabel('drivers.vehicle_assigned')).toBe('Asignó un vehículo a un conductor')
    expect(actionLabel('vehicles.exported')).toBe('Descargó el CSV de vehículos')
    expect(actionLabel('reports.created')).toBe('reports.created')
  })

  it('turns each kind of details into a short sentence', () => {
    expect(describeDetails(entry('auth.login_failed', { reason: 'wrong_password' }))).toBe(
      'Motivo: contraseña incorrecta',
    )
    expect(describeDetails(entry('vehicles.exported', { rows: 62, filters: { status: 'moving' } }))).toBe(
      '62 filas · Filtros: estado: moving',
    )
    expect(describeDetails(entry('users.created', { email: 'op@navexa.co', role: 'operator' }))).toBe(
      'op@navexa.co (Operador)',
    )
    expect(describeDetails(entry('vehicles.custom_field_created', { field: 'Placa' }))).toBe('Campo «Placa»')
    expect(describeDetails(entry('drivers.updated', { fields: ['phone', 'custom_fields'] }))).toBe(
      'Cambió: teléfono, campos personalizados',
    )
    expect(describeDetails(entry('drivers.deleted', { name: 'Ana' }))).toBe('«Ana»')
    expect(describeDetails(entry('drivers.vehicle_unassigned', { vehicle_id: 500 }))).toBe('Vehículo 500')
  })

  it('describes a user edit change by change', () => {
    expect(
      describeDetails(entry('users.updated', { role: { from: 'viewer', to: 'admin' }, is_active: false })),
    ).toBe('rol: Visualizador → Administrador · estado: no')
  })

  it('has nothing to say when nothing was saved', () => {
    expect(describeDetails(entry('auth.logout', null))).toBe('')
    expect(describeDetails(entry('auth.logout', {}))).toBe('')
  })
})

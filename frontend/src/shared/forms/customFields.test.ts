import { describe, expect, it } from 'vitest'

import { customFieldRowsSchema, recordFromRows, rowsFromRecord } from './customFields'

describe('custom field rows', () => {
  it('converts between the API object and form rows', () => {
    const rows = rowsFromRecord({ documento: '123', ruta: 'Norte' })
    expect(rows).toEqual([
      { name: 'documento', value: '123' },
      { name: 'ruta', value: 'Norte' },
    ])
    expect(recordFromRows(rows)).toEqual({ documento: '123', ruta: 'Norte' })
  })

  it('trims names and values when building the object', () => {
    expect(recordFromRows([{ name: ' ruta ', value: ' Sur ' }])).toEqual({ ruta: 'Sur' })
  })

  it('requires a name and rejects repeated names ignoring case', () => {
    const result = customFieldRowsSchema.safeParse([
      { name: '', value: 'x' },
      { name: 'Ruta', value: 'A' },
      { name: 'ruta ', value: 'B' },
    ])
    expect(result.success).toBe(false)
    const messages = result.error!.issues.map((issue) => [issue.path.join('.'), issue.message])
    expect(messages).toContainEqual(['0.name', 'Escribe el nombre del campo.'])
    expect(messages).toContainEqual(['2.name', 'Este campo está repetido.'])
  })

  it('limits the number of fields like the backend', () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ name: `campo${i}`, value: '' }))
    expect(customFieldRowsSchema.safeParse(rows).success).toBe(false)
  })
})

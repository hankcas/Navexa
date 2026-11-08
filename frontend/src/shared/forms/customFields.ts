import { z } from 'zod'

/** Same limits as backend/app/schemas/custom_fields.py. */
export const MAX_CUSTOM_FIELDS = 20

export interface CustomFieldRow {
  name: string
  value: string
}

/** The API sends custom fields as an object; the form edits them as rows. */
export function rowsFromRecord(record: Record<string, string>): CustomFieldRow[] {
  return Object.entries(record).map(([name, value]) => ({ name, value }))
}

export function recordFromRows(rows: CustomFieldRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.name.trim(), row.value.trim()]))
}

export const customFieldRowsSchema = z
  .array(
    z.object({
      name: z
        .string()
        .trim()
        .min(1, 'Escribe el nombre del campo.')
        .max(50, 'Máximo 50 caracteres.'),
      value: z.string().trim().max(200, 'Máximo 200 caracteres.'),
    }),
  )
  .max(MAX_CUSTOM_FIELDS, `Se permiten como máximo ${MAX_CUSTOM_FIELDS} campos.`)
  .superRefine((rows, ctx) => {
    const seen = new Set<string>()
    rows.forEach((row, index) => {
      const key = row.name.trim().toLowerCase()
      if (key && seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: [index, 'name'], message: 'Este campo está repetido.' })
      }
      seen.add(key)
    })
  })

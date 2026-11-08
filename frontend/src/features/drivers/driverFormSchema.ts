import { z } from 'zod'

import { customFieldRowsSchema } from '../../shared/forms/customFields'

/** Same rules as backend/app/schemas/driver.py (RF-18). */
export const driverFormSchema = z.object({
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(80, 'Máximo 80 caracteres.'),
  code: z.string().trim().max(32, 'Máximo 32 caracteres.'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\+?\d{7,15}$/.test(value), {
      message: 'Entre 7 y 15 dígitos, con + opcional al inicio. Ejemplo: +573001234567',
    }),
  description: z.string().trim().max(200, 'Máximo 200 caracteres.'),
  custom_fields: customFieldRowsSchema,
})

export type DriverFormInput = z.input<typeof driverFormSchema>
export type DriverFormValues = z.output<typeof driverFormSchema>

import { z } from 'zod'

import { customFieldRowsSchema } from '../../shared/forms/customFields'

/** Same rules as backend/app/schemas/passenger.py (RF-28). */
export const passengerFormSchema = z.object({
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(80, 'Máximo 80 caracteres.'),
  code: z.string().trim().max(32, 'Máximo 32 caracteres.'),
  custom_fields: customFieldRowsSchema,
})

export type PassengerFormInput = z.input<typeof passengerFormSchema>
export type PassengerFormValues = z.output<typeof passengerFormSchema>

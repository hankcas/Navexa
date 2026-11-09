import { z } from 'zod'

const ROLES = ['admin', 'operator', 'viewer'] as const

/** Same rules as UserCreate / UserUpdate in backend/app/schemas/user.py. */
export const userFormSchema = z.object({
  email: z.string().trim().min(1, 'Escribe el correo.').pipe(z.email('Escribe un correo válido.')),
  full_name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
  role: z.enum(ROLES, { error: 'Elige un rol.' }),
})

export type UserFormInput = z.input<typeof userFormSchema>
export type UserFormValues = z.output<typeof userFormSchema>

import { z } from 'zod'

/** Same rules as backend/app/domain/password_policy.py. The backend validates again. */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

interface PasswordRule {
  label: string
  message: string
  test: (value: string) => boolean
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    message: `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: 'Una letra minúscula',
    message: 'Debe incluir al menos una letra minúscula.',
    test: (value) => /[a-z]/.test(value),
  },
  {
    label: 'Una letra mayúscula',
    message: 'Debe incluir al menos una letra mayúscula.',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    label: 'Un número',
    message: 'Debe incluir al menos un número.',
    test: (value) => /\d/.test(value),
  },
  {
    label: 'Un símbolo, como ! # $ o %',
    message: 'Debe incluir al menos un símbolo.',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
]

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').pipe(z.email('Escribe un correo válido.')),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Escribe tu contraseña actual.'),
    new_password: z
      .string()
      .max(PASSWORD_MAX_LENGTH, `Debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres.`)
      .superRefine((value, ctx) => {
        for (const rule of PASSWORD_RULES) {
          if (!rule.test(value)) ctx.addIssue({ code: 'custom', message: rule.message })
        }
      }),
    confirm_password: z.string().min(1, 'Confirma la nueva contraseña.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Las contraseñas no coinciden.',
  })
  .refine((data) => data.new_password !== data.current_password, {
    path: ['new_password'],
    message: 'La nueva contraseña debe ser diferente a la actual.',
  })

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormValues = z.output<typeof loginSchema>
export type ChangePasswordFormInput = z.input<typeof changePasswordSchema>
export type ChangePasswordFormValues = z.output<typeof changePasswordSchema>

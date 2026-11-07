import { describe, expect, it } from 'vitest'

import { changePasswordSchema, loginSchema } from './schemas'

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? []
}

describe('loginSchema', () => {
  it('asks for the email and the password when they are empty', () => {
    expect(messages(loginSchema.safeParse({ email: '', password: '' }))).toEqual([
      'Escribe tu correo.',
      'Escribe tu contraseña.',
    ])
  })

  it('rejects an invalid email', () => {
    expect(messages(loginSchema.safeParse({ email: 'admin', password: 'x' }))).toEqual([
      'Escribe un correo válido.',
    ])
  })

  it('trims spaces around the email', () => {
    const result = loginSchema.parse({ email: '  admin@navexa.co  ', password: 'x' })
    expect(result.email).toBe('admin@navexa.co')
  })
})

describe('changePasswordSchema', () => {
  const valid = {
    current_password: 'Temporal-2026!',
    new_password: 'Nueva-Clave-2026!',
    confirm_password: 'Nueva-Clave-2026!',
  }

  it('accepts a password that follows the backend policy', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['Corta-1!', 'Debe tener al menos 12 caracteres.'],
    ['SOLO-MAYUSCULAS-1', 'Debe incluir al menos una letra minúscula.'],
    ['solo-minusculas-1', 'Debe incluir al menos una letra mayúscula.'],
    ['Sin-Numeros-Aqui', 'Debe incluir al menos un número.'],
    ['SinSimbolos2026', 'Debe incluir al menos un símbolo.'],
  ])('rejects "%s" with "%s"', (password, expected) => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      new_password: password,
      confirm_password: password,
    })
    expect(messages(result)).toContain(expected)
  })

  it('requires the confirmation to match', () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirm_password: 'Otra-Clave-2026!' })
    expect(messages(result)).toEqual(['Las contraseñas no coinciden.'])
  })

  it('rejects reusing the current password', () => {
    const same = 'Temporal-2026!'
    const result = changePasswordSchema.safeParse({
      current_password: same,
      new_password: same,
      confirm_password: same,
    })
    expect(messages(result)).toEqual(['La nueva contraseña debe ser diferente a la actual.'])
  })
})

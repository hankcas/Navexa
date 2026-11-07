/** Mirrors CurrentUser in backend/app/schemas/auth.py. */
export interface CurrentUser {
  id: number
  email: string
  full_name: string
  role: string
  permissions: string[]
  must_change_password: boolean
}

export interface LoginInput {
  email: string
  password: string
}

export interface ChangePasswordInput {
  current_password: string
  new_password: string
}

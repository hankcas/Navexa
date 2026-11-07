/** Spanish labels for the role codes defined in backend/app/domain/permissions.py. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export type ApiErrorKind = 'response' | 'unavailable' | 'interrupted'

export interface FieldError {
  field: string
  message: string
}

interface ApiErrorInit {
  kind: ApiErrorKind
  status: number
  title: string
  detail: string
  fieldErrors?: FieldError[]
}

/**
 * Single error type for every failed API call, so the UI only needs one way to show errors.
 * - response: the backend answered with an error (Problem Details, RFC 7807).
 * - unavailable: the backend could not be reached, even after waiting for it to wake up.
 * - interrupted: the connection dropped while saving, so we cannot know if the change was applied.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  readonly title: string
  readonly detail: string
  readonly fieldErrors: FieldError[]

  constructor(init: ApiErrorInit) {
    super(init.detail)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status
    this.title = init.title
    this.detail = init.detail
    this.fieldErrors = init.fieldErrors ?? []
  }
}

const UNEXPECTED_TITLE = 'Error inesperado'
const UNEXPECTED_DETAIL = 'Ocurrió un error inesperado. Intenta de nuevo.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseFieldErrors(value: unknown): FieldError[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is FieldError =>
      isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string',
  )
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // The body was not JSON; the generic message below is used instead.
  }
  const problem = isRecord(body) ? body : {}

  return new ApiError({
    kind: 'response',
    status: response.status,
    title: typeof problem.title === 'string' ? problem.title : UNEXPECTED_TITLE,
    detail: typeof problem.detail === 'string' ? problem.detail : UNEXPECTED_DETAIL,
    fieldErrors: parseFieldErrors(problem.errors),
  })
}

export function serverUnavailableError(): ApiError {
  return new ApiError({
    kind: 'unavailable',
    status: 0,
    title: 'Servidor no disponible',
    detail: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
  })
}

export function interruptedRequestError(): ApiError {
  return new ApiError({
    kind: 'interrupted',
    status: 0,
    title: 'Conexión interrumpida',
    detail:
      'Se perdió la conexión mientras se guardaban los cambios. Revisa si se aplicaron antes de intentarlo de nuevo.',
  })
}

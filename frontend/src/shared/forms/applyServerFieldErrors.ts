import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '../api/errors'

/**
 * Shows the backend validation errors (422 Problem Details) under their inputs.
 * Pydantic prefixes custom messages with "Value error, ", which is removed here.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  if (!(error instanceof ApiError)) return
  for (const { field, message } of error.fieldErrors) {
    const target = fields.find((name) => name === field)
    if (target) setError(target, { message: message.replace(/^Value error, /, '') })
  }
}

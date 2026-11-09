import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiRequest } from '../../../shared/api/client'
import { POLL_INTERVAL_MS, vehicleKeys } from '../queries'
import type { CustomField, CustomFieldInput, VehicleDetail } from './types'

export const vehicleDetailKey = (id: number) => [...vehicleKeys.all, 'detail', id] as const

export function useVehicleDetail(id: number) {
  return useQuery({
    queryKey: vehicleDetailKey(id),
    queryFn: () => apiRequest<VehicleDetail>(`/vehicles/${id}`),
    refetchInterval: POLL_INTERVAL_MS,
  })
}

interface UpdateVariables {
  field: CustomField
  input: CustomFieldInput
}

/**
 * Custom field changes are applied to the screen before Wialon answers (optimistic update,
 * RF-21). If Wialon refuses, the previous values come back (rollback) and the error is shown.
 */
export function useCustomFieldMutations(vehicleId: number) {
  const queryClient = useQueryClient()
  const key = vehicleDetailKey(vehicleId)
  const fieldsPath = `/vehicles/${vehicleId}/custom-fields`

  function replaceFields(change: (fields: CustomField[]) => CustomField[]) {
    queryClient.setQueryData<VehicleDetail>(key, (detail) =>
      detail ? { ...detail, custom_fields: change(detail.custom_fields) } : detail,
    )
  }

  /** What the screen showed before the change, to put it back if Wialon refuses it. */
  interface Snapshot {
    previous: VehicleDetail | undefined
  }

  async function snapshot(): Promise<Snapshot> {
    // Stop a refresh in flight from overwriting the optimistic value.
    await queryClient.cancelQueries({ queryKey: key })
    return { previous: queryClient.getQueryData<VehicleDetail>(key) }
  }

  function rollback(_error: unknown, _variables: unknown, context: Snapshot | undefined) {
    if (context?.previous) queryClient.setQueryData(key, context.previous)
  }

  // Reload from Wialon after every change, without waiting: if onSettled returned this promise,
  // React Query would hold back the success or error shown on screen until the reload ends.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key })
  }

  return {
    update: useMutation({
      mutationFn: ({ field, input }: UpdateVariables) =>
        apiRequest<CustomField>(`${fieldsPath}/${field.id}`, {
          method: 'PATCH',
          body: { ...input, expected_modified_at: field.modified_at },
        }),
      onMutate: async ({ field, input }) => {
        const previous = await snapshot()
        replaceFields((fields) => fields.map((f) => (f.id === field.id ? { ...f, ...input } : f)))
        return previous
      },
      onError: rollback,
      onSuccess: (saved) => replaceFields((fields) => fields.map((f) => (f.id === saved.id ? saved : f))),
      onSettled: refresh,
    }),

    create: useMutation({
      mutationFn: (input: CustomFieldInput) =>
        apiRequest<CustomField>(fieldsPath, { method: 'POST', body: input }),
      onSuccess: (created) => replaceFields((fields) => [...fields, created]),
      onSettled: refresh,
    }),

    remove: useMutation({
      mutationFn: (field: CustomField) =>
        apiRequest<void>(`${fieldsPath}/${field.id}`, { method: 'DELETE' }),
      onMutate: async (field) => {
        const previous = await snapshot()
        replaceFields((fields) => fields.filter((f) => f.id !== field.id))
        return previous
      },
      onError: rollback,
      onSettled: refresh,
    }),
  }
}

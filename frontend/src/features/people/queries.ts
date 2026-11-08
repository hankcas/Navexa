import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { vehicleKeys } from '../vehicles/queries'
import type { PeopleApi } from './api'
import type { PeopleFilters, Person } from './types'

/** Which list a hook works on: its cache key ("drivers" or "passengers") and its API client. */
export interface PeopleResource<T extends Person, Input> {
  key: 'drivers' | 'passengers'
  api: PeopleApi<T, Input>
}

export function usePeoplePage<T extends Person, Input>(
  resource: PeopleResource<T, Input>,
  filters: PeopleFilters,
) {
  return useQuery({
    queryKey: [resource.key, 'list', filters],
    queryFn: () => resource.api.list(filters),
    placeholderData: keepPreviousData,
  })
}

/**
 * Every change goes through Wialon, so after it succeeds the cached lists are refetched: the
 * people list, and the vehicles, which show the assigned driver.
 */
export function usePeopleMutations<T extends Person, Input>(resource: PeopleResource<T, Input>) {
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [resource.key] }),
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
    ])

  const options = { onSuccess: refresh }
  return {
    create: useMutation({ mutationFn: (input: Input) => resource.api.create(input), ...options }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<Input> }) => resource.api.update(id, input),
      ...options,
    }),
    remove: useMutation({ mutationFn: (id: string) => resource.api.remove(id), ...options }),
    assign: useMutation({
      mutationFn: ({ id, vehicleId }: { id: string; vehicleId: number }) =>
        resource.api.assignVehicle(id, vehicleId),
      ...options,
    }),
    unassign: useMutation({ mutationFn: (id: string) => resource.api.unassignVehicle(id), ...options }),
  }
}

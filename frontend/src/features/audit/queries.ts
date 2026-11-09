import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { apiRequest } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'
import type { AuditEntry, AuditFilters } from './types'

export const AUDIT_PAGE_SIZE = 20

export function auditPath({ category, search, page }: AuditFilters): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(AUDIT_PAGE_SIZE) })
  if (category) params.set('category', category)
  const term = search.trim()
  if (term) params.set('search', term)
  return `/audit?${params}`
}

export function useAuditPage(filters: AuditFilters) {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => apiRequest<Page<AuditEntry>>(auditPath(filters)),
    // The current rows stay while the next page or filter loads.
    placeholderData: keepPreviousData,
  })
}

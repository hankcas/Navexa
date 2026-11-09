import { useSearchParams } from 'react-router-dom'

import { ApiError } from '../../shared/api/errors'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Button } from '../../shared/ui/Button'
import { Pagination } from '../../shared/ui/Pagination'
import { StateMessage } from '../../shared/ui/StateMessage'
import { TextField } from '../../shared/ui/TextField'
import pageStyles from '../people/PeoplePage.module.css'
import tableStyles from '../people/PeopleTable.module.css'
import { formatDateTime } from '../vehicles/format'
import styles from './AuditPage.module.css'
import { actionLabel, CATEGORY_LABELS, describeDetails } from './labels'
import { useAuditPage } from './queries'
import type { AuditCategory, AuditFilters } from './types'

const SEARCH_DELAY_MS = 300
const CATEGORIES = Object.keys(CATEGORY_LABELS) as AuditCategory[]

function parseCategory(value: string | null): AuditCategory | null {
  return CATEGORIES.includes(value as AuditCategory) ? (value as AuditCategory) : null
}

/** Who did what and when, newest first. Only for roles with audit:read (RF-26). */
export function AuditPage() {
  const [params, setParams] = useSearchParams()
  const filters: AuditFilters = {
    category: parseCategory(params.get('categoria')),
    search: params.get('buscar') ?? '',
    page: Math.max(1, Number(params.get('pagina')) || 1),
  }
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DELAY_MS)
  const entries = useAuditPage({ ...filters, search: debouncedSearch })
  const hasFilters = Boolean(filters.category || filters.search)

  // Filters live in the URL (?categoria=&buscar=&pagina=), like on the other lists.
  function update(changes: Partial<AuditFilters>) {
    const next = { ...filters, ...changes }
    if (changes.category !== undefined || changes.search !== undefined) next.page = 1
    const nextParams = new URLSearchParams()
    if (next.category) nextParams.set('categoria', next.category)
    if (next.search.trim()) nextParams.set('buscar', next.search)
    if (next.page > 1) nextParams.set('pagina', String(next.page))
    setParams(nextParams, { replace: true })
  }

  return (
    <>
      <title>Auditoría · Navexa</title>
      <header className={pageStyles.header}>
        <div>
          <h1 className={pageStyles.title}>Auditoría</h1>
          {entries.data && (
            <p className={pageStyles.total} aria-live="polite">
              {entries.data.total} {entries.data.total === 1 ? 'registro' : 'registros'}
              {entries.isFetching && <span className={pageStyles.updating}> · Actualizando…</span>}
            </p>
          )}
        </div>
      </header>

      <section className={pageStyles.card} aria-label="Registro de auditoría">
        <div className={pageStyles.toolbar}>
          <TextField
            className={pageStyles.search}
            label="Buscar por correo o ID"
            type="search"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            maxLength={100}
          />
          <fieldset className={pageStyles.filter}>
            <legend className={pageStyles.legend}>Tipo</legend>
            <div className={pageStyles.chips}>
              <button
                type="button"
                className={pageStyles.chip}
                aria-pressed={filters.category === null}
                onClick={() => update({ category: null })}
              >
                Todos
              </button>
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={pageStyles.chip}
                  aria-pressed={filters.category === category}
                  onClick={() => update({ category })}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {entries.isPending ? (
          <StateMessage loading title="Cargando la auditoría…" />
        ) : entries.isError ? (
          <StateMessage
            title="No pudimos cargar la auditoría"
            detail={entries.error instanceof ApiError ? entries.error.detail : undefined}
            action={<Button onClick={() => void entries.refetch()}>Reintentar</Button>}
          />
        ) : entries.data.items.length === 0 ? (
          <StateMessage
            title={hasFilters ? 'Ningún registro coincide con los filtros' : 'Todavía no hay registros'}
            action={
              hasFilters && (
                <Button variant="secondary" onClick={() => update({ category: null, search: '' })}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className={tableStyles.container}>
              <table className={tableStyles.table}>
                <caption className="visually-hidden">Registro de auditoría, del más reciente al más antiguo</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Detalle</th>
                    <th scope="col">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td data-label="Fecha" className={styles.date}>
                        <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                      </td>
                      <th scope="row" className={tableStyles.name}>
                        {actionLabel(entry.action)}
                      </th>
                      <td data-label="Usuario" className={styles.wrap}>
                        {entry.actor_email ?? 'Desconocido'}
                      </td>
                      <td data-label="Detalle" className={styles.wrap}>
                        {describeDetails(entry) || '—'}
                        {entry.entity_id && <span className={styles.muted}> · ID {entry.entity_id}</span>}
                      </td>
                      <td data-label="IP" className={styles.muted}>
                        {entry.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={entries.data.page}
              pages={entries.data.pages}
              onChange={(page) => update({ page })}
              label="Paginación de la auditoría"
            />
          </>
        )}
      </section>
    </>
  )
}

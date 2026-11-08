import { Button } from './Button'
import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  pages: number
  onChange: (page: number) => void
  /** e.g. "Paginación de vehículos", to tell several paginations apart. */
  label: string
}

export function Pagination({ page, pages, onChange, label }: PaginationProps) {
  if (pages <= 1) return null

  return (
    <nav className={styles.pagination} aria-label={label}>
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <p className={styles.current} aria-live="polite">
        Página {page} de {pages}
      </p>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Siguiente
      </Button>
    </nav>
  )
}

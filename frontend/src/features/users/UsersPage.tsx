import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ApiError } from '../../shared/api/errors'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Button } from '../../shared/ui/Button'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { Pagination } from '../../shared/ui/Pagination'
import { StateMessage } from '../../shared/ui/StateMessage'
import { TextField } from '../../shared/ui/TextField'
import { useToast } from '../../shared/ui/toast/toastContext'
import { roleLabel } from '../auth/roles'
import { useSession } from '../auth/session'
import pageStyles from '../people/PeoplePage.module.css'
import tableStyles from '../people/PeopleTable.module.css'
import { formatDate, formatDateTime } from '../vehicles/format'
import { useUserMutations, useUsersPage } from './queries'
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog'
import type { ManagedUser, UserWithTemporaryPassword } from './types'
import { UserFormDialog } from './UserFormDialog'
import styles from './Users.module.css'

const PAGE_SIZE = 20

function StatusBadges({ user }: { user: ManagedUser }) {
  return (
    <span className={styles.badges}>
      {user.is_active ? (
        <span className={`${styles.badge} ${styles.active}`}>Activo</span>
      ) : (
        <span className={`${styles.badge} ${styles.inactive}`}>Inactivo</span>
      )}
      {user.is_locked && <span className={`${styles.badge} ${styles.locked}`}>Bloqueado 15 min</span>}
      {user.must_change_password && <span className={styles.badge}>Debe cambiar contraseña</span>}
    </span>
  )
}

/** User management, only for roles with users:manage (RF-06). */
export function UsersPage() {
  const { data: me } = useSession()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const search = params.get('buscar') ?? ''
  const page = Math.max(1, Number(params.get('pagina')) || 1)
  const debouncedSearch = useDebouncedValue(search, 300)
  const users = useUsersPage({ search: debouncedSearch, page, pageSize: PAGE_SIZE })
  const { update, resetPassword } = useUserMutations()

  const [form, setForm] = useState<{ user: ManagedUser | null } | null>(null)
  const [toggling, setToggling] = useState<ManagedUser | null>(null)
  const [resetting, setResetting] = useState<ManagedUser | null>(null)
  const [password, setPassword] = useState<{
    result: UserWithTemporaryPassword
    action: 'created' | 'reset'
  } | null>(null)

  function setFilters(next: { search?: string; page?: number }) {
    const nextParams = new URLSearchParams()
    const nextSearch = next.search ?? search
    const nextPage = next.search !== undefined ? 1 : (next.page ?? page)
    if (nextSearch.trim()) nextParams.set('buscar', nextSearch)
    if (nextPage > 1) nextParams.set('pagina', String(nextPage))
    setParams(nextParams, { replace: true })
  }

  function closeToggle() {
    update.reset()
    setToggling(null)
  }

  function closeReset() {
    resetPassword.reset()
    setResetting(null)
  }

  return (
    <>
      <title>Usuarios · Navexa</title>
      <header className={pageStyles.header}>
        <div>
          <h1 className={pageStyles.title}>Usuarios</h1>
          {users.data && (
            <p className={pageStyles.total} aria-live="polite">
              {users.data.total} {users.data.total === 1 ? 'usuario' : 'usuarios'}
            </p>
          )}
        </div>
        <Button onClick={() => setForm({ user: null })}>Nuevo usuario</Button>
      </header>

      <section className={pageStyles.card} aria-label="Lista de usuarios">
        <div className={pageStyles.toolbar}>
          <TextField
            className={pageStyles.search}
            label="Buscar por nombre o correo"
            type="search"
            value={search}
            onChange={(event) => setFilters({ search: event.target.value })}
            maxLength={100}
          />
        </div>

        {users.isPending ? (
          <StateMessage loading title="Cargando usuarios…" />
        ) : users.isError ? (
          <StateMessage
            title="No pudimos cargar los usuarios"
            detail={users.error instanceof ApiError ? users.error.detail : undefined}
            action={<Button onClick={() => void users.refetch()}>Reintentar</Button>}
          />
        ) : users.data.items.length === 0 ? (
          <StateMessage
            title="Ningún usuario coincide con tu búsqueda"
            detail="Prueba con otro nombre o correo."
            action={
              <Button variant="secondary" onClick={() => setFilters({ search: '' })}>
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <>
            <div className={tableStyles.container}>
              <table className={tableStyles.table}>
                <caption className="visually-hidden">Usuarios de Navexa</caption>
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Creado</th>
                    <th scope="col">
                      <span className="visually-hidden">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => {
                    const isSelf = user.id === me?.id
                    return (
                      <tr key={user.id}>
                        <th scope="row" className={tableStyles.name}>
                          {user.full_name}
                          {isSelf && <span className={styles.self}> (tú)</span>}
                        </th>
                        <td data-label="Correo" className={styles.email}>
                          {user.email}
                        </td>
                        <td data-label="Rol">{roleLabel(user.role)}</td>
                        <td data-label="Estado">
                          <StatusBadges user={user} />
                        </td>
                        <td data-label="Creado" className={styles.date}>
                          <time dateTime={user.created_at} title={formatDateTime(user.created_at)}>
                            {formatDate(user.created_at)}
                          </time>
                        </td>
                        <td className={tableStyles.actions}>
                          <Button
                            variant="ghost"
                            aria-label={`Editar a ${user.full_name}`}
                            onClick={() => setForm({ user })}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Restablecer la contraseña de ${user.full_name}`}
                            onClick={() => setResetting(user)}
                          >
                            Restablecer contraseña
                          </Button>
                          {!isSelf && (
                            <Button
                              variant="ghost"
                              className={user.is_active ? tableStyles.danger : undefined}
                              aria-label={`${user.is_active ? 'Desactivar' : 'Activar'} a ${user.full_name}`}
                              onClick={() => setToggling(user)}
                            >
                              {user.is_active ? 'Desactivar' : 'Activar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              label="Paginación de usuarios"
              page={users.data.page}
              pages={users.data.pages}
              onChange={(next) => setFilters({ page: next })}
            />
          </>
        )}
      </section>

      <UserFormDialog
        user={form?.user ?? null}
        open={form !== null}
        isSelf={form?.user?.id === me?.id}
        onClose={() => setForm(null)}
        onCreated={(result) => setPassword({ result, action: 'created' })}
      />

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? 'Desactivar usuario' : 'Activar usuario'}
        confirmLabel={toggling?.is_active ? 'Desactivar' : 'Activar'}
        pendingLabel="Guardando…"
        pending={update.isPending}
        error={update.error}
        onCancel={closeToggle}
        onConfirm={() =>
          toggling &&
          update.mutate(
            { id: toggling.id, input: { is_active: !toggling.is_active } },
            {
              onSuccess: (saved) => {
                toast.success(`${saved.full_name} quedó ${saved.is_active ? 'activo' : 'inactivo'}.`)
                closeToggle()
              },
            },
          )
        }
      >
        <p>
          {toggling?.is_active
            ? `${toggling.full_name} no podrá iniciar sesión y su sesión actual se cerrará.`
            : `${toggling?.full_name} podrá volver a iniciar sesión.`}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={resetting !== null}
        title="Restablecer contraseña"
        confirmLabel="Restablecer"
        pendingLabel="Restableciendo…"
        pending={resetPassword.isPending}
        error={resetPassword.error}
        onCancel={closeReset}
        onConfirm={() =>
          resetting &&
          resetPassword.mutate(resetting.id, {
            onSuccess: (result) => {
              closeReset()
              setPassword({ result, action: 'reset' })
            },
          })
        }
      >
        <p>
          Se generará una contraseña temporal para <strong>{resetting?.full_name}</strong>. Su contraseña
          actual dejará de funcionar y deberá cambiar la nueva al entrar.
        </p>
      </ConfirmDialog>

      <TemporaryPasswordDialog
        result={password?.result ?? null}
        action={password?.action ?? 'created'}
        onClose={() => setPassword(null)}
      />
    </>
  )
}

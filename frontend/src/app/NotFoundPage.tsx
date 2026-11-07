import { ButtonLink } from '../shared/ui/Button'
import { FullPageState } from '../shared/ui/FullPageState'
import { PATHS } from './paths'

export function NotFoundPage() {
  return (
    <FullPageState
      title="No encontramos esta página"
      detail="Puede que la dirección esté mal escrita o que la página ya no exista."
      action={<ButtonLink to={PATHS.home}>Volver al inicio</ButtonLink>}
    />
  )
}

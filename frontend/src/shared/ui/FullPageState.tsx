import styles from './FullPageState.module.css'
import { StateMessage, type StateMessageProps } from './StateMessage'

/** A StateMessage that fills the screen, for pages that have no layout yet (ARQ-12). */
export function FullPageState(props: Omit<StateMessageProps, 'headingLevel'>) {
  return (
    <main className={styles.page}>
      <StateMessage headingLevel={1} {...props} />
    </main>
  )
}

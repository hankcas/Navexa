import styles from './Spinner.module.css'

/** Decorative spinner. The surrounding text must say what is loading. */
export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />
}

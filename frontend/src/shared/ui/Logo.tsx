import styles from './Logo.module.css'

interface LogoProps {
  /** "dark" for dark backgrounds. */
  tone?: 'light' | 'dark'
}

export function Logo({ tone = 'light' }: LogoProps) {
  return (
    <span className={`${styles.logo} ${tone === 'dark' ? styles.onDark : ''}`}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path
          fill="var(--red-500)"
          d="M16 2C9.9 2 5 6.9 5 13c0 8 11 17 11 17s11-9 11-17c0-6.1-4.9-11-11-11z"
        />
        <circle cx="16" cy="13" r="4.5" fill="var(--lilac-100)" />
      </svg>
      <span className={styles.word}>Navexa</span>
    </span>
  )
}

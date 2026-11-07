import styles from './authForms.module.css'
import { PASSWORD_RULES } from './schemas'

/** Live list of the password rules, so the user sees what is missing before submitting. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className={styles.checklist}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li key={rule.label} className={`${styles.rule} ${met ? styles.ruleMet : ''}`}>
            {rule.label}
            <span className="visually-hidden">{met ? ': cumplido' : ': pendiente'}</span>
          </li>
        )
      })}
    </ul>
  )
}

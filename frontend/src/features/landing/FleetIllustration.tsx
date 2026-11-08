import styles from './FleetIllustration.module.css'

/**
 * Decorative map of a fleet: streets, one route and vehicles in the same status colors the
 * real map uses. Drawn by hand in SVG, so it costs no image download (UX-07).
 */
export function FleetIllustration() {
  return (
    <svg className={styles.illustration} viewBox="0 0 480 380" aria-hidden="true" focusable="false">
      <rect className={styles.panel} x="0" y="0" width="480" height="380" rx="24" />

      {/* Blocks and streets */}
      <g className={styles.blocks}>
        <rect x="32" y="36" width="120" height="84" rx="10" />
        <rect x="176" y="36" width="96" height="84" rx="10" />
        <rect x="296" y="36" width="152" height="120" rx="10" />
        <rect x="32" y="144" width="84" height="104" rx="10" />
        <rect x="140" y="144" width="132" height="104" rx="10" />
        <rect x="296" y="180" width="152" height="68" rx="10" />
        <rect x="32" y="272" width="200" height="76" rx="10" />
        <rect x="256" y="272" width="192" height="76" rx="10" />
      </g>

      {/* A trip drawn on the streets */}
      <path className={styles.route} d="M60 260 H128 V132 H284 V168 H420" />

      {/* Vehicles */}
      <g className={styles.offline}>
        <circle cx="210" cy="320" r="11" />
      </g>
      <g className={styles.stopped}>
        <circle cx="128" cy="196" r="11" />
        <circle cx="372" cy="94" r="11" />
      </g>
      <g className={styles.moving}>
        <circle className={styles.pulse} cx="284" cy="150" r="11" />
        <circle cx="284" cy="150" r="11" />
        <circle cx="400" cy="300" r="11" />
      </g>

      {/* A cluster of nearby vehicles */}
      <g className={styles.cluster}>
        <circle cx="80" cy="80" r="20" />
        <text x="80" y="86" textAnchor="middle">
          12
        </text>
      </g>

      {/* Status card, like the popup of the real map */}
      <g className={styles.card}>
        <rect x="300" y="196" width="152" height="60" rx="12" />
        <circle className={styles.cardDot} cx="320" cy="216" r="6" />
        <text className={styles.cardTitle} x="334" y="221">
          En movimiento
        </text>
        <text className={styles.cardText} x="316" y="243">
          42 km/h · Noreste
        </text>
      </g>
    </svg>
  )
}

import type { ReactNode } from 'react'

import styles from './LandingPage.module.css'

/** Simple line icons drawn for Navexa. Decorative: the text next to each one says the same. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const MapIcon = () => (
  <Icon>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </Icon>
)

export const TruckIcon = () => (
  <Icon>
    <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Icon>
)

export const DriverIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.2" />
    <path d="M3.8 10.5h5.9M14.3 10.5h5.9M12 14.2v6.2" />
  </Icon>
)

export const PassengersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16.5 13.6c2.6.2 4.5 2 4.5 4.9" />
  </Icon>
)

export const RouteIcon = () => (
  <Icon>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" />
  </Icon>
)

export const ChartIcon = () => (
  <Icon>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Icon>
)

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
)

export const PulseIcon = () => (
  <Icon>
    <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
  </Icon>
)

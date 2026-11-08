import { Link } from 'react-router-dom'

import { PATHS } from '../../app/paths'
import { Logo } from '../../shared/ui/Logo'
import { useSession } from '../auth/session'
import { FleetIllustration } from './FleetIllustration'
import {
  ChartIcon,
  DriverIcon,
  MapIcon,
  PassengersIcon,
  PulseIcon,
  RouteIcon,
  ShieldIcon,
  TruckIcon,
} from './icons'
import styles from './LandingPage.module.css'

const BENEFITS = [
  {
    icon: <PulseIcon />,
    title: 'Visibilidad en vivo',
    text: 'Cada vehículo en el mapa con su estado, velocidad y rumbo, actualizado sin recargar la página.',
  },
  {
    icon: <ChartIcon />,
    title: 'Decisiones con datos',
    text: 'Indicadores claros de tu operación: qué se mueve, qué está detenido y qué perdió la señal.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Control por roles',
    text: 'Cada persona ve y hace solo lo que su rol permite, y cada cambio queda registrado.',
  },
]

const MODULES = [
  { icon: <MapIcon />, title: 'Mapa en vivo', text: 'Posiciones agrupadas por zona, con íconos por estado.' },
  { icon: <TruckIcon />, title: 'Vehículos', text: 'Búsqueda, filtros por estado y detalle de cada unidad.' },
  { icon: <DriverIcon />, title: 'Conductores', text: 'Altas, cambios y asignación a vehículos en un clic.' },
  {
    icon: <PassengersIcon />,
    title: 'Pasajeros',
    text: 'Quién viaja en cada vehículo, con sus datos propios.',
  },
  {
    icon: <RouteIcon />,
    title: 'Historial de recorridos',
    text: 'El trayecto de un vehículo en el mapa, paso a paso.',
  },
  {
    icon: <ChartIcon />,
    title: 'Indicadores',
    text: 'Dashboard, exportación de datos y auditoría de cambios.',
  },
]

const STEPS = [
  {
    title: 'Conecta tu plataforma de rastreo',
    text: 'Navexa lee tus unidades, conductores y pasajeros desde la plataforma GPS que ya usas.',
  },
  {
    title: 'Navexa ordena la información',
    text: 'Convierte los datos técnicos en estados, horas locales y velocidades que todos entienden.',
  },
  {
    title: 'Tu equipo opera según su rol',
    text: 'Administradores, operadores y visualizadores trabajan sobre la misma información, cada uno con sus permisos.',
  },
]

/** Public landing (RF-01, RF-02). Logged-in users get a shortcut to the panel (RF-03). */
export function LandingPage() {
  const { data: user } = useSession()
  const primaryAction = user
    ? { to: PATHS.panel, label: 'Ir al panel' }
    : { to: PATHS.login, label: 'Iniciar sesión' }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to={PATHS.home} className={styles.logoLink} aria-label="Navexa, inicio">
            <Logo tone="dark" />
          </Link>
          <nav aria-label="Secciones" className={styles.nav}>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#como-funciona">Cómo funciona</a>
          </nav>
          <Link to={primaryAction.to} className={styles.headerCta}>
            {primaryAction.label}
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Monitoreo de flota</p>
              <h1 id="hero-title" className={styles.heroTitle}>
                Tu flota, en tiempo real y <span className={styles.highlight}>bajo control</span>.
              </h1>
              <p className={styles.heroText}>
                Navexa reúne la ubicación de tus vehículos, tus conductores y tus pasajeros en un solo panel
                claro, seguro y fácil de usar desde cualquier dispositivo.
              </p>
              <div className={styles.heroActions}>
                <Link to={primaryAction.to} className={styles.primaryCta}>
                  {primaryAction.label}
                </Link>
                <a href="#como-funciona" className={styles.secondaryCta}>
                  Ver cómo funciona
                </a>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <FleetIllustration />
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="value-title">
          <div className={styles.sectionInner}>
            <h2 id="value-title" className={styles.sectionTitle}>
              Menos llamadas preguntando «¿dónde va?», más operación bajo control
            </h2>
            <ul className={styles.benefits}>
              {BENEFITS.map((benefit) => (
                <li key={benefit.title} className={styles.benefit}>
                  <span className={styles.iconBox}>{benefit.icon}</span>
                  <h3 className={styles.cardTitle}>{benefit.title}</h3>
                  <p className={styles.cardText}>{benefit.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="funcionalidades"
          className={`${styles.section} ${styles.tinted}`}
          aria-labelledby="features-title"
        >
          <div className={styles.sectionInner}>
            <p className={styles.eyebrowDark}>Funcionalidades</p>
            <h2 id="features-title" className={styles.sectionTitle}>
              Todo lo que necesitas para gestionar tu flota
            </h2>
            <ul className={styles.modules}>
              {MODULES.map((module) => (
                <li key={module.title} className={styles.module}>
                  <span className={styles.iconBox}>{module.icon}</span>
                  <div>
                    <h3 className={styles.cardTitle}>{module.title}</h3>
                    <p className={styles.cardText}>{module.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="como-funciona" className={styles.section} aria-labelledby="how-title">
          <div className={styles.sectionInner}>
            <p className={styles.eyebrowDark}>Cómo funciona</p>
            <h2 id="how-title" className={styles.sectionTitle}>
              De los datos del GPS a decisiones en tres pasos
            </h2>
            <ol className={styles.steps}>
              {STEPS.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3 className={styles.cardTitle}>{step.title}</h3>
                  <p className={styles.cardText}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.cta} aria-labelledby="cta-title">
          <div className={styles.ctaInner}>
            <h2 id="cta-title" className={styles.ctaTitle}>
              ¿Listo para ver tu flota?
            </h2>
            <p className={styles.ctaText}>
              Entra con la cuenta que te asignó el administrador de tu empresa.
            </p>
            <Link to={primaryAction.to} className={styles.primaryCta}>
              {primaryAction.label}
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Logo tone="dark" />
          <p className={styles.footerText}>Monitoreo de flota en tiempo real.</p>
          <nav aria-label="Pie de página" className={styles.footerNav}>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#como-funciona">Cómo funciona</a>
            <Link to={primaryAction.to}>{primaryAction.label}</Link>
          </nav>
          <p className={styles.copyright}>© 2026 Navexa. Proyecto demostrativo.</p>
        </div>
      </footer>
    </div>
  )
}

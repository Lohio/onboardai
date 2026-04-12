import Link from 'next/link'
import { Zap, Users, Brain, ChevronRight, CheckCircle } from 'lucide-react'

// ─────────────────────────────────────────────
// Landing page de Heero — LATAM market launch
// Servidor estático, sin hooks de cliente
// ─────────────────────────────────────────────

const FEATURES = [
  {
    icon: Users,
    title: 'Onboarding estructurado',
    desc: 'Cada nuevo talento recibe un programa de ingreso completo: perfil, cultura, rol y primeros pasos, todo en un solo lugar.',
    color: 'var(--mod-m1-accent)',
    bg: 'var(--mod-m1-accent-bg)',
    border: 'var(--mod-m1-accent-border)',
  },
  {
    icon: Brain,
    title: 'Asistente IA siempre disponible',
    desc: 'Respondé las dudas del primer día automáticamente. El asistente aprende del contenido de tu empresa y acompaña a cada empleado.',
    color: 'var(--mod-m3-accent)',
    bg: 'var(--mod-m3-accent-bg)',
    border: 'var(--mod-m3-accent-border)',
  },
  {
    icon: Zap,
    title: 'Listo en minutos',
    desc: 'Registrá tu empresa, cargá el contenido y sumá a tu equipo. Sin instalación, sin IT, sin fricción.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.20)',
  },
]

const STATS = [
  { value: '100%', label: 'Digital y autoservicio' },
  { value: '4 pasos', label: 'Para configurar tu empresa' },
  { value: 'es · en · fr · pt', label: 'Idiomas disponibles' },
]

export default function LandingPage() {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>

      {/* ── Barra superior ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(59,79,216,0.25)', border: '1px solid rgba(59,79,216,0.35)' }}>
            <Zap className="w-4 h-4" style={{ color: '#38BDF8' }} fill="#38BDF8" />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Heero</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-xs font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Iniciar sesión
          </Link>
          <Link
            href="/auth/register"
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            Empezar gratis
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Orbs decorativos */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 -translate-x-1/2 -top-32 w-[600px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, #3B4FD8 0%, transparent 70%)' }} />
          <div className="absolute right-0 top-40 w-64 h-64 rounded-full opacity-8"
            style={{ background: 'radial-gradient(ellipse, #0EA5E9 0%, transparent 70%)' }} />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium"
            style={{ background: 'rgba(59,79,216,0.15)', border: '1px solid rgba(59,79,216,0.30)', color: '#7DD3FC' }}>
            <Zap className="w-3 h-3" fill="currentColor" />
            Onboarding inteligente para LATAM
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-5"
            style={{ color: 'var(--foreground)' }}>
            Incorporá nuevos talentos{' '}
            <span style={{
              background: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              desde el primer día
            </span>
          </h1>

          <p className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8"
            style={{ color: 'var(--text-muted)' }}>
            Heero ayuda a tu empresa a estructurar el ingreso de cada persona: perfil, cultura, rol y un asistente IA que acompaña en tiempo real.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              Registrá tu empresa gratis
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-muted)',
              }}
            >
              Ya tengo cuenta
            </Link>
          </div>

          {/* Nota trial */}
          <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Sin tarjeta de crédito · Trial gratuito incluido
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-3xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {STATS.map(s => (
            <div key={s.value} className="rounded-xl p-4 text-center"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <p className="text-lg sm:text-xl font-bold" style={{ color: '#38BDF8' }}>{s.value}</p>
              <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-xl font-semibold text-center mb-8"
          style={{ color: 'var(--foreground)' }}>
          Todo lo que necesitás para un onboarding profesional
        </h2>

        <div className="grid sm:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl p-5"
              style={{ background: f.bg, border: `1px solid ${f.border}` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <h2 className="text-xl font-semibold text-center mb-8" style={{ color: 'var(--foreground)' }}>
          Empezá en 4 pasos
        </h2>

        <div className="space-y-3">
          {[
            { step: '01', title: 'Registrá tu empresa', desc: 'Creá tu cuenta de admin en segundos, sin datos de pago.' },
            { step: '02', title: 'Configurá el contenido', desc: 'Cargá la cultura, los valores y los procesos de tu organización.' },
            { step: '03', title: 'Invitá a tu equipo', desc: 'Sumá a tus empleados y asignales su programa de ingreso.' },
            { step: '04', title: 'Seguí el progreso', desc: 'Monitoreá el avance de cada persona desde el dashboard de admin.' },
          ].map(item => (
            <div key={item.step} className="flex gap-4 items-start p-4 rounded-xl"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(59,79,216,0.20)', color: '#7DD3FC' }}>
                {item.step}
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <div className="rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(59,79,216,0.15) 0%, rgba(13,148,136,0.08) 100%)',
            border: '1px solid rgba(59,79,216,0.25)',
          }}>
          <CheckCircle className="w-8 h-8 mx-auto mb-4" style={{ color: '#38BDF8' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Listo para arrancar
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Registrá tu empresa ahora y empezá el onboarding de tu próximo ingreso hoy mismo.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            Empezar gratis
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-6 text-center"
        style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © 2025 Heero · Onboarding inteligente
        </p>
      </footer>

    </div>
  )
}

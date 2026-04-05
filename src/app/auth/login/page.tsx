'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import HeeroLogo from '@/components/shared/HeeroLogo'
import Image from 'next/image'

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
}

// ─────────────────────────────────────────────
// Modal de OAuth
// ─────────────────────────────────────────────

function OAuthModal({
  mode,
  onClose,
  authError,
  oauthLoading,
  onOAuth,
}: {
  mode: 'login' | 'signup'
  onClose: () => void
  authError: string | null
  oauthLoading: 'google' | 'azure' | null
  onOAuth: (provider: 'google' | 'azure') => void
}) {
  const title = mode === 'login' ? 'Iniciá sesión' : 'Creá tu cuenta'
  const subtitle = mode === 'login'
    ? 'Usá tu cuenta corporativa para ingresar.'
    : 'Conectá tu cuenta corporativa para empezar.'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 w-full max-w-[320px] rounded-xl border border-[#545454] bg-[#111] p-6"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center
            text-[#717171] hover:text-white transition-colors rounded-md hover:bg-white/[0.06]"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-white text-base font-medium mb-1" style={{ letterSpacing: '-0.5px' }}>
          {title}
        </h2>
        <p className="text-[11px] text-[#717171] mb-6 leading-snug">{subtitle}</p>

        {/* Error */}
        <AnimatePresence>
          {authError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-snug">{authError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón Google */}
        <motion.button
          type="button"
          onClick={() => onOAuth('google')}
          disabled={!!oauthLoading}
          whileHover={!oauthLoading ? { scale: 1.02 } : undefined}
          whileTap={!oauthLoading ? { scale: 0.97 } : undefined}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full h-9 rounded-lg bg-white text-black text-[11px] font-semibold
                     flex items-center justify-center gap-2.5
                     hover:bg-gray-100 transition-colors duration-150 cursor-pointer
                     disabled:opacity-50 disabled:cursor-not-allowed mb-2"
        >
          {oauthLoading === 'google'
            ? <span className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
            : <Image src="/google-g-logo.svg" alt="" width={15} height={15} className="flex-shrink-0" />}
          {oauthLoading === 'google' ? 'Conectando...' : 'Continuar con Google'}
        </motion.button>

        {/* Botón Microsoft */}
        <motion.button
          type="button"
          onClick={() => onOAuth('azure')}
          disabled={!!oauthLoading}
          whileHover={!oauthLoading ? { scale: 1.02 } : undefined}
          whileTap={!oauthLoading ? { scale: 0.97 } : undefined}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full h-9 rounded-lg bg-[#1f1f1f] border border-[#545454]
                     text-white text-[11px] font-semibold
                     flex items-center justify-center gap-2.5
                     hover:bg-[#2a2a2a] transition-colors duration-150 cursor-pointer
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {oauthLoading === 'azure'
            ? <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            : (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
            )}
          {oauthLoading === 'azure' ? 'Conectando...' : 'Continuar con Microsoft 365'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function LoginPage() {
  const [modal,        setModal       ] = useState<'login' | 'signup' | null>(null)
  const [authError,    setAuthError   ] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null)

  // Leer error de la URL (viene desde /auth/callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get('error')
    if (urlError) {
      const msgs: Record<string, string> = {
        session_error: 'Error al iniciar sesión con el proveedor. Intentá de nuevo.',
        setup_error:   'Error al configurar tu cuenta. Contactá soporte.',
        missing_code:  'El enlace de autenticación no es válido.',
      }
      setAuthError(msgs[urlError] ?? 'Error de autenticación. Intentá de nuevo.')
      setModal('login')
    }
  }, [])

  const handleOAuth = async (provider: 'google' | 'azure') => {
    setOauthLoading(provider)
    setAuthError(null)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setOauthLoading(null)
  }

  const openModal = (mode: 'login' | 'signup') => {
    setAuthError(null)
    setModal(mode)
  }

  const closeModal = () => {
    if (oauthLoading) return // no cerrar mientras carga
    setModal(null)
    setAuthError(null)
  }

  return (
    <div className="min-h-dvh flex bg-black">
      {/* ── Panel izquierdo ── */}
      <div className="relative flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="w-full max-w-[271px]"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="mb-12">
            <HeeroLogo size="lg" />
          </motion.div>

          {/* Tagline */}
          <motion.div variants={itemVariants} className="mb-10">
            <h1
              className="text-white text-2xl font-light leading-tight mb-2"
              style={{ letterSpacing: '-0.04em' }}
            >
              Tu onboarding,<br />inteligente.
            </h1>
            <p className="text-[#717171] text-xs leading-relaxed">
              Plataforma de onboarding para equipos modernos.
            </p>
          </motion.div>

          {/* Botones principales */}
          <motion.div variants={itemVariants} className="space-y-2">
            <motion.button
              type="button"
              onClick={() => openModal('login')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full h-9 rounded-lg bg-[#29d4fc] text-black text-[12px] font-semibold
                         hover:bg-[#20c4ec] transition-colors duration-150 cursor-pointer"
            >
              Iniciar sesión
            </motion.button>

            <motion.button
              type="button"
              onClick={() => openModal('signup')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full h-9 rounded-lg bg-transparent border border-[#545454]
                         text-white text-[12px] font-medium
                         hover:bg-white/[0.04] hover:border-[#717171]
                         transition-all duration-150 cursor-pointer"
            >
              Registrarse
            </motion.button>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Panel derecho: ilustración ── */}
      <div className="hidden md:block relative w-[55%] overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a0a2e 0%, #3d1a4f 15%, #c44b3f 40%, #e8734a 55%, #f4a261 70%, #e0935a 85%, #2a1520 100%)' }} />
        <div className="absolute top-[8%] right-[15%] w-20 h-20 rounded-full" style={{ background: 'radial-gradient(circle, #fff8e7 0%, #f4d8a0 40%, #e8b87044 70%, transparent 100%)', boxShadow: '0 0 60px 20px rgba(244,210,160,0.3)' }} />
        {[
          { top: '5%',  left: '20%', size: 2   },
          { top: '10%', left: '45%', size: 1.5 },
          { top: '3%',  left: '65%', size: 2   },
          { top: '15%', left: '30%', size: 1.5 },
          { top: '8%',  left: '80%', size: 1.5 },
          { top: '12%', left: '55%', size: 2   },
          { top: '18%', left: '15%', size: 1.5 },
          { top: '6%',  left: '38%', size: 1   },
        ].map((s, i) => (
          <div key={i} className="absolute rounded-full bg-white/70" style={{ top: s.top, left: s.left, width: s.size, height: s.size }} />
        ))}
        <div className="absolute bottom-0 left-0 right-0 h-[45%]" style={{ background: 'linear-gradient(180deg, #c44b3f88 0%, #3a1525 30%, #1a0a15 100%)' }} />
        <div className="absolute bottom-[20%] left-[10%] right-[10%] h-[35%]">
          <div className="absolute top-[10%] left-0 right-0 h-[4%]" style={{ background: '#5c2a1a' }} />
          <div className="absolute top-[45%] left-0 right-0 h-[4%]" style={{ background: '#4a2015' }} />
          {[15, 35, 55, 75].map((left, i) => (
            <div key={i} className="absolute h-full" style={{ left: `${left}%`, width: '4%', background: 'linear-gradient(180deg, #6b3020 0%, #3a1810 100%)' }} />
          ))}
        </div>
        <div className="absolute bottom-[40%] left-0 right-0 h-[15%]" style={{ background: 'linear-gradient(180deg, transparent 0%, #2a1215 60%, #3a1820 100%)', clipPath: 'polygon(0% 100%, 5% 40%, 15% 60%, 25% 30%, 40% 50%, 55% 20%, 70% 45%, 85% 25%, 100% 55%, 100% 100%)' }} />
      </div>

      {/* ── Modal OAuth ── */}
      <AnimatePresence>
        {modal && (
          <OAuthModal
            mode={modal}
            onClose={closeModal}
            authError={authError}
            oauthLoading={oauthLoading}
            onOAuth={handleOAuth}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

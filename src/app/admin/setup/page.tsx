'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Stepper } from '@/components/admin/setup/Stepper'
import { Step1Empresa } from '@/components/admin/setup/Step1Empresa'
import { Step2Cultura } from '@/components/admin/setup/Step2Cultura'
import { Step3Contacto } from '@/components/admin/setup/Step3Contacto'
import { Step4Empleado } from '@/components/admin/setup/Step4Empleado'

// ─────────────────────────────────────────────
// Datos compartidos entre pasos
// ─────────────────────────────────────────────

export interface SetupData {
  empresaId: string
  empresaNombre: string
  adminId: string
}

// ─────────────────────────────────────────────
// Variantes de animación entre pasos
// ─────────────────────────────────────────────

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

// ─────────────────────────────────────────────
// Pasos del wizard
// ─────────────────────────────────────────────

const STEPS = [
  { label: 'Empresa' },
  { label: 'Cultura' },
  { label: 'Contacto' },
  { label: 'Primer empleado' },
]

// ─────────────────────────────────────────────
// Página principal del setup
// ─────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [cargando, setCargando] = useState(true)

  // Cargar datos del admin/empresa actual
  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('empresa_id, nombre')
        .eq('id', user.id)
        .single()

      if (error || !usuario) { router.push('/auth/login'); return }

      const { data: empresa, error: empError } = await supabase
        .from('empresas')
        .select('id, nombre, setup_completo')
        .eq('id', usuario.empresa_id)
        .single()

      if (empError || !empresa) { router.push('/admin'); return }

      // Si ya completó el setup, redirigir
      if (empresa.setup_completo) {
        router.push('/admin')
        return
      }

      // Verificar si ya se completó antes (localStorage)
      if (typeof window !== 'undefined' &&
          localStorage.getItem('onboarding_setup_completo') === 'true') {
        router.push('/admin')
        return
      }

      setSetupData({
        empresaId: empresa.id,
        empresaNombre: empresa.nombre,
        adminId: user.id,
      })
    } catch (err) {
      console.error('[setup] Error cargando datos:', err)
      router.push('/admin')
    } finally {
      setCargando(false)
    }
  }, [router])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Llamado cuando se completa el último paso o se omite
  const handleFinish = useCallback(async () => {
    // Marcar setup como completo solo si tenemos el ID de empresa
    if (setupData) {
      try {
        const supabase = createClient()
        await supabase
          .from('empresas')
          .update({ setup_completo: true })
          .eq('id', setupData.empresaId)
      } catch {
        // No es crítico — continuar igual
      }
    }

    // Persistir en localStorage para evitar re-mostrar
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_setup_completo', 'true')
    }

    toast.success('¡Setup completo! Bienvenido a OnboardAI')
    router.push('/admin')
  }, [setupData, router])

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      handleFinish()
    }
  }, [currentStep, handleFinish])

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin-fast" />
          <span className="text-sm text-white/40">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!setupData) return null

  return (
    <div className="max-w-2xl mx-auto py-6 px-2">
      {/* Stepper de progreso */}
      <Stepper steps={STEPS} currentStep={currentStep} />

      {/* Contenido del paso activo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          {currentStep === 0 && (
            <Step1Empresa setupData={setupData} onNext={nextStep} />
          )}
          {currentStep === 1 && (
            <Step2Cultura setupData={setupData} onNext={nextStep} onSkip={nextStep} />
          )}
          {currentStep === 2 && (
            <Step3Contacto setupData={setupData} onNext={nextStep} onSkip={nextStep} />
          )}
          {currentStep === 3 && (
            <Step4Empleado setupData={setupData} onFinish={handleFinish} onSkip={handleFinish} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

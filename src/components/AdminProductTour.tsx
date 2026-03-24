'use client'

import { useEffect, useCallback } from 'react'
import 'driver.js/dist/driver.css'

const TOUR_KEY = 'onboard_tour_admin_done'

// ── Estilos personalizados para driver.js (inyectados una vez) ──
const TOUR_STYLES = `
  .driver-popover {
    background: #13182a !important;
    border: 1px solid rgba(99, 102, 241, 0.35) !important;
    border-radius: 14px !important;
    box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1) !important;
    padding: 20px 22px 16px !important;
    max-width: 320px !important;
  }
  .driver-popover-title {
    font-size: 15px !important;
    font-weight: 600 !important;
    color: #ffffff !important;
    margin-bottom: 6px !important;
    font-family: 'Instrument Sans', system-ui, sans-serif !important;
  }
  .driver-popover-description {
    font-size: 13px !important;
    color: rgba(255,255,255,0.60) !important;
    line-height: 1.6 !important;
    font-family: 'Instrument Sans', system-ui, sans-serif !important;
  }
  .driver-popover-footer {
    margin-top: 16px !important;
    gap: 8px !important;
  }
  .driver-popover-prev-btn,
  .driver-popover-next-btn,
  .driver-popover-close-btn {
    font-family: 'Instrument Sans', system-ui, sans-serif !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    border-radius: 8px !important;
    padding: 6px 14px !important;
    border: none !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
  }
  .driver-popover-next-btn {
    background: #4f46e5 !important;
    color: #ffffff !important;
  }
  .driver-popover-next-btn:hover {
    background: #4338ca !important;
  }
  .driver-popover-prev-btn {
    background: rgba(255,255,255,0.06) !important;
    color: rgba(255,255,255,0.65) !important;
  }
  .driver-popover-prev-btn:hover {
    background: rgba(255,255,255,0.10) !important;
    color: #ffffff !important;
  }
  .driver-popover-close-btn {
    background: transparent !important;
    color: rgba(255,255,255,0.30) !important;
    padding: 4px 8px !important;
    font-size: 16px !important;
  }
  .driver-popover-close-btn:hover {
    color: rgba(255,255,255,0.70) !important;
  }
  .driver-popover-progress-text {
    font-size: 11px !important;
    color: rgba(255,255,255,0.30) !important;
    font-family: 'Instrument Sans', system-ui, sans-serif !important;
  }
  .driver-overlay {
    background: rgba(0,0,0,0.65) !important;
  }
`

function injectStyles() {
  if (document.getElementById('driver-custom-styles')) return
  const style = document.createElement('style')
  style.id = 'driver-custom-styles'
  style.textContent = TOUR_STYLES
  document.head.appendChild(style)
}

export default function AdminProductTour() {
  const startTour = useCallback(async () => {
    const { driver } = await import('driver.js')

    injectStyles()

    const driverObj = driver({
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Atrás',
      doneBtnText: '¡Empezar!',
      onDestroyStarted: () => {
        // Marcar como completado al cerrar o finalizar
        localStorage.setItem(TOUR_KEY, 'true')
        driverObj.destroy()
      },
      steps: [
        {
          // Paso 1: Bienvenida general (popover centrada, sin elemento)
          popover: {
            title: '👋 ¡Bienvenido a Heero!',
            description:
              'Este es tu panel de administración. En menos de 2 minutos te mostramos todo lo que podés hacer para gestionar el onboarding de tu equipo.',
          },
        },
        {
          // Paso 2: Empleados
          element: '#tour-nav-empleados',
          popover: {
            title: '👥 Empleados',
            description:
              'Desde acá podés agregar a tu equipo, asignar managers y buddies, y seguir el progreso individual de cada persona en su onboarding.',
            side: 'right',
            align: 'center',
          },
        },
        {
          // Paso 3: Conocimiento
          element: '#tour-nav-conocimiento',
          popover: {
            title: '📚 Conocimiento',
            description:
              'Subí documentos, videos y archivos con la información de tu empresa. El asistente IA los usa para responder las preguntas de tus nuevos empleados.',
            side: 'right',
            align: 'center',
          },
        },
        {
          // Paso 4: Reportes
          element: '#tour-nav-reportes',
          popover: {
            title: '📊 Reportes',
            description:
              'Visualizá el progreso de todo el equipo, revisá encuestas de pulso y detectá empleados que necesitan atención antes de que sea tarde.',
            side: 'right',
            align: 'center',
          },
        },
        {
          // Paso 5: Configuración
          element: '#tour-nav-configuracion',
          popover: {
            title: '⚙️ Configuración',
            description:
              'Personalizá tu empresa: herramientas de contacto, integración con Teams o Google Chat, y gestión de API keys para conectar sistemas externos.',
            side: 'right',
            align: 'center',
          },
        },
        {
          // Paso 6: Cierre motivador (popover centrada)
          popover: {
            title: '🚀 ¡Todo listo!',
            description:
              'Ya conocés el panel. El primer paso es agregar a tu equipo y subir el conocimiento de tu empresa. ¡Tu próximo empleado va a tener el mejor onboarding de su vida!',
          },
        },
      ],
    })

    driverObj.drive()
  }, [])

  // Lanzar automáticamente la primera vez
  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY)
    if (done === 'true') return

    // Pequeño delay para que el layout termine de renderizar
    const timer = setTimeout(() => {
      startTour()
    }, 800)

    return () => clearTimeout(timer)
  }, [startTour])

  // Escuchar evento para relanzar desde configuración
  useEffect(() => {
    const handler = () => startTour()
    window.addEventListener('start-admin-tour', handler)
    return () => window.removeEventListener('start-admin-tour', handler)
  }, [startTour])

  // El componente no renderiza nada visible
  return null
}

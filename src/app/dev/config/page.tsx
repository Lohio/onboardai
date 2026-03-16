'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Save, Bot, Sliders, FileText, Layers,
  AlertCircle, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface AppConfig {
  claude_model: string
  max_tokens: string
  system_prompt_base: string
  sequential_onboarding: string
}

const DEFAULTS: AppConfig = {
  claude_model: 'claude-sonnet-4-6',
  max_tokens: '2048',
  system_prompt_base: '',
  sequential_onboarding: 'false',
}

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-6',           label: 'Claude Sonnet 4.6 (recomendado)' },
  { value: 'claude-opus-4-6',             label: 'Claude Opus 4.6 (más potente)' },
  { value: 'claude-haiku-4-5-20251001',   label: 'Claude Haiku 4.5 (más rápido)' },
]

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function inputCls(): string {
  return [
    'w-full h-9 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-amber-500/60',
  ].join(' ')
}

// ─────────────────────────────────────────────
// Toggle component
// ─────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  label,
  description,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm text-white/70 font-medium">{label}</p>
        <p className="text-xs text-white/35 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full flex-shrink-0 mt-0.5
          transition-colors duration-200 focus-visible:outline-none
          ${value ? 'bg-amber-500' : 'bg-white/[0.12]'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm
            ${value ? 'translate-x-4.5' : 'translate-x-0.5'}`}
          style={{ translateX: value ? '18px' : '2px' }}
        />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página de configuración
// ─────────────────────────────────────────────

export default function ConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<AppConfig>(DEFAULTS)
  const [tableExists, setTableExists] = useState(true)
  const [saved, setSaved] = useState(false)

  // ── Carga ──
  const cargarConfig = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: ud } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (!ud || ud.rol !== 'dev') { router.push('/admin'); return }

      // Intentar leer la tabla app_config
      const { data: rows, error } = await supabase
        .from('app_config')
        .select('key, value')

      if (error) {
        // La tabla probablemente no existe
        setTableExists(false)
        return
      }

      // Construir el objeto de config desde las filas clave-valor
      const cfg: AppConfig = { ...DEFAULTS }
      for (const row of (rows ?? [])) {
        const k = row.key as keyof AppConfig
        if (k in cfg) {
          cfg[k] = (row.value ?? '') as AppConfig[typeof k]
        }
      }
      setConfig(cfg)
    } catch {
      setTableExists(false)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { cargarConfig() }, [cargarConfig])

  // ── Guardar ──
  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const supabase = createClient()

      // Doble check de permisos
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Sin sesión'); return }
      const { data: ud } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (!ud || ud.rol !== 'dev') { toast.error('Sin permisos'); return }

      // Upsert de cada clave-valor
      const entries = Object.entries(config).map(([key, value]) => ({
        key,
        value: String(value),
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('app_config')
        .upsert(entries, { onConflict: 'key' })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Configuración guardada')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  function set(key: keyof AppConfig, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  // ── No existe la tabla ──
  if (!loading && !tableExists) {
    return (
      <div className="space-y-6">
        <h1 className="text-lg font-semibold text-white">Configuración</h1>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Tabla app_config no encontrada</h2>
          </div>
          <p className="text-sm text-white/50">
            La tabla <code className="text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">app_config</code> no
            existe en tu base de datos. Ejecutá el siguiente SQL en el Editor de Supabase para crearla:
          </p>
          <pre className="text-xs text-teal-300/80 bg-white/[0.03] border border-white/[0.06]
            rounded-lg p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
{`CREATE TABLE app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Valores por defecto
INSERT INTO app_config (key, value) VALUES
  ('claude_model',          'claude-sonnet-4-6'),
  ('max_tokens',            '2048'),
  ('system_prompt_base',    ''),
  ('sequential_onboarding', 'false')
ON CONFLICT (key) DO NOTHING;

-- RLS: solo devs pueden leer/escribir
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_config_all" ON app_config
  FOR ALL USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');`}
          </pre>
          <Button variant="secondary" size="sm" onClick={cargarConfig}>
            Reintentar
          </Button>
        </motion.div>
      </div>
    )
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-40 bg-white/[0.06] rounded" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.04] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // Formulario de config
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Configuración</h1>
          <p className="text-sm text-white/40 mt-0.5">Variables globales de la aplicación</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-xs text-teal-400"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Guardado
            </motion.div>
          )}
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            <Save className="w-3.5 h-3.5" />
            Guardar
          </Button>
        </div>
      </div>

      {/* Sección: Modelo de IA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="glass-card rounded-xl p-5 space-y-5"
      >
        <div className="flex items-center gap-2 pb-1 border-b border-white/[0.05]">
          <Bot className="w-3.5 h-3.5 text-amber-400/70" />
          <h2 className="text-sm font-semibold text-white/70">Modelo de Claude</h2>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">Modelo activo</label>
          <select
            value={config.claude_model}
            onChange={e => set('claude_model', e.target.value)}
            className={inputCls() + ' appearance-none cursor-pointer'}
          >
            {CLAUDE_MODELS.map(m => (
              <option key={m.value} value={m.value} className="bg-[#0f1f3d]">{m.label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-white/30">
            Se usa en <code className="font-mono">src/app/api/empleado/chat/route.ts</code>
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">Max tokens por respuesta</label>
          <input
            type="number"
            min="256"
            max="8192"
            step="256"
            value={config.max_tokens}
            onChange={e => set('max_tokens', e.target.value)}
            className={inputCls()}
          />
          <p className="mt-1.5 text-[11px] text-white/30">
            Rango recomendado: 1024–4096. Actual: {Number(config.max_tokens).toLocaleString()} tokens
          </p>
        </div>
      </motion.div>

      {/* Sección: System Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.05 }}
        className="glass-card rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 pb-1 border-b border-white/[0.05]">
          <FileText className="w-3.5 h-3.5 text-amber-400/70" />
          <h2 className="text-sm font-semibold text-white/70">System Prompt base</h2>
          <Badge variant="info" className="ml-auto">Se antepone al prompt de empresa</Badge>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">Instrucciones globales del asistente</label>
          <textarea
            value={config.system_prompt_base}
            onChange={e => set('system_prompt_base', e.target.value)}
            rows={6}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
              text-white/85 placeholder:text-white/20 outline-none resize-y min-h-[120px]
              focus:bg-white/[0.06] focus:border-amber-500/60 transition-colors duration-150 font-mono"
            placeholder="Ej: Eres un asistente de onboarding profesional y empático. Siempre responde en español..."
          />
          <p className="mt-1.5 text-[11px] text-white/30">
            {config.system_prompt_base.length} caracteres.
            Este prompt se concatena antes del conocimiento específico de cada empresa.
          </p>
        </div>
      </motion.div>

      {/* Sección: Comportamiento */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.1 }}
        className="glass-card rounded-xl p-5 space-y-5"
      >
        <div className="flex items-center gap-2 pb-1 border-b border-white/[0.05]">
          <Sliders className="w-3.5 h-3.5 text-amber-400/70" />
          <h2 className="text-sm font-semibold text-white/70">Comportamiento del onboarding</h2>
        </div>

        <Toggle
          value={config.sequential_onboarding === 'true'}
          onChange={v => set('sequential_onboarding', v ? 'true' : 'false')}
          label="Onboarding secuencial"
          description="Los módulos se desbloquean uno a uno. El empleado debe completar M1 antes de acceder a M2, M2 antes de M3, etc."
        />

        <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/[0.12]">
          <p className="text-xs text-amber-300/70">
            <span className="font-semibold">Nota:</span> El onboarding secuencial requiere validación en cada página de módulo
            para verificar que el anterior fue completado. Activar esto sin implementar esa validación no tendrá efecto.
          </p>
        </div>
      </motion.div>

      {/* Sección: Info tabla */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.15 }}
        className="glass-card rounded-xl p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-amber-400/70" />
          <h2 className="text-sm font-semibold text-white/70">Tabla app_config</h2>
        </div>
        <div className="space-y-1">
          {(Object.entries(config) as [keyof AppConfig, string][]).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 text-xs py-1 border-b border-white/[0.04]">
              <code className="text-amber-300/70 font-mono w-44 flex-shrink-0">{key}</code>
              <span className="text-white/40 truncate">{value || '(vacío)'}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

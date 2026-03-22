'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save, Bot, Sliders, FileText, AlertCircle,
  CheckCircle2, Building2, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

/** Fila de la tabla app_config */
interface ConfigRow {
  clave: string
  valor: string
  descripcion: string
  updated_at: string
}

/** Estado interno del formulario: mapa clave → valor */
type ConfigMap = Record<string, string>

// ─────────────────────────────────────────────
// Definición de configuraciones disponibles
// ─────────────────────────────────────────────

interface ConfigDef {
  clave: string
  valorDefault: string
  descripcion: string
  tipo: 'select' | 'number' | 'textarea' | 'toggle'
  /** Solo para tipo 'select' */
  opciones?: { value: string; label: string }[]
  /** Solo para tipo 'number' */
  min?: number
  max?: number
  step?: number
}

const CONFIGS: ConfigDef[] = [
  {
    clave: 'claude_model',
    valorDefault: 'claude-sonnet-4-20250514',
    descripcion: 'Modelo de Claude usado por el asistente IA',
    tipo: 'select',
    opciones: [
      { value: 'claude-opus-4-5-20251101',  label: 'Claude Opus 4.5 (más potente)' },
      { value: 'claude-sonnet-4-20250514',  label: 'Claude Sonnet 4 (recomendado)' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (más rápido)' },
    ],
  },
  {
    clave: 'max_tokens',
    valorDefault: '1024',
    descripcion: 'Máximo de tokens por respuesta del asistente',
    tipo: 'number',
    min: 256,
    max: 4096,
    step: 256,
  },
  {
    clave: 'system_prompt_base',
    valorDefault: '',
    descripcion: 'Prompt base del asistente IA. Se combina con el conocimiento de cada empresa.',
    tipo: 'textarea',
  },
  {
    clave: 'onboarding_secuencial',
    valorDefault: 'true',
    descripcion: 'Si está activo, los módulos se desbloquean uno a uno en orden',
    tipo: 'toggle',
  },
  {
    clave: 'max_empleados_por_empresa',
    valorDefault: '50',
    descripcion: 'Límite de empleados activos por empresa en el plan base',
    tipo: 'number',
    min: 1,
    max: 500,
    step: 1,
  },
]

/** Valores default como mapa para fácil acceso */
const DEFAULTS_MAP: ConfigMap = Object.fromEntries(
  CONFIGS.map(c => [c.clave, c.valorDefault])
)

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Helpers de UI
// ─────────────────────────────────────────────

function inputCls(): string {
  return [
    'w-full h-9 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-amber-500/60',
  ].join(' ')
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatClave(clave: string): string {
  return clave
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

// ─────────────────────────────────────────────
// Toggle switch
// ─────────────────────────────────────────────

function Toggle({
  activo,
  onChange,
}: {
  activo: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onChange(!activo)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full flex-shrink-0
        transition-colors duration-200 focus-visible:outline-none cursor-pointer
        ${activo ? 'bg-amber-500' : 'bg-white/[0.12]'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{ translateX: activo ? '18px' : '2px' }}
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm"
      />
    </button>
  )
}

// ─────────────────────────────────────────────
// Skeleton de carga
// ─────────────────────────────────────────────

function SkeletonConfig() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="shimmer h-5 w-44 rounded-lg" />
          <div className="shimmer h-3.5 w-64 rounded" />
        </div>
        <div className="shimmer h-8 w-28 rounded-lg" />
      </div>
      {/* Card skeletons */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="shimmer glass-card rounded-xl h-28" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Estado: tabla no encontrada
// ─────────────────────────────────────────────

function TablaNoEncontrada({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-white/90">Configuración</h1>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-white/80">
            Tabla <code className="text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded text-xs font-mono">app_config</code> no encontrada
          </h2>
        </div>
        <p className="text-sm text-white/45 leading-relaxed">
          Ejecutá el siguiente SQL en el Editor de Supabase para crearla con los valores por defecto:
        </p>
        <pre className="text-xs text-teal-300/80 bg-white/[0.03] border border-white/[0.06]
          rounded-lg p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
{`CREATE TABLE app_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT UNIQUE NOT NULL,
  valor       TEXT,
  descripcion TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Valores por defecto
INSERT INTO app_config (clave, valor, descripcion) VALUES
  ('claude_model',              'claude-sonnet-4-20250514', 'Modelo de Claude usado por el asistente IA'),
  ('max_tokens',                '1024',                     'Máximo de tokens por respuesta del asistente'),
  ('system_prompt_base',        '',                         'Prompt base del asistente IA'),
  ('onboarding_secuencial',     'true',                     'Si está activo, módulos se desbloquean en orden'),
  ('max_empleados_por_empresa', '50',                       'Límite de empleados activos por empresa')
ON CONFLICT (clave) DO NOTHING;

-- RLS: solo devs pueden leer/escribir
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_dev_select" ON app_config
  FOR SELECT USING (get_my_rol() = 'dev');
CREATE POLICY "app_config_dev_insert" ON app_config
  FOR INSERT WITH CHECK (get_my_rol() = 'dev');
CREATE POLICY "app_config_dev_update" ON app_config
  FOR UPDATE USING (get_my_rol() = 'dev') WITH CHECK (get_my_rol() = 'dev');`}
        </pre>
        <Button variant="secondary" size="sm" onClick={onReintentar}>
          Reintentar conexión
        </Button>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Card de configuración individual
// ─────────────────────────────────────────────

function ConfigCard({
  def,
  valor,
  onChange,
}: {
  def: ConfigDef
  valor: string
  onChange: (v: string) => void
}) {
  const icono = (() => {
    if (def.clave === 'claude_model' || def.clave === 'max_tokens') return <Bot className="w-3.5 h-3.5 text-amber-400/70" />
    if (def.clave === 'system_prompt_base') return <FileText className="w-3.5 h-3.5 text-amber-400/70" />
    if (def.clave === 'onboarding_secuencial') return <Sliders className="w-3.5 h-3.5 text-amber-400/70" />
    return <Building2 className="w-3.5 h-3.5 text-amber-400/70" />
  })()

  return (
    <motion.div variants={cardVariants}>
      <Card padding="md">
        <div className="space-y-3">
          {/* Header de la card */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{icono}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/80">
                {formatClave(def.clave)}
              </p>
              <p className="text-xs text-white/35 mt-0.5 leading-relaxed">
                {def.descripcion}
              </p>
            </div>
            <code className="text-[10px] font-mono text-amber-300/50 bg-amber-500/[0.08]
              border border-amber-500/[0.12] px-1.5 py-0.5 rounded flex-shrink-0">
              {def.clave}
            </code>
          </div>

          {/* Input según tipo */}
          <div>
            {def.tipo === 'select' && def.opciones && (
              <select
                value={valor}
                onChange={e => onChange(e.target.value)}
                className={inputCls() + ' appearance-none cursor-pointer'}
              >
                {def.opciones.map(op => (
                  <option key={op.value} value={op.value} className="bg-[#111110]">
                    {op.label}
                  </option>
                ))}
              </select>
            )}

            {def.tipo === 'number' && (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={def.min}
                  max={def.max}
                  step={def.step}
                  value={valor}
                  onChange={e => onChange(e.target.value)}
                  className={inputCls() + ' max-w-xs'}
                />
                <span className="text-xs text-white/30 whitespace-nowrap">
                  {def.min}–{def.max}
                </span>
              </div>
            )}

            {def.tipo === 'textarea' && (
              <textarea
                value={valor}
                onChange={e => onChange(e.target.value)}
                rows={8}
                placeholder="Instrucciones globales para el asistente IA de todas las empresas. Se antepone al prompt de cada empresa."
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
                  text-white/85 placeholder:text-white/20 outline-none resize-y min-h-[140px] font-mono
                  focus:bg-white/[0.06] focus:border-amber-500/60 transition-colors duration-150 leading-relaxed"
              />
            )}

            {def.tipo === 'toggle' && (
              <div className="flex items-center gap-3">
                <Toggle
                  activo={valor === 'true'}
                  onChange={v => onChange(v ? 'true' : 'false')}
                />
                <span className="text-xs text-white/40">
                  {valor === 'true' ? 'Activado' : 'Desactivado'}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ConfigPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [tablaNoEncontrada, setTablaNoEncontrada] = useState(false)
  const [config, setConfig] = useState<ConfigMap>({ ...DEFAULTS_MAP })
  const [original, setOriginal] = useState<ConfigMap>({ ...DEFAULTS_MAP })
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null)

  // Detecta si hay cambios sin guardar
  const hayNoGuardados = useMemo(() => {
    return CONFIGS.some(c => config[c.clave] !== original[c.clave])
  }, [config, original])

  // ── Carga inicial ──
  const cargarConfig = useCallback(async () => {
    setLoading(true)
    setTablaNoEncontrada(false)

    try {
      const supabase = createClient()

      // Verificar sesión y rol
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!perfil || perfil.rol !== 'dev') {
        router.push('/admin')
        return
      }

      // Leer toda la tabla app_config
      const { data: rows, error } = await supabase
        .from('app_config')
        .select('clave, valor, descripcion, updated_at')

      if (error) {
        // La tabla no existe o no es accesible
        setTablaNoEncontrada(true)
        return
      }

      // Construir mapa con valores de DB, completando con defaults los que falten
      const dbMap: ConfigMap = {}
      let maxUpdatedAt = ''

      for (const row of (rows as ConfigRow[])) {
        dbMap[row.clave] = row.valor ?? ''
        if (row.updated_at > maxUpdatedAt) maxUpdatedAt = row.updated_at
      }

      // Insertar defaults para claves que no existen en DB
      const clavesEnDb = new Set(Object.keys(dbMap))
      const faltantes = CONFIGS.filter(c => !clavesEnDb.has(c.clave))

      if (faltantes.length > 0) {
        const inserts = faltantes.map(c => ({
          clave: c.clave,
          valor: c.valorDefault,
          descripcion: c.descripcion,
          updated_at: new Date().toISOString(),
        }))

        const { error: insertError } = await supabase
          .from('app_config')
          .upsert(inserts, { onConflict: 'clave' })

        if (insertError) {
          console.error('Error al insertar configs faltantes:', insertError)
        } else {
          // Agregar al mapa local
          for (const c of faltantes) {
            dbMap[c.clave] = c.valorDefault
          }
        }
      }

      // Merge: defaults para claves que no llegaron del DB
      const estadoFinal: ConfigMap = { ...DEFAULTS_MAP, ...dbMap }
      setConfig(estadoFinal)
      setOriginal(estadoFinal)

      if (maxUpdatedAt) setUltimoGuardado(maxUpdatedAt)
    } catch (err) {
      console.error('Error al cargar configuración:', err)
      setTablaNoEncontrada(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    cargarConfig()
  }, [cargarConfig])

  // ── Guardar todos los cambios ──
  async function handleGuardar() {
    if (!hayNoGuardados) return
    setGuardando(true)

    try {
      const supabase = createClient()

      // Doble check de permisos en cliente
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Sin sesión'); return }

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!perfil || perfil.rol !== 'dev') {
        toast.error('Sin permisos para modificar la configuración')
        return
      }

      const ahora = new Date().toISOString()

      // Upsert de todas las claves en una sola operación
      const payload = CONFIGS.map(c => ({
        clave: c.clave,
        valor: config[c.clave] ?? c.valorDefault,
        descripcion: c.descripcion,
        updated_at: ahora,
      }))

      const { error } = await supabase
        .from('app_config')
        .upsert(payload, { onConflict: 'clave' })

      if (error) {
        toast.error('Error al guardar: ' + error.message)
        return
      }

      // Actualizar estado "original" para resetear el badge de cambios
      setOriginal({ ...config })
      setUltimoGuardado(ahora)
      toast.success('Configuración guardada correctamente')
    } catch (err) {
      console.error('Error inesperado al guardar:', err)
      toast.error('No se pudo guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  // ── Actualizar un valor en el mapa ──
  function setValor(clave: string, valor: string) {
    setConfig(prev => ({ ...prev, [clave]: valor }))
  }

  // ─────────────────────────────────────────────
  // Renders condicionales
  // ─────────────────────────────────────────────

  if (loading) return <SkeletonConfig />

  if (tablaNoEncontrada) return <TablaNoEncontrada onReintentar={cargarConfig} />

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-2xl"
    >
      {/* Encabezado */}
      <motion.div variants={cardVariants} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white/90">Configuración de la app</h1>
          <div className="flex items-center gap-2 mt-1">
            {ultimoGuardado ? (
              <span className="flex items-center gap-1.5 text-xs text-white/35">
                <Clock className="w-3 h-3" />
                Último guardado: {formatFecha(ultimoGuardado)}
              </span>
            ) : (
              <span className="text-xs text-white/25">Sin cambios guardados aún</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Badge de cambios sin guardar */}
          <AnimatePresence>
            {hayNoGuardados && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                <Badge variant="warning">Sin guardar</Badge>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badge de guardado exitoso */}
          <AnimatePresence>
            {!hayNoGuardados && ultimoGuardado && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="flex items-center gap-1.5 text-xs text-teal-400"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Al día
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="primary"
            size="sm"
            loading={guardando}
            disabled={!hayNoGuardados}
            onClick={handleGuardar}
          >
            <Save className="w-3.5 h-3.5" />
            Guardar cambios
          </Button>
        </div>
      </motion.div>

      {/* Cards de configuración */}
      {CONFIGS.map(def => (
        <ConfigCard
          key={def.clave}
          def={def}
          valor={config[def.clave] ?? def.valorDefault}
          onChange={v => setValor(def.clave, v)}
        />
      ))}

      {/* Footer: nota de seguridad */}
      <motion.div
        variants={cardVariants}
        className="flex items-start gap-2.5 px-4 py-3 rounded-xl
          bg-amber-500/[0.05] border border-amber-500/[0.12]"
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/50 leading-relaxed">
          Estas configuraciones afectan a todas las empresas en la plataforma.
          Los cambios tienen efecto inmediato en el próximo request de chat.
          Solo usuarios con rol <code className="font-mono text-amber-300/70">dev</code> pueden
          modificar esta sección (RLS en base de datos garantiza esto también).
        </p>
      </motion.div>
    </motion.div>
  )
}

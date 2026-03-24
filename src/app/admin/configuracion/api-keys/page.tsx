'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Key, Plus, Copy, Check, X, Trash2, AlertTriangle, Eye, EyeOff,
  ShieldCheck, Clock, Zap, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ApiKeyRecord, ApiKeyScope, API_KEY_SCOPES } from '@/lib/api/apiKeys'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface KeyListItem extends Omit<ApiKeyRecord, 'empresa_id'> {}

type ExpiresOption = 'never' | '30' | '90' | '365'

const EXPIRES_LABELS: Record<ExpiresOption, string> = {
  never: 'Sin vencimiento',
  '30': '30 días',
  '90': '90 días',
  '365': '1 año',
}

const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'empleados:read':  'empleados:read',
  'empleados:write': 'empleados:write',
  'progreso:read':   'progreso:read',
  'encuestas:read':  'encuestas:read',
  'webhooks:write':  'webhooks:write',
}

// Read scopes → teal, Write scopes → indigo
function scopeVariant(scope: ApiKeyScope): 'info' | 'default' {
  return scope.endsWith(':write') ? 'default' : 'info'
}

// ─────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

// ─────────────────────────────────────────────
// Subcomponente: Badge de scope
// ─────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: ApiKeyScope }) {
  return (
    <Badge variant={scopeVariant(scope)} className="font-mono text-[10px]">
      {scope}
    </Badge>
  )
}

// ─────────────────────────────────────────────
// Subcomponente: Fila de key
// ─────────────────────name────────────────────

interface KeyRowProps {
  apiKey: KeyListItem
  onRevoke: (id: string) => void
  revoking: string | null
}

function KeyRow({ apiKey, onRevoke, revoking }: KeyRowProps) {
  const [confirmando, setConfirmando] = useState(false)
  const expired = isExpired(apiKey.expires_at)
  const inactiva = !apiKey.activa || expired

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={cn(
        'rounded-xl border p-4 transition-colors duration-150',
        'bg-[#0F1F3D]/60 border-white/10 backdrop-blur-sm',
        inactiva && 'opacity-50'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Info principal */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium text-sm truncate">{apiKey.nombre}</span>
            {inactiva && (
              <Badge variant="error">
                {!apiKey.activa ? 'Revocada' : 'Expirada'}
              </Badge>
            )}
          </div>

          {/* Prefix + scopes */}
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[#0D9488] font-mono text-xs bg-[#0D9488]/10 px-2 py-0.5 rounded-md border border-[#0D9488]/20">
              {apiKey.key_prefix}…
            </code>
            {apiKey.scopes.map((s) => (
              <ScopeBadge key={s} scope={s} />
            ))}
          </div>

          {/* Metadatos */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-white/40">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              Creada {formatDate(apiKey.created_at)}
            </span>
            {apiKey.last_used && (
              <span className="flex items-center gap-1">
                <Zap size={10} />
                Último uso {formatDate(apiKey.last_used)}
              </span>
            )}
            {apiKey.expires_at && (
              <span className={cn('flex items-center gap-1', expired && 'text-red-400')}>
                <ShieldCheck size={10} />
                Expira {formatDate(apiKey.expires_at)}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        {apiKey.activa && !expired && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <AnimatePresence mode="wait">
              {confirmando ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs text-red-300 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    ¿Revocar?
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={revoking === apiKey.id}
                    onClick={() => onRevoke(apiKey.id)}
                  >
                    Sí, revocar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmando(false)}
                  >
                    <X size={14} />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmando(true)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                    Revocar
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Subcomponente: Modal nueva API key
// ─────────────────────────────────────────────

interface NuevaKeyModalProps {
  onClose: () => void
  onCreated: (key: string, record: KeyListItem) => void
}

function NuevaKeyModal({ onClose, onCreated }: NuevaKeyModalProps) {
  const [step, setStep] = useState<'form' | 'reveal'>('form')
  const [nombre, setNombre] = useState('')
  const [scopes, setScopes] = useState<ApiKeyScope[]>([])
  const [expires, setExpires] = useState<ExpiresOption>('never')
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [copied, setCopied] = useState(false)

  function toggleScope(scope: ApiKeyScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  async function handleCrear() {
    if (!nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (scopes.length === 0) {
      toast.error('Seleccioná al menos un scope')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = { nombre: nombre.trim(), scopes }
      if (expires !== 'never') body.expiresInDays = parseInt(expires)

      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear la API key')

      setNewKey(data.key)
      setStep('reveal')
      onCreated(data.key, data.record)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'reveal') onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F1F3D] shadow-2xl overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 flex flex-col gap-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-[#3B4FD8]/20">
                    <Key size={16} className="text-[#3B4FD8]" />
                  </div>
                  <h2 className="text-white font-semibold text-base">Nueva API key</h2>
                </div>
                <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Integración ERP, Bot de Slack…"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={100}
                  className={cn(
                    'w-full rounded-lg border border-white/10 bg-white/5',
                    'px-3 py-2.5 text-sm text-white placeholder-white/30',
                    'focus:outline-none focus:ring-2 focus:ring-[#3B4FD8]/50 focus:border-[#3B4FD8]/40',
                    'transition-colors duration-150'
                  )}
                />
              </div>

              {/* Scopes */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Permisos</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {API_KEY_SCOPES.map((scope) => {
                    const checked = scopes.includes(scope)
                    const isWrite = scope.endsWith(':write')
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleScope(scope)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                          'border transition-all duration-150',
                          checked
                            ? isWrite
                              ? 'border-[#3B4FD8]/40 bg-[#3B4FD8]/15 text-white'
                              : 'border-[#0D9488]/40 bg-[#0D9488]/15 text-white'
                            : 'border-white/8 bg-white/[0.03] text-white/50 hover:border-white/15 hover:bg-white/[0.05]'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all',
                          checked
                            ? isWrite ? 'border-[#3B4FD8] bg-[#3B4FD8]' : 'border-[#0D9488] bg-[#0D9488]'
                            : 'border-white/20'
                        )}>
                          {checked && <Check size={10} className="text-white" />}
                        </div>
                        <code className="text-xs font-mono">{SCOPE_LABELS[scope]}</code>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Expiración */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Expiración</label>
                <select
                  value={expires}
                  onChange={(e) => setExpires(e.target.value as ExpiresOption)}
                  className={cn(
                    'w-full rounded-lg border border-white/10 bg-[#0F1F3D]',
                    'px-3 py-2.5 text-sm text-white',
                    'focus:outline-none focus:ring-2 focus:ring-[#3B4FD8]/50',
                    'transition-colors duration-150 cursor-pointer'
                  )}
                >
                  {(Object.keys(EXPIRES_LABELS) as ExpiresOption[]).map((k) => (
                    <option key={k} value={k}>{EXPIRES_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              {/* Footer */}
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" onClick={onClose} className="flex-1">
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleCrear} loading={loading} className="flex-1">
                  Crear key
                  <ChevronRight size={14} />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 flex flex-col gap-5"
            >
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#0D9488]/20">
                  <ShieldCheck size={16} className="text-[#0D9488]" />
                </div>
                <h2 className="text-white font-semibold text-base">API key creada</h2>
              </div>

              {/* Alerta */}
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs leading-relaxed">
                  <strong>Guardá esta key ahora.</strong> No podrás verla de nuevo — solo almacenamos el hash.
                </p>
              </div>

              {/* Key */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Tu API key</label>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex-1 rounded-lg border border-[#0D9488]/30 bg-black/40',
                    'px-3 py-3 font-mono text-sm text-[#0D9488] break-all select-all',
                    'min-w-0'
                  )}>
                    {newKey}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex-shrink-0 p-2.5 rounded-lg border transition-all duration-150',
                      copied
                        ? 'border-[#0D9488]/50 bg-[#0D9488]/15 text-[#0D9488]'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    )}
                    title="Copiar"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <Button variant="primary" onClick={onClose} className="w-full">
                Entendido, ya la guardé
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const cargarKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/api-keys')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar API keys')
      setKeys(data.keys ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarKeys()
  }, [cargarKeys])

  const handleRevoke = useCallback(async (id: string) => {
    setRevoking(id)
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al revocar la API key')

      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, activa: false } : k))
      toast.success('API key revocada correctamente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setRevoking(null)
    }
  }, [])

  function handleCreated(key: string, record: KeyListItem) {
    setKeys((prev) => [record, ...prev])
    toast.success('API key creada correctamente')
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-white">API Keys</h1>
            <p className="text-sm text-white/50">
              Gestioná las claves de acceso para integraciones externas con la API de Heero.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={14} />
            Nueva API key
          </Button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-white/10 bg-[#0F1F3D]/60 animate-pulse"
              />
            ))}
          </div>
        ) : keys.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center justify-center gap-4 py-16 text-center rounded-2xl border border-white/8 bg-[#0F1F3D]/40"
          >
            <div className="p-4 rounded-2xl bg-[#3B4FD8]/10 border border-[#3B4FD8]/20">
              <Key size={28} className="text-[#3B4FD8]/70" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-white/80 font-medium">Sin API keys todavía</p>
              <p className="text-white/40 text-sm max-w-xs">
                Creá tu primera API key para conectar servicios externos con la plataforma.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
              <Plus size={14} />
              Crear primera key
            </Button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {keys.map((k) => (
                <KeyRow
                  key={k.id}
                  apiKey={k}
                  onRevoke={handleRevoke}
                  revoking={revoking}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <NuevaKeyModal
            onClose={() => setShowModal(false)}
            onCreated={(key, record) => {
              handleCreated(key, record)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

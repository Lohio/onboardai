'use client'

// ─────────────────────────────────────────────
// Tab "Perfil" (edición) del detalle de empleado
// ─────────────────────────────────────────────

import type { Dispatch, SetStateAction } from 'react'
import {
  CalendarDays, Zap, CheckCircle2, Circle, Clock, AlertCircle,
  RotateCcw, Lock, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { ModuloReset } from '@/components/admin/ResetProgresoModal'
import type { UserRole } from '@/types'
import type { EmpleadoFull, FormData, ProgresoModulo, AlertaRow, ColaboradorRow } from './types'
import { formatFecha, tiempoRelativo, inputCls, MODULOS_CONFIG } from './helpers'
import { SeccionAccesos, type SeccionAccesosProps } from './SeccionAccesos'

export interface TabEdicionProps extends SeccionAccesosProps {
  empleado: EmpleadoFull
  form: FormData
  rolAdmin: UserRole
  colaboradores: ColaboradorRow[]
  modulos: ProgresoModulo[]
  alertas: AlertaRow[]
  setField: (key: keyof FormData, value: string) => void
  showPassCorp: boolean
  setShowPassCorp: Dispatch<SetStateAction<boolean>>
  showPassBitlocker: boolean
  setShowPassBitlocker: Dispatch<SetStateAction<boolean>>
  togglingPreboarding: boolean
  togglePreboarding: () => void
  setResetModal: Dispatch<SetStateAction<ModuloReset | null>>
}

export function TabEdicion(props: TabEdicionProps) {
  const {
    empleado, form, rolAdmin, colaboradores, modulos, alertas, accesos,
    setField, showPassCorp, setShowPassCorp, showPassBitlocker, setShowPassBitlocker,
    togglingPreboarding, togglePreboarding, setResetModal,
  } = props

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* ── Formulario ── */}
      <div className="lg:col-span-3 glass-card rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white/70">Datos personales</h2>

        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">Nombre completo</label>
          <input type="text" value={form.nombre} onChange={e => setField('nombre', e.target.value)} className={inputCls()} />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">
            Email <span className="text-white/25">(no editable)</span>
          </label>
          <input type="email" value={empleado.email} readOnly
            className="w-full h-9 px-3 rounded-lg text-sm bg-white/[0.02] border border-white/[0.05] text-white/40 outline-none cursor-not-allowed"
          />
        </div>

        {/* Contraseñas corporativas — solo visibles para admins */}
        {['admin', 'dev'].includes(rolAdmin) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Contraseña corporativa
                <Badge variant="info" className="ml-1">Solo admins</Badge>
              </label>
              <div className="relative">
                <input
                  type={showPassCorp ? 'text' : 'password'}
                  value={form.password_corporativo}
                  onChange={e => setField('password_corporativo', e.target.value)}
                  placeholder="Contraseña de acceso corporativo"
                  className={inputCls() + ' pr-9'}
                />
                <button type="button" onClick={() => setShowPassCorp(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPassCorp ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-1">🔒 Visible solo para admins</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Password BitLocker
                <Badge variant="info" className="ml-1">Solo admins</Badge>
              </label>
              <div className="relative">
                <input
                  type={showPassBitlocker ? 'text' : 'password'}
                  value={form.password_bitlocker}
                  onChange={e => setField('password_bitlocker', e.target.value)}
                  placeholder="Clave de recuperación BitLocker"
                  className={inputCls() + ' pr-9'}
                />
                <button type="button" onClick={() => setShowPassBitlocker(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPassBitlocker ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-1">🔒 Visible solo para admins</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Puesto</label>
            <input type="text" value={form.puesto} onChange={e => setField('puesto', e.target.value)} className={inputCls()} placeholder="Ej: Desarrollador" />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Área</label>
            <input type="text" value={form.area} onChange={e => setField('area', e.target.value)} className={inputCls()} placeholder="Ej: Producto" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Fecha de ingreso</label>
            <input type="date" value={form.fecha_ingreso} onChange={e => setField('fecha_ingreso', e.target.value)} className={inputCls()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Modalidad</label>
            <select value={form.modalidad} onChange={e => setField('modalidad', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
              <option value="" className="bg-[#111110]">Sin definir</option>
              <option value="presencial" className="bg-[#111110]">Presencial</option>
              <option value="remoto" className="bg-[#111110]">Remoto</option>
              <option value="hibrido" className="bg-[#111110]">Híbrido</option>
            </select>
          </div>
        </div>

        {/* Contactos clave */}
        <div className="pt-1">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-white/70 whitespace-nowrap">Contactos clave</h3>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">Manager</label>
              <select value={form.manager_id} onChange={e => setField('manager_id', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                <option value="" className="bg-[#111110]">Sin asignar</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#111110]">{c.nombre} — {c.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">Buddy</label>
              <select value={form.buddy_id} onChange={e => setField('buddy_id', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                <option value="" className="bg-[#111110]">Sin asignar</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#111110]">{c.nombre} — {c.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-medium text-sky-400/80 mb-2.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400/70" />
              Contacto IT
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">Nombre</label>
                <input type="text" value={form.contacto_it_nombre} onChange={e => setField('contacto_it_nombre', e.target.value)} className={inputCls()} placeholder="Nombre del contacto IT" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
                <input type="email" value={form.contacto_it_email} onChange={e => setField('contacto_it_email', e.target.value)} className={inputCls()} placeholder="it@empresa.com" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-amber-400/80 mb-2.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/70" />
              Contacto RRHH
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">Nombre</label>
                <input type="text" value={form.contacto_rrhh_nombre} onChange={e => setField('contacto_rrhh_nombre', e.target.value)} className={inputCls()} placeholder="Nombre del contacto RRHH" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
                <input type="email" value={form.contacto_rrhh_email} onChange={e => setField('contacto_rrhh_email', e.target.value)} className={inputCls()} placeholder="rrhh@empresa.com" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Accesos y herramientas ── */}
        <SeccionAccesos {...props} />

        {/* Rol */}
        {['admin', 'dev'].includes(rolAdmin) && (
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">
              Rol <Badge variant="info" className="ml-2">Solo admins</Badge>
            </label>
            <select value={form.rol} onChange={e => setField('rol', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
              <option value="empleado" className="bg-[#111110]">Empleado</option>
              <option value="admin" className="bg-[#111110]">Admin</option>
              {rolAdmin === 'dev' && <option value="dev" className="bg-[#111110]">Dev</option>}
            </select>
          </div>
        )}

        {/* Bio */}
        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">Sobre el empleado</label>
          <textarea
            value={form.bio} onChange={e => setField('bio', e.target.value)} rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
              text-white/85 placeholder:text-white/20 outline-none resize-none
              focus:bg-white/[0.06] focus:border-[#0EA5E9]/60 transition-colors duration-150"
            placeholder="Breve descripción del empleado..."
          />
        </div>

        {empleado.fecha_ingreso && (
          <p className="text-xs text-white/30">Ingresó el {formatFecha(empleado.fecha_ingreso)}</p>
        )}
      </div>

      {/* ── Panel derecho ── */}
      <div className="lg:col-span-2 space-y-5">

        {/* Pre-boarding */}
        {empleado.fecha_ingreso && new Date(empleado.fecha_ingreso) > new Date() && (
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#38BDF8]" />
                <h2 className="text-sm font-semibold text-white/70">Pre-boarding</h2>
              </div>
              {empleado.preboarding_activo && <Badge variant="success">Activo</Badge>}
            </div>
            {empleado.preboarding_activo ? (
              <div className="mb-3 space-y-1">
                <p className="text-xs text-white/55">El empleado puede acceder a M1 y M2 antes de su ingreso oficial.</p>
                {empleado.fecha_acceso_preboarding && (
                  <p className="text-[11px] text-white/30">Activado el {formatFecha(empleado.fecha_acceso_preboarding)}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/35 mb-3">
                El empleado no tiene acceso aún. Activá el pre-boarding para que explore la cultura antes de su ingreso.
              </p>
            )}
            <Button variant={empleado.preboarding_activo ? 'ghost' : 'primary'} size="sm"
              loading={togglingPreboarding} onClick={togglePreboarding} className="w-full">
              <Zap className="w-3.5 h-3.5" />
              {empleado.preboarding_activo ? 'Desactivar pre-boarding' : 'Activar pre-boarding'}
            </Button>
          </div>
        )}

        {/* Progreso por módulo */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/70">Progreso por módulo</h2>

          <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-xs text-gray-900">Perfil</span>
            </div>
            <Badge variant="success">Completado</Badge>
          </div>

          {MODULOS_CONFIG.map((mod, idx) => {
            const data = modulos.find(m => m.modulo === mod.key)
            const pct = data?.pct ?? 0
            const completados = data?.completados ?? 0
            const total = data?.total ?? 1
            return (
              <div key={mod.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {pct >= 100
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                      : pct > 0
                        ? <Circle className="w-3.5 h-3.5 text-[#38BDF8]" />
                        : <Circle className="w-3.5 h-3.5 text-white/20" />
                    }
                    <span className={`text-xs ${mod.color}`}>{mod.label}</span>
                  </div>
                  <button onClick={() => setResetModal(mod.key)}
                    className="flex items-center gap-1 text-[10px] text-white/25 hover:text-amber-400/70 transition-colors duration-150"
                    title={`Resetear ${mod.label}`}>
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                </div>
                <ProgressBar value={pct} showPercentage={false} />
                <p className="text-[11px] text-white/30">
                  {mod.key === 'asistente'
                    ? completados > 0 ? 'Tiene conversaciones' : 'Sin conversaciones'
                    : `${completados} / ${total} bloques`}
                </p>
                {idx < MODULOS_CONFIG.length - 1 && <div className="border-b border-white/[0.04] pt-1" />}
              </div>
            )
          })}

          <div className="flex justify-center mt-1">
            <button
              onClick={() => setResetModal('todos')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-sm font-medium transition-colors duration-150"
              style={{ color: 'white' }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetear todo el progreso
            </button>
          </div>

          {/* Mini resumen de accesos */}
          {accesos.length > 0 && (
            <p className="text-[11px] text-white/30 text-center pt-1">
              Accesos:{' '}
              <span className="text-teal-400/70">
                {accesos.filter(a => a.estado === 'activo').length} activos
              </span>
              {' · '}
              <span className="text-amber-400/70">
                {accesos.filter(a => a.estado === 'pendiente').length} pendientes
              </span>
            </p>
          )}
        </div>

        {/* Alertas */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/70">Alertas del empleado</h2>
          {alertas.length === 0 ? (
            <p className="text-xs text-white/30 py-4 text-center">Sin alertas registradas</p>
          ) : (
            <div className="space-y-2">
              {alertas.map(alerta => (
                <div key={alerta.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  {alerta.resuelta
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/70 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/65 line-clamp-2">{alerta.pregunta}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-2.5 h-2.5 text-white/20" />
                      <span className="text-[10px] text-white/30">{tiempoRelativo(alerta.created_at)}</span>
                      {alerta.resuelta && <Badge variant="success" className="text-[10px] py-0">Resuelta</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

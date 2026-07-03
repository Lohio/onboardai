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
import { useLanguage } from '@/components/LanguageProvider'

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
  const { t } = useLanguage()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* ── Formulario ── */}
      <div className="lg:col-span-3 glass-card rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white/70">{t('adminEmp.edit.personalData')}</h2>

        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.modal.fullName')}</label>
          <input type="text" value={form.nombre} onChange={e => setField('nombre', e.target.value)} className={inputCls()} />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">
            {t('adminEmp.modal.email')} <span className="text-white/25">{t('adminEmp.edit.notEditable')}</span>
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
                {t('adminEmp.edit.corpPassword')}
                <Badge variant="info" className="ml-1">{t('adminEmp.edit.adminsOnly')}</Badge>
              </label>
              <div className="relative">
                <input
                  type={showPassCorp ? 'text' : 'password'}
                  value={form.password_corporativo}
                  onChange={e => setField('password_corporativo', e.target.value)}
                  placeholder={t('adminEmp.edit.corpPasswordPh')}
                  className={inputCls() + ' pr-9'}
                />
                <button type="button" onClick={() => setShowPassCorp(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPassCorp ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-1">🔒 {t('adminEmp.edit.visibleAdmins')}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                {t('adminEmp.edit.bitlocker')}
                <Badge variant="info" className="ml-1">{t('adminEmp.edit.adminsOnly')}</Badge>
              </label>
              <div className="relative">
                <input
                  type={showPassBitlocker ? 'text' : 'password'}
                  value={form.password_bitlocker}
                  onChange={e => setField('password_bitlocker', e.target.value)}
                  placeholder={t('adminEmp.edit.bitlockerPh')}
                  className={inputCls() + ' pr-9'}
                />
                <button type="button" onClick={() => setShowPassBitlocker(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPassBitlocker ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-1">🔒 {t('adminEmp.edit.visibleAdmins')}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.modal.position')}</label>
            <input type="text" value={form.puesto} onChange={e => setField('puesto', e.target.value)} className={inputCls()} placeholder={t('adminEmp.edit.positionPh')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.modal.area')}</label>
            <input type="text" value={form.area} onChange={e => setField('area', e.target.value)} className={inputCls()} placeholder={t('adminEmp.edit.areaPh')} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.modal.startDate')}</label>
            <input type="date" value={form.fecha_ingreso} onChange={e => setField('fecha_ingreso', e.target.value)} className={inputCls()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.edit.modality')}</label>
            <select value={form.modalidad} onChange={e => setField('modalidad', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
              <option value="" className="bg-[#111110]">{t('adminEmp.edit.modalityNone')}</option>
              <option value="presencial" className="bg-[#111110]">{t('adminEmp.edit.modalityOnsite')}</option>
              <option value="remoto" className="bg-[#111110]">{t('adminEmp.edit.modalityRemote')}</option>
              <option value="hibrido" className="bg-[#111110]">{t('adminEmp.edit.modalityHybrid')}</option>
            </select>
          </div>
        </div>

        {/* Contactos clave */}
        <div className="pt-1">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-white/70 whitespace-nowrap">{t('adminEmp.edit.keyContacts')}</h3>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.edit.manager')}</label>
              <select value={form.manager_id} onChange={e => setField('manager_id', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                <option value="" className="bg-[#111110]">{t('adminEmp.edit.unassigned')}</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#111110]">{c.nombre} — {c.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.edit.buddy')}</label>
              <select value={form.buddy_id} onChange={e => setField('buddy_id', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                <option value="" className="bg-[#111110]">{t('adminEmp.edit.unassigned')}</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#111110]">{c.nombre} — {c.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-medium text-sky-400/80 mb-2.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400/70" />
              {t('adminEmp.edit.itContact')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">{t('adminEmp.edit.name')}</label>
                <input type="text" value={form.contacto_it_nombre} onChange={e => setField('contacto_it_nombre', e.target.value)} className={inputCls()} placeholder={t('adminEmp.edit.itContactPh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">{t('adminEmp.modal.email')}</label>
                <input type="email" value={form.contacto_it_email} onChange={e => setField('contacto_it_email', e.target.value)} className={inputCls()} placeholder="it@empresa.com" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-amber-400/80 mb-2.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/70" />
              {t('adminEmp.edit.hrContact')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">{t('adminEmp.edit.name')}</label>
                <input type="text" value={form.contacto_rrhh_nombre} onChange={e => setField('contacto_rrhh_nombre', e.target.value)} className={inputCls()} placeholder={t('adminEmp.edit.hrContactPh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">{t('adminEmp.modal.email')}</label>
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
              {t('adminEmp.modal.role')} <Badge variant="info" className="ml-2">{t('adminEmp.edit.adminsOnly')}</Badge>
            </label>
            <select value={form.rol} onChange={e => setField('rol', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
              <option value="empleado" className="bg-[#111110]">{t('adminEmp.modal.roleEmpleado')}</option>
              <option value="admin" className="bg-[#111110]">{t('adminEmp.modal.roleAdmin')}</option>
              {rolAdmin === 'dev' && <option value="dev" className="bg-[#111110]">Dev</option>}
            </select>
          </div>
        )}

        {/* Bio */}
        <div>
          <label className="block text-xs font-medium text-white/45 mb-1.5">{t('adminEmp.edit.about')}</label>
          <textarea
            value={form.bio} onChange={e => setField('bio', e.target.value)} rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
              text-white/85 placeholder:text-white/20 outline-none resize-none
              focus:bg-white/[0.06] focus:border-[#0EA5E9]/60 transition-colors duration-150"
            placeholder={t('adminEmp.edit.aboutPh')}
          />
        </div>

        {empleado.fecha_ingreso && (
          <p className="text-xs text-white/30">{t('adminEmp.edit.joinedOn')} {formatFecha(empleado.fecha_ingreso)}</p>
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
                <h2 className="text-sm font-semibold text-white/70">{t('adminEmp.edit.preboarding')}</h2>
              </div>
              {empleado.preboarding_activo && <Badge variant="success">{t('adminEmp.edit.active')}</Badge>}
            </div>
            {empleado.preboarding_activo ? (
              <div className="mb-3 space-y-1">
                <p className="text-xs text-white/55">{t('adminEmp.edit.preboardingOn')}</p>
                {empleado.fecha_acceso_preboarding && (
                  <p className="text-[11px] text-white/30">{t('adminEmp.edit.activatedOn')} {formatFecha(empleado.fecha_acceso_preboarding)}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/35 mb-3">
                {t('adminEmp.edit.preboardingOff')}
              </p>
            )}
            <Button variant={empleado.preboarding_activo ? 'ghost' : 'primary'} size="sm"
              loading={togglingPreboarding} onClick={togglePreboarding} className="w-full">
              <Zap className="w-3.5 h-3.5" />
              {empleado.preboarding_activo ? t('adminEmp.edit.preboardingOffBtn') : t('adminEmp.edit.preboardingOnBtn')}
            </Button>
          </div>
        )}

        {/* Progreso por módulo */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/70">{t('adminEmp.edit.moduleProgress')}</h2>

          <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-xs text-gray-900">{t('adminEmp.edit.profile')}</span>
            </div>
            <Badge variant="success">{t('adminEmp.edit.completed')}</Badge>
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
                    <span className={`text-xs ${mod.color}`}>{t(mod.labelKey)}</span>
                  </div>
                  <button onClick={() => setResetModal(mod.key)}
                    className="flex items-center gap-1 text-[10px] text-white/25 hover:text-amber-400/70 transition-colors duration-150"
                    title={`${t('adminEmp.edit.resetTitle')} ${t(mod.labelKey)}`}>
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                </div>
                <ProgressBar value={pct} showPercentage={false} />
                <p className="text-[11px] text-white/30">
                  {mod.key === 'asistente'
                    ? completados > 0 ? t('adminEmp.edit.hasConversations') : t('adminEmp.edit.noConversations')
                    : `${completados} / ${total} ${t('adminEmp.edit.blocks')}`}
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
              {t('adminEmp.edit.resetAll')}
            </button>
          </div>

          {/* Mini resumen de accesos */}
          {accesos.length > 0 && (
            <p className="text-[11px] text-white/30 text-center pt-1">
              {t('adminEmp.edit.accesses')}:{' '}
              <span className="text-teal-400/70">
                {accesos.filter(a => a.estado === 'activo').length} {t('adminEmp.edit.activeCount')}
              </span>
              {' · '}
              <span className="text-amber-400/70">
                {accesos.filter(a => a.estado === 'pendiente').length} {t('adminEmp.edit.pendingCount')}
              </span>
            </p>
          )}
        </div>

        {/* Alertas */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/70">{t('adminEmp.edit.alerts')}</h2>
          {alertas.length === 0 ? (
            <p className="text-xs text-white/30 py-4 text-center">{t('adminEmp.edit.noAlerts')}</p>
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
                      <span className="text-[10px] text-white/30">{tiempoRelativo(alerta.created_at, t)}</span>
                      {alerta.resuelta && <Badge variant="success" className="text-[10px] py-0">{t('adminEmp.edit.resolved')}</Badge>}
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

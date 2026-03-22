'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Trash2, AlertTriangle, ShieldCheck,
  Building2, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface UsuarioRow {
  id: string
  nombre: string
  email: string
  rol: UserRole
  empresa_id: string | null
  empresa_nombre: string | null
  created_at: string
}

interface EmpresaOption {
  id: string
  nombre: string
}

// ─────────────────────────────────────────────
// Badge de rol
// ─────────────────────────────────────────────

const ROL_VARIANT: Record<UserRole, 'default' | 'success' | 'warning'> = {
  empleado: 'default',
  admin: 'success',
  dev: 'warning',
}

// ─────────────────────────────────────────────
// Fila de usuario
// ─────────────────────────────────────────────

interface UsuarioFilaProps {
  usuario: UsuarioRow
  empresas: EmpresaOption[]
  currentDevId: string
  onUpdated: (id: string, changes: Partial<UsuarioRow>) => void
  onDeleted: (id: string) => void
}

function UsuarioFila({ usuario, empresas, currentDevId, onUpdated, onDeleted }: UsuarioFilaProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingRol, setSavingRol] = useState(false)
  const [savingEmpresa, setSavingEmpresa] = useState(false)

  const esMismoCuenta = usuario.id === currentDevId

  async function handleRolChange(nuevoRol: string) {
    setSavingRol(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('usuarios')
        .update({ rol: nuevoRol })
        .eq('id', usuario.id)
      if (error) { toast.error(error.message); return }
      toast.success(`Rol cambiado a ${nuevoRol}`)
      onUpdated(usuario.id, { rol: nuevoRol as UserRole })
    } catch {
      toast.error('Error al cambiar rol')
    } finally {
      setSavingRol(false)
    }
  }

  async function handleEmpresaChange(nuevoEmpresaId: string) {
    setSavingEmpresa(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('usuarios')
        .update({ empresa_id: nuevoEmpresaId || null })
        .eq('id', usuario.id)
      if (error) { toast.error(error.message); return }
      const emp = empresas.find(e => e.id === nuevoEmpresaId)
      toast.success(`Empresa cambiada a ${emp?.nombre ?? 'Sin empresa'}`)
      onUpdated(usuario.id, {
        empresa_id: nuevoEmpresaId || null,
        empresa_nombre: emp?.nombre ?? null,
      })
    } catch {
      toast.error('Error al cambiar empresa')
    } finally {
      setSavingEmpresa(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/empleados/${usuario.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        toast.error(d.error ?? 'Error al eliminar')
        setConfirmDelete(false)
        return
      }
      toast.success(`${usuario.nombre} eliminado`)
      onDeleted(usuario.id)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeleting(false)
    }
  }

  const selectCls = 'h-7 px-2 rounded-md text-xs bg-white/[0.04] border border-white/[0.08] text-white/70 appearance-none outline-none focus:border-amber-500/60 cursor-pointer transition-colors'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="relative glass-card rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      {/* Identidad */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-full bg-[#0EA5E9]/15 border border-[#0EA5E9]/20
          flex items-center justify-center flex-shrink-0">
          <span className="text-[#7DD3FC] text-[10px] font-semibold">
            {usuario.nombre[0].toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white/80 truncate font-medium">{usuario.nombre}</p>
          <p className="text-xs text-white/35 truncate">{usuario.email}</p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
        {/* Rol */}
        <div className="relative flex items-center gap-1.5">
          {savingRol && <RefreshCw className="w-3 h-3 text-amber-400 animate-spin absolute -left-4" />}
          <select
            value={usuario.rol}
            onChange={e => handleRolChange(e.target.value)}
            disabled={esMismoCuenta || savingRol}
            className={selectCls + (esMismoCuenta ? ' opacity-50 cursor-not-allowed' : '')}
            title={esMismoCuenta ? 'No podés cambiar tu propio rol' : 'Cambiar rol'}
          >
            <option value="empleado" className="bg-[#111110]">Empleado</option>
            <option value="admin" className="bg-[#111110]">Admin</option>
            <option value="dev" className="bg-[#111110]">Dev</option>
          </select>
        </div>

        {/* Empresa */}
        <div className="relative flex items-center gap-1.5">
          {savingEmpresa && <RefreshCw className="w-3 h-3 text-amber-400 animate-spin absolute -left-4" />}
          <select
            value={usuario.empresa_id ?? ''}
            onChange={e => handleEmpresaChange(e.target.value)}
            disabled={savingEmpresa}
            className={selectCls}
            title="Cambiar empresa"
          >
            <option value="" className="bg-[#111110]">Sin empresa</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id} className="bg-[#111110]">{e.nombre}</option>
            ))}
          </select>
        </div>

        {/* Badge rol */}
        <Badge variant={ROL_VARIANT[usuario.rol]}>
          {usuario.rol}
        </Badge>

        {/* Eliminar */}
        {!esMismoCuenta && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-white/25 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/[0.06]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Confirmar eliminación */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl bg-[#111110]/95 backdrop-blur-sm
              border border-red-500/30 flex items-center justify-center gap-3 px-4"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-white/70 flex-1">
              ¿Eliminar <span className="font-semibold">{usuario.nombre}</span>?
            </p>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>No</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Sí</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function UsuariosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([])
  const [currentDevId, setCurrentDevId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<'' | UserRole>('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')

  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: ud } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (!ud || ud.rol !== 'dev') { router.push('/admin'); return }

      setCurrentDevId(user.id)

      const [{ data: usersData }, { data: empData }] = await Promise.all([
        supabase
          .from('usuarios')
          .select('id, nombre, email, rol, empresa_id, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('empresas')
          .select('id, nombre')
          .order('nombre'),
      ])

      const empMap: Record<string, string> = {}
      for (const e of (empData ?? [])) empMap[e.id] = e.nombre

      const rows: UsuarioRow[] = (usersData ?? []).map(u => ({
        ...u,
        rol: u.rol as UserRole,
        empresa_nombre: u.empresa_id ? (empMap[u.empresa_id] ?? null) : null,
      }))

      setUsuarios(rows)
      setEmpresas((empData ?? []) as EmpresaOption[])
    } catch (err) {
      console.error('Error cargando usuarios:', err)
      toast.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Filtros ──
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusqueda = !busqueda ||
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase())
      const matchRol = !filtroRol || u.rol === filtroRol
      const matchEmpresa = !filtroEmpresa || u.empresa_id === filtroEmpresa
      return matchBusqueda && matchRol && matchEmpresa
    })
  }, [usuarios, busqueda, filtroRol, filtroEmpresa])

  // ── Handlers ──
  function handleUpdated(id: string, changes: Partial<UsuarioRow>) {
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ...changes } : u))
  }

  function handleDeleted(id: string) {
    setUsuarios(prev => prev.filter(u => u.id !== id))
  }

  const selectCls = 'h-9 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white/70 appearance-none outline-none focus:border-amber-500/60 transition-colors cursor-pointer'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-white">Usuarios</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {loading ? '—' : `${usuarios.length} usuarios · ${usuariosFiltrados.length} visibles`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400/60" />
          <span className="text-xs text-amber-400/60">Todos los usuarios del sistema</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
              text-white/85 placeholder:text-white/20 outline-none
              focus:border-amber-500/60 focus:bg-white/[0.06] transition-colors duration-150"
          />
        </div>
        <select
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value as '' | UserRole)}
          className={selectCls}
        >
          <option value="" className="bg-[#111110]">Todos los roles</option>
          <option value="empleado" className="bg-[#111110]">Empleado</option>
          <option value="admin" className="bg-[#111110]">Admin</option>
          <option value="dev" className="bg-[#111110]">Dev</option>
        </select>
        {empresas.length > 0 && (
          <select
            value={filtroEmpresa}
            onChange={e => setFiltroEmpresa(e.target.value)}
            className={selectCls}
          >
            <option value="" className="bg-[#111110]">Todas las empresas</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id} className="bg-[#111110]">{e.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.04] rounded-xl" />
          ))}
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-8 h-8 text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/40">
            {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin usuarios'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {usuariosFiltrados.map(u => (
              <UsuarioFila
                key={u.id}
                usuario={u}
                empresas={empresas}
                currentDevId={currentDevId}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}

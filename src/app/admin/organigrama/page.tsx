'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, RefreshCw, Save, X, AlertTriangle, Building2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { construirArbol, generarNodosDesdeUsuarios } from '@/lib/organigrama'
import OrgChart from '@/components/shared/OrgChart'
import { Portal } from '@/components/shared/Portal'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'
import type { OrgNodo } from '@/types'

// ── Tipos locales ──────────────────────────────────────────────────────────

interface UsuarioBase {
  id: string
  nombre: string
  puesto?: string | null
  area?: string | null
  foto_url?: string | null
  manager_id?: string | null
}

type ModoModal = 'agregar' | 'editar' | 'eliminar' | 'regenerar' | null

// ── Helpers UI ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 ' +
  'text-white outline-none focus:border-indigo-500/40 transition-colors placeholder:text-white/25'

const btnPrimario =
  'flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg ' +
  'bg-indigo-600 hover:bg-indigo-500 text-white transition-colors'

const btnSecundario = 'text-sm text-white/40 hover:text-white/70 px-4 py-2 transition-colors'

function Spinner() {
  return <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />
}

function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ModalBase({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/70 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div
          className="glass-card rounded-xl w-full max-w-md overflow-y-auto"
          style={{ maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-medium text-white/90">{titulo}</h3>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </motion.div>
    </>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function OrganigramaAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNombre, setEmpresaNombre] = useState('')

  // Nodos (lista plana) y árbol renderizable
  const [nodos, setNodos] = useState<OrgNodo[]>([])
  const [arbol, setArbol] = useState<OrgNodo[]>([])
  const [modoFuente, setModoFuente] = useState<'personalizado' | 'automatico'>('automatico')
  const [usuariosTodos, setUsuariosTodos] = useState<UsuarioBase[]>([])

  // UI
  const [guardando, setGuardando] = useState(false)
  const [modoModal, setModoModal] = useState<ModoModal>(null)
  const [nodoSeleccionado, setNodoSeleccionado] = useState<OrgNodo | null>(null)

  // Form: agregar
  const [tipoPersona, setTipoPersona] = useState<'existente' | 'externo'>('existente')
  const [usuarioIdSel, setUsuarioIdSel] = useState('')
  const [nombreExt, setNombreExt] = useState('')
  const [puestoExt, setPuestoExt] = useState('')
  const [areaExt, setAreaExt] = useState('')
  const [parentIdSel, setParentIdSel] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  // Form: editar
  const [editNombre, setEditNombre] = useState('')
  const [editPuesto, setEditPuesto] = useState('')
  const [editArea, setEditArea] = useState('')

  // ── Carga ──
  const cargarNodos = useCallback(async (empId: string) => {
    const supabase = createClient()

    const [nodosRes, usuariosRes] = await Promise.all([
      supabase
        .from('organigrama_nodos')
        .select('*')
        .eq('empresa_id', empId)
        .order('orden', { ascending: true }),
      supabase
        .from('usuarios')
        .select('id, nombre, puesto, area, foto_url, manager_id')
        .eq('empresa_id', empId),
    ])

    const usuarios = (usuariosRes.data ?? []) as UsuarioBase[]
    setUsuariosTodos(usuarios)

    if (nodosRes.data && nodosRes.data.length > 0) {
      const lista = nodosRes.data as OrgNodo[]
      setNodos(lista)
      setArbol(construirArbol(lista))
      setModoFuente('personalizado')
    } else {
      const generados = generarNodosDesdeUsuarios(usuarios, empId)
      setNodos(generados)
      setArbol(construirArbol(generados))
      setModoFuente('automatico')
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('usuarios')
          .select('empresa_id, empresas(nombre)')
          .eq('id', user.id)
          .single()

        if (!adminData?.empresa_id) return

        const empId = adminData.empresa_id
        setEmpresaId(empId)

        // Supabase puede retornar el join como objeto o array según la configuración
        const emp = adminData.empresas
        const nombre = Array.isArray(emp) ? emp[0]?.nombre : (emp as { nombre?: string } | null)?.nombre
        setEmpresaNombre(nombre ?? '')

        await cargarNodos(empId)
      } catch (err) {
        console.error('Error cargando organigrama:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar el organigrama')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [cargarNodos])

  // Reconstruir árbol al cambiar nodos
  useEffect(() => {
    setArbol(construirArbol(nodos))
  }, [nodos])

  // ── Guardar (modo automático → persistir al DB) ──
  const guardar = async () => {
    if (!empresaId || modoFuente !== 'automatico') return
    setGuardando(true)
    try {
      const supabase = createClient()
      await supabase.from('organigrama_nodos').insert(
        nodos.map((n) => ({
          id: n.id,
          empresa_id: n.empresa_id,
          usuario_id: n.usuario_id,
          nombre: n.nombre,
          puesto: n.puesto,
          area: n.area,
          foto_url: n.foto_url,
          parent_id: n.parent_id,
          orden: n.orden,
          visible: n.visible,
        }))
      )
      setModoFuente('personalizado')
    } catch (err) {
      console.error('Error guardando organigrama:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Regenerar ──
  const regenerar = async () => {
    if (!empresaId) return
    setGuardando(true)
    setModoModal(null)
    try {
      const supabase = createClient()
      await supabase.from('organigrama_nodos').delete().eq('empresa_id', empresaId)
      await cargarNodos(empresaId)
    } catch (err) {
      console.error('Error regenerando organigrama:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Agregar nodo ──
  const agregarNodo = async () => {
    if (!empresaId) return
    setGuardando(true)
    try {
      const supabase = createClient()

      let payload: Record<string, unknown>

      if (tipoPersona === 'existente') {
        const u = usuariosTodos.find((u) => u.id === usuarioIdSel)
        if (!u) return
        payload = {
          empresa_id: empresaId,
          usuario_id: u.id,
          nombre: u.nombre,
          puesto: u.puesto ?? null,
          area: u.area ?? null,
          foto_url: u.foto_url ?? null,
          parent_id: parentIdSel || null,
          orden: nodos.length,
          visible: true,
        }
      } else {
        if (!nombreExt.trim()) return
        payload = {
          empresa_id: empresaId,
          usuario_id: null,
          nombre: nombreExt.trim(),
          puesto: puestoExt.trim() || null,
          area: areaExt.trim() || null,
          foto_url: null,
          parent_id: parentIdSel || null,
          orden: nodos.length,
          visible: true,
        }
      }

      const { data, error } = await supabase
        .from('organigrama_nodos')
        .insert(payload)
        .select()
        .single()

      if (error) throw new Error(error.message)

      let nodoCreado = data as OrgNodo

      // Upload foto opcional
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop()
        const path = `org/${empresaId}/${nodoCreado.id}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, fotoFile, { upsert: true })

        if (!upErr) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('avatars').getPublicUrl(path)
          await supabase
            .from('organigrama_nodos')
            .update({ foto_url: publicUrl })
            .eq('id', nodoCreado.id)
          nodoCreado = { ...nodoCreado, foto_url: publicUrl }
        }
      }

      setNodos((prev) => [...prev, nodoCreado])
      setModoFuente('personalizado')
      cerrarModal()
    } catch (err) {
      console.error('Error agregando nodo:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Editar nodo ──
  const guardarEdicion = async () => {
    if (!nodoSeleccionado) return
    setGuardando(true)
    try {
      const supabase = createClient()
      const updates = {
        nombre: editNombre.trim(),
        puesto: editPuesto.trim() || null,
        area: editArea.trim() || null,
      }
      await supabase
        .from('organigrama_nodos')
        .update(updates)
        .eq('id', nodoSeleccionado.id)

      if (nodoSeleccionado.usuario_id) {
        await supabase
          .from('usuarios')
          .update({ puesto: updates.puesto, area: updates.area })
          .eq('id', nodoSeleccionado.usuario_id)
      }

      setNodos((prev) =>
        prev.map((n) => (n.id === nodoSeleccionado.id ? { ...n, ...updates } : n))
      )
      cerrarModal()
    } catch (err) {
      console.error('Error editando nodo:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar nodo ──
  const eliminarNodo = async () => {
    if (!nodoSeleccionado) return
    setGuardando(true)
    try {
      const supabase = createClient()
      const nuevoParent = nodoSeleccionado.parent_id ?? null

      // Reasignar hijos al abuelo
      await supabase
        .from('organigrama_nodos')
        .update({ parent_id: nuevoParent })
        .eq('parent_id', nodoSeleccionado.id)

      await supabase
        .from('organigrama_nodos')
        .delete()
        .eq('id', nodoSeleccionado.id)

      setNodos((prev) => {
        const filtrado = prev.filter((n) => n.id !== nodoSeleccionado.id)
        return filtrado.map((n) =>
          n.parent_id === nodoSeleccionado.id ? { ...n, parent_id: nuevoParent } : n
        )
      })
      cerrarModal()
    } catch (err) {
      console.error('Error eliminando nodo:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Upload foto desde OrgChart ──
  const handleUploadFoto = async (nodo: OrgNodo, file: File) => {
    if (!empresaId) return
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `org/${empresaId}/${nodo.id}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (upErr) throw new Error(upErr.message)

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      await supabase
        .from('organigrama_nodos')
        .update({ foto_url: publicUrl })
        .eq('id', nodo.id)

      if (nodo.usuario_id) {
        await supabase
          .from('usuarios')
          .update({ foto_url: publicUrl })
          .eq('id', nodo.usuario_id)
      }

      setNodos((prev) =>
        prev.map((n) => (n.id === nodo.id ? { ...n, foto_url: publicUrl } : n))
      )
    } catch (err) {
      console.warn('[Organigrama] upload foto:', err)
    }
  }

  // ── Helpers modales ──
  const abrirEditar = (nodo: OrgNodo) => {
    setNodoSeleccionado(nodo)
    setEditNombre(nodo.nombre)
    setEditPuesto(nodo.puesto ?? '')
    setEditArea(nodo.area ?? '')
    setModoModal('editar')
  }

  const abrirEliminar = (nodo: OrgNodo) => {
    setNodoSeleccionado(nodo)
    setModoModal('eliminar')
  }

  const cerrarModal = () => {
    setModoModal(null)
    setNodoSeleccionado(null)
    setTipoPersona('existente')
    setUsuarioIdSel('')
    setNombreExt('')
    setPuestoExt('')
    setAreaExt('')
    setParentIdSel('')
    setFotoFile(null)
  }

  // Usuarios que aún no están en el organigrama
  const usuariosEnOrg = new Set(nodos.map((n) => n.usuario_id).filter(Boolean))
  const usuariosLibres = usuariosTodos.filter((u) => !usuariosEnOrg.has(u.id))

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="shimmer rounded-xl h-14" />
        <div className="shimmer rounded-xl h-[400px]" />
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <ErrorState mensaje={error} onRetry={() => { setError(null); if (empresaId) cargarNodos(empresaId) }} />
      </div>
    )
  }

  // ── Render ──
  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/admin/conocimiento"
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Conocimiento
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-white/90 truncate">
              Organigrama{empresaNombre ? ` de ${empresaNombre}` : ''}
            </h1>
            {modoFuente === 'automatico' && (
              <p className="text-[11px] text-amber-400/70 mt-0.5">
                Vista previa generada automáticamente — guardá para personalizar
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setModoModal('agregar')}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg
                bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08]
                text-white/70 hover:text-white/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Agregar persona</span>
            </button>

            <button
              onClick={() => setModoModal('regenerar')}
              title="Regenerar desde empleados"
              className="flex items-center gap-1.5 text-sm font-medium p-2 rounded-lg
                bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08]
                text-white/70 hover:text-white/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={guardar}
              disabled={guardando || modoFuente === 'personalizado'}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150',
                modoFuente === 'automatico'
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-white/[0.04] text-white/25 border border-white/[0.06] cursor-default',
                'disabled:opacity-60'
              )}
            >
              {guardando ? <Spinner /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </div>

        {/* Contenido */}
        {nodos.length === 0 ? (
          /* Empty state */
          <div className="glass-card rounded-xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white/25" />
            </div>
            <div>
              <p className="text-sm text-white/60 font-medium">
                Tu organigrama se generará automáticamente desde tus empleados
              </p>
              <p className="text-[12px] text-white/30 mt-1">
                Primero agregá empleados desde el panel de Empleados, o creá personas manualmente.
              </p>
            </div>
            <button
              onClick={() => setModoModal('agregar')}
              className={btnPrimario}
            >
              <Plus className="w-4 h-4" /> Agregar persona manualmente
            </button>
          </div>
        ) : (
          /* OrgChart */
          <div className="glass-card rounded-xl p-4 overflow-x-auto">
            <OrgChart
              raices={arbol}
              modo="edicion"
              onEditNodo={abrirEditar}
              onDeleteNodo={abrirEliminar}
              onUploadFoto={handleUploadFoto}
            />
          </div>
        )}
      </div>

      {/* ══ Modales ══════════════════════════════════════════════════════════ */}
      <Portal>
        <AnimatePresence>
          {/* ── Agregar persona ── */}
          {modoModal === 'agregar' && (
            <ModalBase titulo="Agregar persona" onClose={cerrarModal}>
              {/* Toggle tipo */}
              <div className="flex gap-2 mb-4">
                {(['existente', 'externo'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipoPersona(t)}
                    className={cn(
                      'flex-1 text-sm py-2 rounded-lg border transition-colors',
                      tipoPersona === t
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70'
                    )}
                  >
                    {t === 'existente' ? 'Empleado existente' : 'Persona externa'}
                  </button>
                ))}
              </div>

              {tipoPersona === 'existente' ? (
                <Campo label="Empleado">
                  <select
                    value={usuarioIdSel}
                    onChange={(e) => setUsuarioIdSel(e.target.value)}
                    className={inputCls}
                  >
                    <option value="" className="bg-[#111]">
                      Seleccioná un empleado...
                    </option>
                    {usuariosLibres.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#111]">
                        {u.nombre}
                        {u.puesto ? ` — ${u.puesto}` : ''}
                      </option>
                    ))}
                  </select>
                  {usuariosLibres.length === 0 && (
                    <p className="text-[11px] text-white/30 mt-1">
                      Todos los empleados ya están en el organigrama.
                    </p>
                  )}
                </Campo>
              ) : (
                <div className="space-y-3">
                  <Campo label="Nombre completo">
                    <input
                      value={nombreExt}
                      onChange={(e) => setNombreExt(e.target.value)}
                      className={inputCls}
                      placeholder="Ej: María García"
                    />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Puesto">
                      <input
                        value={puestoExt}
                        onChange={(e) => setPuestoExt(e.target.value)}
                        className={inputCls}
                        placeholder="Ej: CEO"
                      />
                    </Campo>
                    <Campo label="Área">
                      <input
                        value={areaExt}
                        onChange={(e) => setAreaExt(e.target.value)}
                        className={inputCls}
                        placeholder="Ej: Dirección"
                      />
                    </Campo>
                  </div>
                </div>
              )}

              <Campo label="Reporta a" className="mt-3">
                <select
                  value={parentIdSel}
                  onChange={(e) => setParentIdSel(e.target.value)}
                  className={inputCls}
                >
                  <option value="" className="bg-[#111]">
                    Nadie — nodo raíz
                  </option>
                  {nodos.map((n) => (
                    <option key={n.id} value={n.id} className="bg-[#111]">
                      {n.nombre}
                      {n.puesto ? ` (${n.puesto})` : ''}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Foto (opcional)" className="mt-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-white/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-md
                    file:border-0 file:text-xs file:font-medium file:bg-white/[0.06] file:text-white/60
                    hover:file:bg-white/10 file:cursor-pointer"
                />
                {fotoFile && (
                  <p className="text-[11px] text-teal-400/80 mt-1">{fotoFile.name}</p>
                )}
              </Campo>

              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                <button onClick={cerrarModal} className={btnSecundario}>
                  Cancelar
                </button>
                <button
                  onClick={agregarNodo}
                  disabled={
                    guardando ||
                    (tipoPersona === 'existente' && !usuarioIdSel) ||
                    (tipoPersona === 'externo' && !nombreExt.trim())
                  }
                  className={cn(btnPrimario, 'disabled:opacity-50 disabled:cursor-not-allowed')}
                >
                  {guardando && <Spinner />}
                  Agregar
                </button>
              </div>
            </ModalBase>
          )}

          {/* ── Editar nodo ── */}
          {modoModal === 'editar' && nodoSeleccionado && (
            <ModalBase titulo="Editar persona" onClose={cerrarModal}>
              <div className="space-y-3">
                <Campo label="Nombre">
                  <input
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className={inputCls}
                  />
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Puesto">
                    <input
                      value={editPuesto}
                      onChange={(e) => setEditPuesto(e.target.value)}
                      className={inputCls}
                      placeholder="Ej: CTO"
                    />
                  </Campo>
                  <Campo label="Área">
                    <input
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      className={inputCls}
                      placeholder="Ej: Tecnología"
                    />
                  </Campo>
                </div>
                {nodoSeleccionado.usuario_id && (
                  <p className="text-[11px] text-white/30">
                    Los cambios de puesto y área se sincronizarán al perfil del empleado.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                <button onClick={cerrarModal} className={btnSecundario}>
                  Cancelar
                </button>
                <button
                  onClick={guardarEdicion}
                  disabled={guardando || !editNombre.trim()}
                  className={cn(btnPrimario, 'disabled:opacity-50')}
                >
                  {guardando && <Spinner />}
                  Guardar cambios
                </button>
              </div>
            </ModalBase>
          )}

          {/* ── Eliminar nodo ── */}
          {modoModal === 'eliminar' && nodoSeleccionado && (
            <ModalBase titulo="Eliminar persona" onClose={cerrarModal}>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-rose-500/[0.06] border border-rose-500/20">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white/80">
                    ¿Eliminar a{' '}
                    <span className="font-medium text-white">{nodoSeleccionado.nombre}</span>?
                  </p>
                  <p className="text-[12px] text-white/40 mt-1">
                    Sus reportes directos pasarán al nivel superior.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                <button onClick={cerrarModal} className={btnSecundario}>
                  Cancelar
                </button>
                <button
                  onClick={eliminarNodo}
                  disabled={guardando}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg
                    bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
                >
                  {guardando && <Spinner />}
                  Eliminar
                </button>
              </div>
            </ModalBase>
          )}

          {/* ── Regenerar ── */}
          {modoModal === 'regenerar' && (
            <ModalBase titulo="Regenerar organigrama" onClose={cerrarModal}>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white/80">
                    Se eliminará la estructura actual y se regenerará automáticamente desde los
                    empleados.
                  </p>
                  <p className="text-[12px] text-white/40 mt-1">
                    Las jerarquías se tomarán del campo Manager de cada empleado.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                <button onClick={cerrarModal} className={btnSecundario}>
                  Cancelar
                </button>
                <button
                  onClick={regenerar}
                  disabled={guardando}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg
                    bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
                >
                  {guardando && <Spinner />}
                  Regenerar
                </button>
              </div>
            </ModalBase>
          )}
        </AnimatePresence>
      </Portal>
    </>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import type { OrgNode } from '@/types'

// ─────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────

interface UsuarioBasico {
  id: string
  nombre: string
  puesto?: string
  area?: string
  manager_id?: string | null
}

interface Relacion {
  relacion: string
  miembro_id: string
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface OrganigramaProps {
  usuarioId: string
  empresaId: string
  descripcion?: string
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ─────────────────────────────────────────────
// NodeCard — una sola tarjeta del árbol
// ─────────────────────────────────────────────

function NodeCard({
  node,
  isSelf,
  label,
}: {
  node: OrgNode
  isSelf: boolean
  label?: string
}) {
  const bgClass = isSelf
    ? 'bg-sky-500/10 border-sky-500/30'
    : 'bg-white/[0.04] border-white/[0.10]'

  const textClass = isSelf ? 'text-sky-300' : 'text-white/70'
  const initialsClass = isSelf
    ? 'bg-sky-500/20 border-sky-500/30 text-sky-300'
    : 'bg-white/[0.08] border-white/[0.12] text-white/50'

  return (
    <div className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border min-w-[100px] max-w-[140px] ${bgClass}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${initialsClass}`}>
        <span className="text-[11px] font-semibold">{getInitials(node.nombre)}</span>
      </div>
      {/* Nombre */}
      <p className={`text-[11px] font-semibold text-center leading-tight truncate w-full text-center ${textClass}`}>
        {node.nombre}
      </p>
      {/* Puesto */}
      {node.puesto && (
        <p className="text-[10px] text-white/30 text-center leading-tight truncate w-full">
          {node.puesto}
        </p>
      )}
      {/* Etiqueta relación */}
      {label && (
        <span className={`text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full mt-0.5 ${
          isSelf
            ? 'bg-sky-500/15 text-sky-400/80'
            : node.relacion === 'buddy'
            ? 'bg-amber-500/15 text-amber-400/70'
            : 'bg-white/[0.06] text-white/25'
        }`}>
          {label}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// OrgTree — árbol visual vertical
// ─────────────────────────────────────────────

function OrgTree({ tree, t }: { tree: OrgNode[]; t: (k: string) => string }) {
  const [peersExpanded, setPeersExpanded] = useState(true)

  // tree tiene 1-2 nodos raíz (director → manager, o solo manager si no hay director)
  function renderNode(node: OrgNode, depth: number): React.ReactNode {
    const isSelf = node.relacion === 'self'
    const labelKey = isSelf
      ? undefined
      : node.relacion === 'director'
      ? t('rol.organigrama.director')
      : node.relacion === 'manager'
      ? t('rol.organigrama.manager')
      : node.relacion === 'buddy'
      ? t('rol.organigrama.buddy')
      : t('rol.organigrama.peer')

    const hasChildren = node.children.length > 0

    return (
      <motion.div
        key={node.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: depth * 0.08, type: 'spring', stiffness: 300, damping: 28 }}
        className="flex flex-col items-center"
      >
        <NodeCard node={node} isSelf={isSelf} label={labelKey} />

        {hasChildren && (
          <>
            {/* Línea vertical hacia abajo */}
            <div className="w-px h-5 bg-white/[0.10]" />

            {/* Nivel de hijos */}
            {node.children.length === 1 ? (
              renderNode(node.children[0], depth + 1)
            ) : (
              <div className="flex flex-col items-center w-full">
                {/* Botón toggle peers en mobile */}
                {isSelf === false && node.children.some(c => c.relacion !== 'self') && (
                  <button
                    onClick={() => setPeersExpanded(p => !p)}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 mb-1 transition-colors"
                  >
                    {peersExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {node.children.length} {t('rol.organigrama.peer').toLowerCase()}s
                  </button>
                )}

                <AnimatePresence>
                  {peersExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-3 flex-wrap justify-center"
                    >
                      {node.children.map(child => renderNode(child, depth + 1))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </motion.div>
    )
  }

  if (tree.length === 0) return null

  return (
    <div className="flex flex-col items-center gap-0">
      {tree.map((node, i) => (
        <div key={node.id} className="flex flex-col items-center">
          {renderNode(node, i)}
          {i < tree.length - 1 && <div className="w-px h-5 bg-white/[0.10]" />}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Organigrama — componente principal
// ─────────────────────────────────────────────

export default function Organigrama({ usuarioId }: OrganigramaProps) {
  const { t } = useLanguage()
  const [tree, setTree] = useState<OrgNode[]>([])
  const [loading, setLoading] = useState(true)
  const [buddy, setBuddy] = useState<OrgNode | null>(null)

  const cargar = useCallback(async () => {
    try {
      const supabase = createClient()

      // 1. Datos del empleado actual
      const { data: self } = await supabase
        .from('usuarios')
        .select('id, nombre, puesto, area, manager_id')
        .eq('id', usuarioId)
        .single()

      if (!self) return

      const selfNode: OrgNode = {
        id: self.id,
        nombre: self.nombre,
        puesto: self.puesto,
        area: self.area,
        relacion: 'self',
        children: [],
      }

      // 2. Relaciones del empleado (manager, buddy, compañeros)
      const { data: relaciones } = await supabase
        .from('equipo_relaciones')
        .select('relacion, miembro_id')
        .eq('usuario_id', usuarioId)

      const rels: Relacion[] = relaciones ?? []
      const managerId = rels.find(r => r.relacion === 'manager')?.miembro_id ?? self.manager_id
      const buddyId = rels.find(r => r.relacion === 'buddy')?.miembro_id
      const peerIds = rels.filter(r => r.relacion === 'companero').map(r => r.miembro_id)

      // IDs a consultar
      const idsToFetch = [
        managerId,
        buddyId,
        ...peerIds,
      ].filter((id): id is string => Boolean(id) && id !== usuarioId)

      const usersMap: Record<string, UsuarioBasico> = {}

      if (idsToFetch.length > 0) {
        const { data: usuarios } = await supabase
          .from('usuarios')
          .select('id, nombre, puesto, area, manager_id')
          .in('id', idsToFetch)

        for (const u of usuarios ?? []) usersMap[u.id] = u
      }

      // 3. Construir peers + self como siblings bajo el manager
      const siblings: OrgNode[] = []

      // Peers
      for (const peerId of peerIds) {
        const peer = usersMap[peerId]
        if (!peer) continue
        siblings.push({
          id: peer.id,
          nombre: peer.nombre,
          puesto: peer.puesto,
          area: peer.area,
          relacion: 'companero',
          children: [],
        })
      }

      // Self al inicio de los siblings
      siblings.unshift(selfNode)

      // 4. Buddy — guardado aparte para mostrarlo diferenciado
      if (buddyId && usersMap[buddyId]) {
        const b = usersMap[buddyId]
        setBuddy({
          id: b.id,
          nombre: b.nombre,
          puesto: b.puesto,
          area: b.area,
          relacion: 'buddy',
          children: [],
        })
      }

      // 5. Nodo manager
      let rootNodes: OrgNode[] = []

      if (managerId && usersMap[managerId]) {
        const mgr = usersMap[managerId]
        const managerNode: OrgNode = {
          id: mgr.id,
          nombre: mgr.nombre,
          puesto: mgr.puesto,
          area: mgr.area,
          relacion: 'manager',
          children: siblings,
        }

        // 6. Director (manager del manager)
        const directorId = mgr.manager_id
        if (directorId && directorId !== usuarioId && directorId !== managerId) {
          const { data: directorData } = await supabase
            .from('usuarios')
            .select('id, nombre, puesto, area')
            .eq('id', directorId)
            .single()

          if (directorData) {
            rootNodes = [{
              id: directorData.id,
              nombre: directorData.nombre,
              puesto: directorData.puesto,
              area: directorData.area,
              relacion: 'director',
              children: [managerNode],
            }]
          } else {
            rootNodes = [managerNode]
          }
        } else {
          rootNodes = [managerNode]
        }
      } else {
        // Sin manager: solo el empleado
        rootNodes = [selfNode]
      }

      setTree(rootNodes)
    } catch (err) {
      console.warn('[Organigrama] Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [usuarioId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    )
  }

  if (tree.length === 0 || (tree.length === 1 && tree[0].relacion === 'self' && tree[0].children.length === 0)) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <Users className="w-5 h-5 text-white/25" />
        </div>
        <p className="text-sm text-white/35">{t('rol.organigrama.empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Árbol principal */}
      <div className="flex justify-center overflow-x-auto pb-2">
        <OrgTree tree={tree} t={t} />
      </div>

      {/* Buddy — card separada con borde especial */}
      {buddy && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-300 text-[11px] font-semibold">{getInitials(buddy.nombre)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/70 truncate">{buddy.nombre}</p>
            {buddy.puesto && (
              <p className="text-[10px] text-white/35 truncate">{buddy.puesto}</p>
            )}
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400/70 flex-shrink-0">
            {t('rol.organigrama.buddy')}
          </span>
        </div>
      )}
    </div>
  )
}

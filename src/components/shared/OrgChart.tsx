'use client'

import { motion } from 'framer-motion'
import { Edit3, Trash2, Camera } from 'lucide-react'
import { useRef } from 'react'
import type { OrgNodo } from '@/types'
import { colorPorArea, getInitials } from '@/lib/organigrama'

// ── Props ──────────────────────────────────────────────────────────────────

interface OrgChartProps {
  raices: OrgNodo[]
  usuarioActualId?: string
  modo: 'lectura' | 'edicion'
  onEditNodo?: (nodo: OrgNodo) => void
  onDeleteNodo?: (nodo: OrgNodo) => void
  onUploadFoto?: (nodo: OrgNodo, file: File) => void
}

// ── Animaciones ────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'tween', duration: 0.3 } },
} as const

// ── Tipos internos ─────────────────────────────────────────────────────────

interface CardProps {
  usuarioActualId?: string
  modo: 'lectura' | 'edicion'
  onEditNodo?: (nodo: OrgNodo) => void
  onDeleteNodo?: (nodo: OrgNodo) => void
  onUploadFoto?: (nodo: OrgNodo, file: File) => void
}

// ── Tarjeta de nodo ────────────────────────────────────────────────────────

function NodoCard({ nodo, usuarioActualId, modo, onEditNodo, onDeleteNodo, onUploadFoto }: CardProps & { nodo: OrgNodo }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const colores = colorPorArea(nodo.area)
  const esTuyo = !!usuarioActualId && usuarioActualId === nodo.usuario_id

  return (
    <motion.div
      variants={itemVariants}
      className="relative glass-card rounded-xl p-3 w-[140px] group select-none"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
    >
      {/* Badge "Vos" */}
      {esTuyo && (
        <span className="absolute -top-2 -right-2 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium z-10 shadow-lg pointer-events-none">
          Vos
        </span>
      )}

      {/* Avatar */}
      <div className="flex justify-center mb-2">
        <div
          className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          onClick={() => modo === 'edicion' && fileRef.current?.click()}
        >
          {nodo.foto_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={nodo.foto_url} alt={nodo.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className={colores.text}>{getInitials(nodo.nombre)}</span>
          )}

          {/* Hover overlay para subir foto */}
          {modo === 'edicion' && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
              <Camera size={12} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Input file oculto */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && onUploadFoto) onUploadFoto(nodo, f)
          e.target.value = ''
        }}
      />

      {/* Nombre */}
      <p className="text-[13px] font-medium text-white/90 text-center leading-tight truncate">
        {nodo.nombre}
      </p>

      {/* Puesto */}
      {nodo.puesto && (
        <p className="text-[11px] text-white/50 text-center mt-0.5 truncate">
          {nodo.puesto}
        </p>
      )}

      {/* Badge área */}
      {nodo.area && (
        <div className="flex justify-center mt-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${colores.bg} ${colores.text} ${colores.border}`}>
            {nodo.area}
          </span>
        </div>
      )}

      {/* Acciones edición — aparecen en hover */}
      {modo === 'edicion' && (
        <div className="flex justify-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEditNodo?.(nodo)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors"
            title="Editar nodo"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={() => onDeleteNodo?.(nodo)}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-white/50 hover:text-rose-400 transition-colors"
            title="Eliminar nodo"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ── Columna recursiva con conectores ──────────────────────────────────────

function OrgColumna({ nodo, depth, ...cardProps }: CardProps & { nodo: OrgNodo; depth: number }) {
  const hijos = nodo.children?.filter((n) => n.visible) ?? []
  const tieneHijos = hijos.length > 0

  return (
    <div className="flex flex-col items-center">
      <NodoCard nodo={nodo} {...cardProps} />

      {tieneHijos && (
        <>
          {/* Línea vertical hacia abajo desde el nodo padre */}
          <div className="w-px h-6 bg-white/20 flex-shrink-0" />

          {/* Fila de hijos — sin padding en el container para que los conectores se toquen */}
          <div className="flex flex-row">
            {hijos.map((hijo, i) => {
              const isFirst = i === 0
              const isLast = i === hijos.length - 1
              const isSingle = hijos.length === 1

              return (
                // Sin px en este div — el w-full del connector ocupa el ancho total
                // incluyendo el espaciado (que viene del px-3 interno)
                <div key={hijo.id} className="flex flex-col items-center">
                  {/* Conector: w-full = ancho total del container, sin padding aquí */}
                  <div className="relative w-full" style={{ height: 24 }}>
                    {/* Línea vertical (del conector horizontal al nodo) */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/20" />
                    {/* Línea horizontal (une los hermanos entre sí) */}
                    {!isSingle && (
                      <div
                        className="absolute top-0 h-px bg-white/20"
                        style={{
                          left: isFirst ? '50%' : 0,
                          right: isLast ? '50%' : 0,
                        }}
                      />
                    )}
                  </div>
                  {/* El padding va aquí, DEBAJO del conector, para dar espaciado visual entre cards */}
                  <div className="px-3">
                    <OrgColumna nodo={hijo} depth={depth + 1} {...cardProps} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Layout vertical para mobile ────────────────────────────────────────────

function OrgVertical({ nodos, depth = 0, ...cardProps }: CardProps & { nodos: OrgNodo[]; depth?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {nodos
        .filter((n) => n.visible)
        .map((nodo) => (
          <div key={nodo.id} style={{ paddingLeft: depth * 24 }}>
            <NodoCard nodo={nodo} {...cardProps} />
            {(nodo.children?.filter((n) => n.visible).length ?? 0) > 0 && (
              <div className="mt-3 pl-3 border-l border-white/20">
                <OrgVertical nodos={nodo.children!} depth={depth + 1} {...cardProps} />
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

export default function OrgChart({
  raices,
  usuarioActualId,
  modo,
  onEditNodo,
  onDeleteNodo,
  onUploadFoto,
}: OrgChartProps) {
  const cardProps: CardProps = { usuarioActualId, modo, onEditNodo, onDeleteNodo, onUploadFoto }
  const raicesVisibles = raices.filter((n) => n.visible)

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* Desktop: árbol horizontal con scroll */}
      <div className="hidden sm:block overflow-x-auto pb-4">
        <div className="flex flex-row justify-center gap-8 min-w-max py-4 px-8">
          {raicesVisibles.map((nodo) => (
            <OrgColumna key={nodo.id} nodo={nodo} depth={0} {...cardProps} />
          ))}
        </div>
      </div>

      {/* Mobile: lista vertical con indentación por nivel */}
      <div className="sm:hidden px-4 py-4">
        <OrgVertical nodos={raicesVisibles} {...cardProps} />
      </div>
    </motion.div>
  )
}

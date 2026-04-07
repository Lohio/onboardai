import type { OrgNodo } from '@/types'

/**
 * Construye árbol jerárquico desde lista plana de nodos.
 * Nodos raíz = parent_id null. Ordena hijos por campo orden.
 */
export function construirArbol(nodos: OrgNodo[]): OrgNodo[] {
  const mapa = new Map<string, OrgNodo>()
  const raices: OrgNodo[] = []

  for (const nodo of nodos) {
    mapa.set(nodo.id, { ...nodo, children: [] })
  }

  for (const nodo of nodos) {
    const n = mapa.get(nodo.id)!
    if (nodo.parent_id && mapa.has(nodo.parent_id)) {
      mapa.get(nodo.parent_id)!.children!.push(n)
    } else {
      raices.push(n)
    }
  }

  const ordenar = (arr: OrgNodo[]) => {
    arr.sort((a, b) => a.orden - b.orden)
    for (const n of arr) if (n.children?.length) ordenar(n.children)
  }
  ordenar(raices)
  return raices
}

/**
 * Genera OrgNodo[] desde la tabla usuarios (modo automático).
 * Se usa cuando la empresa no tiene nodos personalizados en organigrama_nodos.
 */
export function generarNodosDesdeUsuarios(
  usuarios: Array<{
    id: string; nombre: string; puesto?: string | null
    area?: string | null; foto_url?: string | null; manager_id?: string | null
  }>,
  empresaId: string
): OrgNodo[] {
  return usuarios.map((u, i) => ({
    id: u.id,
    empresa_id: empresaId,
    usuario_id: u.id,
    nombre: u.nombre,
    puesto: u.puesto ?? null,
    area: u.area ?? null,
    foto_url: u.foto_url ?? null,
    parent_id: u.manager_id ?? null,
    orden: i,
    visible: true,
    created_at: new Date().toISOString(),
  }))
}

/** Cuenta nodos visibles en un árbol */
export function contarNodos(raices: OrgNodo[]): number {
  let t = 0
  const c = (ns: OrgNodo[]) => { for (const n of ns) { if (n.visible) t++; if (n.children?.length) c(n.children) } }
  c(raices)
  return t
}

/** Color por área — hash simple a paleta fija */
const AREA_COLORS = [
  { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/25' },
  { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/25' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/25' },
  { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/25' },
  { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/25' },
  { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/25' },
]

export function colorPorArea(area?: string | null) {
  if (!area) return { bg: 'bg-white/[0.04]', text: 'text-white/40', border: 'border-white/[0.08]' }
  let hash = 0
  for (let i = 0; i < area.length; i++) hash = ((hash << 5) - hash + area.charCodeAt(i)) | 0
  return AREA_COLORS[Math.abs(hash) % AREA_COLORS.length]
}

/** Iniciales de un nombre (máx 2 chars) */
export function getInitials(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

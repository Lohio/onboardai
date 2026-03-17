// ─────────────────────────────────────────────
// conocimiento.ts — Utilidades para el módulo de conocimiento
// ─────────────────────────────────────────────

import type { TipoContenido, ContenidoBloque } from '@/types'

// ── Parsear URL de video (YouTube / Vimeo) ──────────────────

export interface VideoParseResult {
  embedUrl: string
  plataforma: 'youtube' | 'vimeo'
  urlOriginal: string
}

export function parseVideoUrl(input: string): VideoParseResult | null {
  // YouTube: youtube.com/watch?v=ID o youtu.be/ID
  const ytMatch = input.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  if (ytMatch) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      plataforma: 'youtube',
      urlOriginal: input,
    }
  }

  // Vimeo: vimeo.com/ID
  const vimeoMatch = input.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      plataforma: 'vimeo',
      urlOriginal: input,
    }
  }

  return null
}

// ── Extraer dominio de una URL ──────────────────────────────

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url.slice(0, 40)
  }
}

// ── Extraer nombre de archivo del storage_path ──────────────

export function getFilenameFromPath(path: string): string {
  return path.split('/').pop() ?? path
}

// ── Estado del bloque según tipo ────────────────────────────

type EstadoBloque = 'vacio' | 'parcial' | 'completo'

export function estadoBloque(bloque?: ContenidoBloque): EstadoBloque {
  if (!bloque) return 'vacio'
  if (bloque.tipo === 'texto') {
    if (!bloque.contenido || bloque.contenido.length < 100) return 'parcial'
    return 'completo'
  }
  // Para tipos no-texto: completo si tiene url o storage_path
  return bloque.url || bloque.storage_path ? 'completo' : 'parcial'
}

// ── Texto descriptivo del bloque para la lista ──────────────

export function infoBloque(bloque: ContenidoBloque): string {
  switch (bloque.tipo) {
    case 'texto':
      return `${bloque.contenido?.length ?? 0} chars`
    case 'imagen':
    case 'video':
    case 'pdf':
    case 'archivo':
      if (bloque.storage_path) return getFilenameFromPath(bloque.storage_path)
      if (bloque.url) return getDomainFromUrl(bloque.url)
      return ''
    case 'link':
      if (bloque.url) return getDomainFromUrl(bloque.url)
      return ''
    default:
      return ''
  }
}

// ── Formatos aceptados por tipo de archivo ──────────────────

export const ACCEPT_BY_TIPO: Record<string, string> = {
  imagen: 'image/jpeg,image/png,image/webp,image/gif',
  pdf: 'application/pdf',
  archivo: '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv',
}

export const MAX_SIZE_BY_TIPO: Record<string, number> = {
  imagen: 5 * 1024 * 1024,   // 5 MB
  pdf:    20 * 1024 * 1024,  // 20 MB
  archivo: 50 * 1024 * 1024, // 50 MB
}

// ── Icono según extensión de archivo ────────────────────────

export function getFileEmoji(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  if (['ppt', 'pptx'].includes(ext)) return '📊'
  if (ext === 'zip') return '🗜️'
  return '📁'
}

// ── Opciones de plataforma para links ───────────────────────

export const LINK_PLATAFORMAS = [
  { value: 'google_drive', label: 'Google Drive' },
  { value: 'notion',       label: 'Notion' },
  { value: 'confluence',   label: 'Confluence' },
  { value: 'github',       label: 'GitHub' },
  { value: 'figma',        label: 'Figma' },
  { value: 'otro',         label: 'Otro' },
] as const

export type LinkPlataforma = typeof LINK_PLATAFORMAS[number]['value']

// ── Formatear tamaño de archivo ─────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Obtener label del tipo ───────────────────────────────────

export const TIPO_LABELS: Record<TipoContenido, string> = {
  texto:   'Texto',
  imagen:  'Imagen',
  video:   'Video',
  pdf:     'PDF',
  link:    'Link',
  archivo: 'Archivo',
}

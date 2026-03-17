// Renderiza el preview de un bloque de conocimiento según su tipo

'use client'

import { FileDown, Link2, ExternalLink, Download } from 'lucide-react'
import { MiniMarkdownPreview } from '@/components/shared/MiniMarkdownPreview'
import {
  getDomainFromUrl,
  getFilenameFromPath,
  getFileEmoji,
  formatFileSize,
  TIPO_LABELS,
} from '@/lib/conocimiento'
import type { ContenidoBloque, MetadataLink, MetadataArchivo } from '@/types'

interface ContenidoPreviewProps {
  bloque: ContenidoBloque
}

export function ContenidoPreview({ bloque }: ContenidoPreviewProps) {
  switch (bloque.tipo) {

    // ── TEXTO ─────────────────────────────────────────────────
    case 'texto':
      return (
        <div className="prose-sm">
          <MiniMarkdownPreview text={bloque.contenido ?? ''} />
        </div>
      )

    // ── IMAGEN ────────────────────────────────────────────────
    case 'imagen':
      if (!bloque.url) return <EmptyPreview tipo="imagen" />
      return (
        <div className="rounded-lg overflow-hidden border border-white/[0.08]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bloque.url}
            alt={bloque.titulo}
            className="w-full object-cover max-h-64"
            loading="lazy"
          />
        </div>
      )

    // ── VIDEO ─────────────────────────────────────────────────
    case 'video':
      if (!bloque.url) return <EmptyPreview tipo="video" />
      return (
        <div className="relative w-full rounded-lg overflow-hidden border border-white/[0.08]"
          style={{ paddingTop: '56.25%' /* 16:9 */ }}>
          <iframe
            src={bloque.url}
            title={bloque.titulo}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      )

    // ── PDF ───────────────────────────────────────────────────
    case 'pdf': {
      if (!bloque.url) return <EmptyPreview tipo="pdf" />
      const pdfNombre = bloque.storage_path
        ? getFilenameFromPath(bloque.storage_path)
        : getDomainFromUrl(bloque.url)
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <FileDown className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/80 font-medium truncate">{pdfNombre}</p>
            <p className="text-xs text-white/35 mt-0.5">Documento PDF</p>
          </div>
          <a
            href={bloque.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300
              border border-indigo-500/25 hover:border-indigo-400/40
              px-2.5 py-1.5 rounded-md transition-colors duration-150 flex-shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            Ver
          </a>
        </div>
      )
    }

    // ── LINK ──────────────────────────────────────────────────
    case 'link': {
      if (!bloque.url) return <EmptyPreview tipo="link" />
      const meta = bloque.metadata as MetadataLink | null
      const dominio = getDomainFromUrl(bloque.url)
      return (
        <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <Link2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 font-medium truncate">{bloque.titulo}</p>
              {bloque.contenido && (
                <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{bloque.contenido}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-white/30 font-mono">{dominio}</span>
                {meta?.plataforma && meta.plataforma !== 'otro' && (
                  <span className="text-[10px] text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">
                    {meta.plataforma}
                  </span>
                )}
              </div>
            </div>
            <a
              href={bloque.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )
    }

    // ── ARCHIVO ───────────────────────────────────────────────
    case 'archivo': {
      if (!bloque.url && !bloque.storage_path) return <EmptyPreview tipo="archivo" />
      const meta = bloque.metadata as MetadataArchivo | null
      const nombre = meta?.nombre
        ?? (bloque.storage_path ? getFilenameFromPath(bloque.storage_path) : 'Archivo')
      const tamano = meta?.tamano ? formatFileSize(meta.tamano) : null
      const emoji  = getFileEmoji(nombre)
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            <span className="text-xl" role="img" aria-label="archivo">{emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/80 font-medium truncate">{nombre}</p>
            {tamano && <p className="text-xs text-white/35 mt-0.5">{tamano}</p>}
          </div>
          {bloque.url && (
            <a
              href={bloque.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70
                border border-white/[0.08] hover:border-white/[0.15]
                px-2.5 py-1.5 rounded-md transition-colors duration-150 flex-shrink-0"
            >
              <Download className="w-3 h-3" />
              Descargar
            </a>
          )}
        </div>
      )
    }

    default:
      return null
  }
}

// ── Empty state genérico ────────────────────────────────────

function EmptyPreview({ tipo }: { tipo: string }) {
  return (
    <div className="flex items-center justify-center h-20 rounded-lg bg-white/[0.02] border border-dashed border-white/[0.08]">
      <p className="text-xs text-white/25">
        Sin {TIPO_LABELS[tipo as keyof typeof TIPO_LABELS] ?? tipo} cargado
      </p>
    </div>
  )
}

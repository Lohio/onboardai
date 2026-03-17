# Sistema de Conocimiento Multi-tipo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the knowledge system to support 6 content types (text, image, video, PDF, link, file) with a redesigned modal that uses createPortal and a two-step flow (type selector → type-specific form).

**Architecture:** New `ContenidoModal` and `ContenidoPreview` components handle all content types. A new API route handles file uploads to Supabase Storage bucket `conocimiento`. The existing `conocimiento/page.tsx` is refactored to use these components, removing the inline modal. Shared utilities (`MiniMarkdownPreview`, `parseVideoUrl`) are extracted to reusable locations.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Framer Motion, Supabase Storage, Lucide React, `createPortal` from react-dom via existing `Portal` component.

---

## Task 1: DB migration + TypeScript types

**Files:**
- Modify: `scripts/roles.sql`
- Modify: `src/types/index.ts`

### Step 1: Add columns to roles.sql

Append at the end of `scripts/roles.sql`:

```sql
-- ══════════════════════════════════════════════════════════════
-- 15. CONOCIMIENTO MULTI-TIPO
--     tipo: texto (default) | imagen | video | pdf | link | archivo
--     url: URL pública del recurso
--     storage_path: path interno en Supabase Storage bucket 'conocimiento'
--     metadata: datos extra según tipo (jsonb)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE conocimiento
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'texto'
    CHECK (tipo IN ('texto','imagen','video','pdf','link','archivo')),
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;
```

### Step 2: Extend ContenidoBloque in src/types/index.ts

Replace the existing `ContenidoBloque` interface (lines 41-49):

```typescript
// Tipos de contenido soportados
export type TipoContenido = 'texto' | 'imagen' | 'video' | 'pdf' | 'link' | 'archivo'

// Metadata tipada por tipo de contenido
export interface MetadataVideo {
  plataforma: 'youtube' | 'vimeo'
  url_original: string
}
export interface MetadataLink {
  plataforma: string
}
export interface MetadataArchivo {
  nombre: string
  tamano: number
}

export interface ContenidoBloque {
  id: string
  empresa_id: string
  modulo: string
  bloque: string
  titulo: string
  contenido: string
  tipo: TipoContenido
  url?: string | null
  storage_path?: string | null
  metadata?: Record<string, string | number | boolean | null> | null
  created_at: string
}
```

### Step 3: Commit

```bash
git add scripts/roles.sql src/types/index.ts
git commit -m "feat: extend conocimiento table with tipo, url, storage_path, metadata"
```

---

## Task 2: Shared utilities — MiniMarkdownPreview + conocimiento helpers

**Files:**
- Create: `src/components/shared/MiniMarkdownPreview.tsx`
- Create: `src/lib/conocimiento.ts`

### Step 1: Extract MiniMarkdownPreview

Create `src/components/shared/MiniMarkdownPreview.tsx` — copy the `formatInline` and `MiniMarkdownPreview` functions verbatim from `src/app/admin/conocimiento/page.tsx` (lines 99-157), wrapping as an exported component:

```typescript
// Componente compartido de preview markdown sin librerías externas

import React from 'react'

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i} className="text-white/70">{part.slice(1, -1)}</em>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function MiniMarkdownPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-white/25 text-sm italic">El preview aparecerá aquí...</p>
  }

  const lines = text.split('\n')
  const elementos: React.ReactNode[] = []
  let listBuffer: React.ReactNode[] = []

  const flushList = (key: string) => {
    if (listBuffer.length > 0) {
      elementos.push(
        <ul key={key} className="list-disc ml-4 space-y-0.5 text-sm text-white/65">
          {listBuffer}
        </ul>
      )
      listBuffer = []
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      flushList(`list-${i}`)
      elementos.push(<h2 key={i} className="text-base font-bold text-white/90 mt-3 mb-1 first:mt-0">{formatInline(line.slice(2))}</h2>)
    } else if (line.startsWith('## ')) {
      flushList(`list-${i}`)
      elementos.push(<h3 key={i} className="text-sm font-semibold text-white/80 mt-3 mb-1 first:mt-0">{formatInline(line.slice(3))}</h3>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(<li key={i}>{formatInline(line.slice(2))}</li>)
    } else if (line.trim() === '') {
      flushList(`list-${i}`)
      elementos.push(<br key={i} />)
    } else {
      flushList(`list-${i}`)
      elementos.push(<p key={i} className="text-sm text-white/65 leading-relaxed">{formatInline(line)}</p>)
    }
  })

  flushList('final')
  return <div className="space-y-1">{elementos}</div>
}
```

### Step 2: Create src/lib/conocimiento.ts

```typescript
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
```

### Step 3: Commit

```bash
git add src/components/shared/MiniMarkdownPreview.tsx src/lib/conocimiento.ts
git commit -m "feat: add MiniMarkdownPreview component and conocimiento utils"
```

---

## Task 3: Upload API route

**Files:**
- Create: `src/app/api/admin/conocimiento/upload/route.ts`

### Step 1: Create the route

```typescript
// POST /api/admin/conocimiento/upload
// Recibe FormData: file (File), empresaId, modulo, tipo
// Sube al bucket 'conocimiento' de Supabase Storage
// Devuelve: { path, publicUrl }
// Requiere SUPABASE_SERVICE_ROLE_KEY

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    // 1. Verificar sesión del admin
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: admin } = await supabase
      .from('usuarios')
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (!admin || !['admin', 'dev'].includes(admin.rol as string)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // 2. Leer FormData
    const formData = await request.formData()
    const file      = formData.get('file') as File | null
    const empresaId = formData.get('empresaId') as string | null
    const modulo    = formData.get('modulo') as string | null

    if (!file || !empresaId || !modulo) {
      return NextResponse.json({ error: 'Faltan parámetros: file, empresaId, modulo' }, { status: 400 })
    }

    // Validar que el empresaId del admin coincide (evitar subir a empresa ajena)
    if (admin.empresa_id !== empresaId) {
      return NextResponse.json({ error: 'Empresa no autorizada' }, { status: 403 })
    }

    // 3. Generar path único: {empresaId}/{modulo}/{uuid}.{ext}
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const uuid = crypto.randomUUID()
    const path = `${empresaId}/${modulo}/${uuid}.${ext}`

    // 4. Subir con service role key (bypass RLS de Storage)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await serviceSupabase
      .storage
      .from('conocimiento')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload/conocimiento] Error subiendo archivo:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 5. Obtener URL pública
    const { data: { publicUrl } } = serviceSupabase
      .storage
      .from('conocimiento')
      .getPublicUrl(path)

    return NextResponse.json({ path, publicUrl })

  } catch (err) {
    console.error('[upload/conocimiento] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

### Step 2: Commit

```bash
git add src/app/api/admin/conocimiento/upload/route.ts
git commit -m "feat: add upload API route for conocimiento storage"
```

---

## Task 4: ContenidoPreview component

**Files:**
- Create: `src/components/admin/ContenidoPreview.tsx`

### Step 1: Create ContenidoPreview

```typescript
// Renderiza el preview de un bloque de conocimiento según su tipo

'use client'

import { FileDown, Link2, FolderOpen, ExternalLink, Download } from 'lucide-react'
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
```

### Step 2: Commit

```bash
git add src/components/admin/ContenidoPreview.tsx
git commit -m "feat: add ContenidoPreview component for all content types"
```

---

## Task 5: ContenidoModal — shell, Paso A (tipo selector) y Paso B (formularios)

**Files:**
- Create: `src/components/admin/ContenidoModal.tsx`

### Step 1: Create the full ContenidoModal component

This is the largest file. Create `src/components/admin/ContenidoModal.tsx` with the full implementation:

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ArrowLeft, FileText, Image, Play, FileDown, Link2,
  FolderOpen, Plus, Check, Upload, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { MiniMarkdownPreview } from '@/components/shared/MiniMarkdownPreview'
import { Portal } from '@/components/shared/Portal'
import { cn } from '@/lib/utils'
import {
  parseVideoUrl,
  ACCEPT_BY_TIPO,
  MAX_SIZE_BY_TIPO,
  LINK_PLATAFORMAS,
  formatFileSize,
  getFileEmoji,
  TIPO_LABELS,
  type LinkPlataforma,
} from '@/lib/conocimiento'
import type { ContenidoBloque, TipoContenido, MetadataVideo, MetadataLink, MetadataArchivo } from '@/types'

// ─────────────────────────────────────────────
// Props del modal
// ─────────────────────────────────────────────

interface ContenidoModalProps {
  modulo: string
  bloque: string
  label: string
  empresaId: string
  existing?: ContenidoBloque | null
  onClose: () => void
  onGuardado: (bloque: ContenidoBloque) => void
}

// ─────────────────────────────────────────────
// Opciones de tipo
// ─────────────────────────────────────────────

const TIPO_OPCIONES: { tipo: TipoContenido; descripcion: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { tipo: 'texto',   descripcion: 'Contenido escrito en Markdown', Icon: FileText },
  { tipo: 'imagen',  descripcion: 'JPG, PNG, WebP o GIF',          Icon: Image },
  { tipo: 'video',   descripcion: 'YouTube o Vimeo',               Icon: Play },
  { tipo: 'pdf',     descripcion: 'Documento PDF',                 Icon: FileDown },
  { tipo: 'link',    descripcion: 'Enlace externo con descripción', Icon: Link2 },
  { tipo: 'archivo', descripcion: 'Word, Excel, ZIP, etc.',         Icon: FolderOpen },
]

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const slideVariants = {
  enterFromRight: { opacity: 0, x: 40 },
  center:         { opacity: 1, x: 0 },
  exitToLeft:     { opacity: 0, x: -40 },
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export function ContenidoModal({
  modulo,
  bloque: bloqueKey,
  label,
  empresaId,
  existing,
  onClose,
  onGuardado,
}: ContenidoModalProps) {

  // ── Navegación entre pasos ──────────────────
  const [paso, setPaso] = useState<'tipo' | 'formulario'>(existing ? 'formulario' : 'tipo')
  const [tipo, setTipo] = useState<TipoContenido | null>(existing?.tipo ?? null)

  // ── Campos compartidos ──────────────────────
  const [titulo, setTitulo] = useState(existing?.titulo ?? label)

  // ── Campos por tipo ─────────────────────────
  const [contenido,  setContenido]  = useState(existing?.contenido ?? '')    // texto
  const [url,        setUrl]        = useState(existing?.url ?? '')           // imagen url / video raw / pdf url / link
  const [activeTab,  setActiveTab]  = useState<'upload' | 'url'>('upload')   // imagen, pdf
  const [descripcion, setDescripcion] = useState('')                          // link
  const [plataforma,  setPlataforma]  = useState<LinkPlataforma>('otro')      // link
  const [embedUrl,   setEmbedUrl]   = useState('')                            // video (procesado)
  const [videoPlatf, setVideoPlatf] = useState<'youtube' | 'vimeo' | null>(null)

  // ── Upload state ────────────────────────────
  const [uploadedFile,      setUploadedFile]      = useState<File | null>(null)
  const [uploadedPublicUrl, setUploadedPublicUrl] = useState('')
  const [uploadedPath,      setUploadedPath]      = useState('')
  const [uploadStatus,      setUploadStatus]      = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadError,       setUploadError]       = useState<string | null>(null)
  const [dragOver,          setDragOver]          = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Guardado ────────────────────────────────
  const [guardando,       setGuardando]       = useState(false)
  const [guardadoFeedback, setGuardadoFeedback] = useState(false)

  // ── Inicializar desde bloque existente ──────
  useEffect(() => {
    if (!existing) return
    setTitulo(existing.titulo)
    setTipo(existing.tipo)
    setPaso('formulario')

    switch (existing.tipo) {
      case 'texto':
        setContenido(existing.contenido ?? '')
        break
      case 'imagen':
      case 'pdf':
        if (existing.storage_path) {
          setActiveTab('upload')
          setUploadedPublicUrl(existing.url ?? '')
          setUploadedPath(existing.storage_path)
          setUploadStatus('done')
        } else if (existing.url) {
          setActiveTab('url')
          setUrl(existing.url)
        }
        break
      case 'video': {
        const meta = existing.metadata as MetadataVideo | null
        setUrl(meta?.url_original ?? existing.url ?? '')
        setEmbedUrl(existing.url ?? '')
        setVideoPlatf(meta?.plataforma ?? null)
        break
      }
      case 'link': {
        const meta = existing.metadata as MetadataLink | null
        setUrl(existing.url ?? '')
        setDescripcion(existing.contenido ?? '')
        setPlataforma((meta?.plataforma as LinkPlataforma) ?? 'otro')
        break
      }
      case 'archivo': {
        const meta = existing.metadata as MetadataArchivo | null
        setUploadedPublicUrl(existing.url ?? '')
        setUploadedPath(existing.storage_path ?? '')
        if (meta) setUploadStatus('done')
        break
      }
    }
  }, [existing])

  // ── Parsear URL de video con debounce ───────
  useEffect(() => {
    if (tipo !== 'video') return
    const timer = setTimeout(() => {
      const result = parseVideoUrl(url)
      if (result) {
        setEmbedUrl(result.embedUrl)
        setVideoPlatf(result.plataforma)
      } else {
        setEmbedUrl('')
        setVideoPlatf(null)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [url, tipo])

  // ── Seleccionar tipo y avanzar ───────────────
  const seleccionarTipo = (t: TipoContenido) => {
    setTipo(t)
    setPaso('formulario')
  }

  // ── Subir archivo ───────────────────────────
  const subirArchivo = useCallback(async (file: File) => {
    if (!tipo) return

    // Validar tamaño
    const maxSize = MAX_SIZE_BY_TIPO[tipo] ?? MAX_SIZE_BY_TIPO.archivo
    if (file.size > maxSize) {
      setUploadError(`El archivo supera el máximo de ${formatFileSize(maxSize)}`)
      return
    }

    setUploadedFile(file)
    setUploadStatus('uploading')
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('empresaId', empresaId)
      formData.append('modulo', modulo)
      formData.append('tipo', tipo)

      const res = await fetch('/api/admin/conocimiento/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json() as { path?: string; publicUrl?: string; error?: string }

      if (!res.ok) {
        throw new Error(data.error ?? 'Error al subir el archivo')
      }

      setUploadedPath(data.path!)
      setUploadedPublicUrl(data.publicUrl!)
      setUploadStatus('done')
    } catch (err) {
      setUploadStatus('error')
      setUploadError(err instanceof Error ? err.message : 'Error al subir el archivo')
    }
  }, [tipo, empresaId, modulo])

  // ── Drag & Drop handlers ─────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) subirArchivo(file)
  }, [subirArchivo])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) subirArchivo(file)
  }, [subirArchivo])

  // ── Validación ──────────────────────────────
  const canGuardar = (): boolean => {
    if (!titulo.trim() || !tipo) return false
    switch (tipo) {
      case 'texto':   return contenido.trim().length > 0
      case 'imagen':  return activeTab === 'upload' ? !!uploadedPublicUrl : !!url.trim()
      case 'video':   return !!embedUrl
      case 'pdf':     return activeTab === 'upload' ? !!uploadedPublicUrl : !!url.trim()
      case 'link':    return !!url.trim()
      case 'archivo': return !!uploadedPublicUrl
      default:        return false
    }
  }

  // ── Guardar ─────────────────────────────────
  const guardar = async () => {
    if (!canGuardar() || !tipo) return
    setGuardando(true)

    try {
      const supabase = createClient()

      // Construir payload según tipo
      const base = {
        empresa_id: empresaId,
        modulo,
        bloque: bloqueKey,
        titulo,
        tipo,
      }

      let extra: Partial<ContenidoBloque> = {}

      switch (tipo) {
        case 'texto':
          extra = { contenido }
          break
        case 'imagen':
          extra = {
            contenido: '',
            url:          activeTab === 'upload' ? uploadedPublicUrl : url,
            storage_path: activeTab === 'upload' ? uploadedPath : null,
          }
          break
        case 'video': {
          const metaVideo: MetadataVideo = { plataforma: videoPlatf!, url_original: url }
          extra = {
            contenido: '',
            url:      embedUrl,
            metadata: metaVideo as unknown as Record<string, string | number | boolean | null>,
          }
          break
        }
        case 'pdf':
          extra = {
            contenido: '',
            url:          activeTab === 'upload' ? uploadedPublicUrl : url,
            storage_path: activeTab === 'upload' ? uploadedPath : null,
          }
          break
        case 'link': {
          const metaLink: MetadataLink = { plataforma }
          extra = {
            contenido: descripcion,
            url,
            metadata: metaLink as unknown as Record<string, string | number | boolean | null>,
          }
          break
        }
        case 'archivo': {
          const metaArchivo: MetadataArchivo = {
            nombre: uploadedFile?.name ?? '',
            tamano: uploadedFile?.size ?? 0,
          }
          extra = {
            contenido: '',
            url:          uploadedPublicUrl,
            storage_path: uploadedPath,
            metadata:     metaArchivo as unknown as Record<string, string | number | boolean | null>,
          }
          break
        }
      }

      const payload = { ...base, ...extra }
      let savedRow: ContenidoBloque

      if (existing) {
        await supabase
          .from('conocimiento')
          .update(payload)
          .eq('id', existing.id)
        savedRow = { ...existing, ...payload } as ContenidoBloque
      } else {
        const { data } = await supabase
          .from('conocimiento')
          .insert(payload)
          .select()
          .single()
        savedRow = data as ContenidoBloque
      }

      setGuardadoFeedback(true)
      setTimeout(() => {
        onGuardado(savedRow)
      }, 600)

    } catch (err) {
      console.error('[ContenidoModal] Error guardando:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <Portal>
      <AnimatePresence>
        {/* Backdrop — sin click para cerrar */}
        <motion.div
          className="fixed inset-0 bg-black/75 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />

        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        >
          <div
            className="glass-card rounded-2xl w-full max-w-4xl flex flex-col overflow-hidden"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ─────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-3">
                {paso === 'formulario' && (
                  <button
                    onClick={() => { setPaso('tipo'); setTipo(null) }}
                    disabled={guardando}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70
                      transition-colors duration-150 disabled:opacity-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Cambiar tipo
                  </button>
                )}
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-widest">
                    {existing ? 'Editar' : 'Agregar'} · {label}
                  </p>
                  {tipo && (
                    <p className="text-sm font-medium text-white mt-0.5">
                      {TIPO_LABELS[tipo]}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={guardando}
                className="text-white/30 hover:text-white/70 transition-colors p-1 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body con animación ──────────────────── */}
            <div className="flex-1 overflow-hidden min-h-0">
              <AnimatePresence mode="wait">
                {paso === 'tipo' ? (
                  <motion.div
                    key="paso-tipo"
                    variants={slideVariants}
                    initial="enterFromRight"
                    animate="center"
                    exit="exitToLeft"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className="p-6 h-full overflow-y-auto"
                  >
                    <PasoTipo onSelect={seleccionarTipo} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="paso-formulario"
                    variants={slideVariants}
                    initial="enterFromRight"
                    animate="center"
                    exit="exitToLeft"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className="flex flex-col h-full overflow-hidden"
                  >
                    {/* Campo título (siempre visible) */}
                    <div className="px-6 py-3 border-b border-white/[0.04] flex-shrink-0">
                      <input
                        value={titulo}
                        onChange={e => setTitulo(e.target.value)}
                        placeholder="Título de la sección"
                        className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
                          px-3 py-2 text-white outline-none focus:border-indigo-500/40
                          transition-colors placeholder:text-white/20"
                      />
                    </div>

                    {/* Contenido del tipo */}
                    <div className="flex-1 overflow-y-auto p-6">
                      {tipo === 'texto'   && <FormTexto    contenido={contenido} setContenido={setContenido} />}
                      {tipo === 'imagen'  && <FormImagen   activeTab={activeTab} setActiveTab={setActiveTab} url={url} setUrl={setUrl} uploadedPublicUrl={uploadedPublicUrl} uploadStatus={uploadStatus} uploadError={uploadError} dragOver={dragOver} setDragOver={setDragOver} fileInputRef={fileInputRef} handleDrop={handleDrop} handleFileChange={handleFileChange} tipo={tipo} />}
                      {tipo === 'video'   && <FormVideo    url={url} setUrl={setUrl} embedUrl={embedUrl} />}
                      {tipo === 'pdf'     && <FormPdf      activeTab={activeTab} setActiveTab={setActiveTab} url={url} setUrl={setUrl} uploadedPublicUrl={uploadedPublicUrl} uploadedFile={uploadedFile} uploadStatus={uploadStatus} uploadError={uploadError} dragOver={dragOver} setDragOver={setDragOver} fileInputRef={fileInputRef} handleDrop={handleDrop} handleFileChange={handleFileChange} tipo={tipo} />}
                      {tipo === 'link'    && <FormLink     url={url} setUrl={setUrl} descripcion={descripcion} setDescripcion={setDescripcion} plataforma={plataforma} setPlataforma={setPlataforma} />}
                      {tipo === 'archivo' && <FormArchivo  uploadedPublicUrl={uploadedPublicUrl} uploadedFile={uploadedFile} uploadStatus={uploadStatus} uploadError={uploadError} dragOver={dragOver} setDragOver={setDragOver} fileInputRef={fileInputRef} handleDrop={handleDrop} handleFileChange={handleFileChange} tipo={tipo} />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer (solo en paso formulario) ─── */}
            {paso === 'formulario' && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
                <button
                  onClick={onClose}
                  disabled={guardando}
                  className="text-sm text-white/40 hover:text-white/70 px-4 py-2 transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  variant="primary"
                  size="md"
                  loading={guardando}
                  disabled={!canGuardar()}
                  onClick={guardar}
                >
                  {guardadoFeedback ? (
                    <><Check className="w-3.5 h-3.5 text-teal-300" /> Guardado</>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </Portal>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTES DE PASO A y B
// ═══════════════════════════════════════════════════════════════

// ── PASO A: Selector de tipo ────────────────────────────────

function PasoTipo({ onSelect }: { onSelect: (t: TipoContenido) => void }) {
  return (
    <div>
      <p className="text-sm text-white/40 mb-5">¿Qué tipo de contenido querés agregar?</p>
      <div className="grid grid-cols-3 gap-3">
        {TIPO_OPCIONES.map(({ tipo, descripcion, Icon }) => (
          <button
            key={tipo}
            onClick={() => onSelect(tipo)}
            className="flex flex-col items-center gap-3 p-5 rounded-xl text-center
              border border-white/[0.07] bg-white/[0.02]
              hover:border-indigo-500/40 hover:bg-indigo-500/[0.07]
              transition-all duration-150 group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] group-hover:bg-indigo-500/15
              border border-white/[0.08] group-hover:border-indigo-500/25
              flex items-center justify-center transition-all duration-150">
              <Icon className="w-6 h-6 text-white/40 group-hover:text-indigo-300 transition-colors duration-150" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                {TIPO_LABELS[tipo]}
              </p>
              <p className="text-[11px] text-white/30 mt-0.5 leading-tight">{descripcion}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── PASO B: Formulario TEXTO ────────────────────────────────

function FormTexto({
  contenido,
  setContenido,
}: {
  contenido: string
  setContenido: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
      <textarea
        value={contenido}
        onChange={e => setContenido(e.target.value)}
        className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl
          px-3 py-2.5 text-white/80 outline-none focus:border-indigo-500/40
          resize-none font-mono transition-colors placeholder:text-white/20"
        placeholder={'# Título\n\nEscribí el contenido acá...\n\n**negrita** *itálica*\n- lista'}
        style={{ minHeight: '280px' }}
      />
      <div className="hidden sm:block overflow-y-auto">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Preview</p>
        <MiniMarkdownPreview text={contenido} />
      </div>
    </div>
  )
}

// ── PASO B: Dropzone genérico (reutilizado) ─────────────────

interface DropzoneProps {
  tipo: TipoContenido
  uploadedPublicUrl: string
  uploadedFile: File | null
  uploadStatus: 'idle' | 'uploading' | 'done' | 'error'
  uploadError: string | null
  dragOver: boolean
  setDragOver: (v: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleDrop: (e: React.DragEvent) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  label?: string
  hint?: string
}

function Dropzone({
  tipo,
  uploadedPublicUrl,
  uploadedFile,
  uploadStatus,
  uploadError,
  dragOver,
  setDragOver,
  fileInputRef,
  handleDrop,
  handleFileChange,
  label = 'Arrastrá el archivo acá o hacé click para seleccionar',
  hint,
}: DropzoneProps) {
  const accept = ACCEPT_BY_TIPO[tipo] ?? ''

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleFileChange}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-150',
          dragOver
            ? 'border-indigo-400/50 bg-indigo-500/[0.07]'
            : 'border-white/[0.10] hover:border-indigo-400/30 hover:bg-white/[0.02]'
        )}
      >
        {uploadStatus === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-white/20" />
            <p className="text-sm text-white/40">{label}</p>
            {hint && <p className="text-xs text-white/25">{hint}</p>}
          </div>
        )}
        {uploadStatus === 'uploading' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-sm text-white/40">Subiendo{uploadedFile ? ` "${uploadedFile.name}"` : ''}...</p>
          </div>
        )}
        {uploadStatus === 'done' && uploadedPublicUrl && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
              <Check className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-sm text-white/60">
              {uploadedFile ? (
                <>{getFileEmoji(uploadedFile.name)} {uploadedFile.name} — {formatFileSize(uploadedFile.size)}</>
              ) : 'Archivo subido correctamente'}
            </p>
            <p className="text-xs text-white/30">Hacé click para cambiar el archivo</p>
          </div>
        )}
        {uploadStatus === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-400">{uploadError ?? 'Error al subir el archivo'}</p>
            <p className="text-xs text-white/30">Hacé click para intentar de nuevo</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PASO B: Tabs Upload / URL ───────────────────────────────

function TabsUploadUrl({
  activeTab,
  setActiveTab,
}: {
  activeTab: 'upload' | 'url'
  setActiveTab: (v: 'upload' | 'url') => void
}) {
  return (
    <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06] w-fit mb-4">
      {(['upload', 'url'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
            activeTab === tab
              ? 'bg-white/[0.08] text-white/80'
              : 'text-white/35 hover:text-white/60'
          )}
        >
          {tab === 'upload' ? 'Subir archivo' : 'URL externa'}
        </button>
      ))}
    </div>
  )
}

// ── PASO B: Formulario IMAGEN ───────────────────────────────

interface FormImagenProps extends DropzoneProps {
  url: string
  setUrl: (v: string) => void
  activeTab: 'upload' | 'url'
  setActiveTab: (v: 'upload' | 'url') => void
}

function FormImagen({ activeTab, setActiveTab, url, setUrl, ...dropzoneProps }: FormImagenProps) {
  const [previewUrl, setPreviewUrl] = useState(url)

  useEffect(() => {
    const timer = setTimeout(() => setPreviewUrl(url), 600)
    return () => clearTimeout(timer)
  }, [url])

  return (
    <div>
      <TabsUploadUrl activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'upload' ? (
        <>
          <Dropzone
            {...dropzoneProps}
            label="Arrastrá la imagen o hacé click para seleccionar"
            hint="JPG, PNG, WebP, GIF · Máximo 5MB"
          />
          {dropzoneProps.uploadedPublicUrl && (
            <div className="mt-3 rounded-lg overflow-hidden border border-white/[0.08]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dropzoneProps.uploadedPublicUrl} alt="Preview" className="w-full max-h-40 object-cover" />
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
              px-3 py-2.5 text-white outline-none focus:border-indigo-500/40
              transition-colors placeholder:text-white/20"
          />
          {previewUrl && (
            <div className="rounded-lg overflow-hidden border border-white/[0.08]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-40 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── PASO B: Formulario VIDEO ────────────────────────────────

function FormVideo({
  url,
  setUrl,
  embedUrl,
}: {
  url: string
  setUrl: (v: string) => void
  embedUrl: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">
          URL del video
        </label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=... o https://vimeo.com/..."
          className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
            px-3 py-2.5 text-white outline-none focus:border-indigo-500/40
            transition-colors placeholder:text-white/20"
        />
        <p className="text-[10px] text-white/25 mt-1.5">Soporta links de YouTube y Vimeo</p>
      </div>

      {embedUrl ? (
        <div
          className="relative w-full rounded-xl overflow-hidden border border-white/[0.08]"
          style={{ paddingTop: '56.25%' }}
        >
          <iframe
            src={embedUrl}
            title="Preview del video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      ) : url.trim() ? (
        <div className="h-24 flex items-center justify-center rounded-xl border border-dashed border-white/[0.08]">
          <p className="text-xs text-white/30">URL de YouTube o Vimeo no reconocida</p>
        </div>
      ) : null}
    </div>
  )
}

// ── PASO B: Formulario PDF ──────────────────────────────────

interface FormPdfProps extends DropzoneProps {
  url: string
  setUrl: (v: string) => void
  activeTab: 'upload' | 'url'
  setActiveTab: (v: 'upload' | 'url') => void
}

function FormPdf({ activeTab, setActiveTab, url, setUrl, ...dropzoneProps }: FormPdfProps) {
  const esGoogleDrive = url.includes('drive.google.com') || url.includes('docs.google.com')

  return (
    <div>
      <TabsUploadUrl activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'upload' ? (
        <Dropzone
          {...dropzoneProps}
          label="Arrastrá el PDF o hacé click para seleccionar"
          hint="Solo PDF · Máximo 20MB"
        />
      ) : (
        <div className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://docs.google.com/... o URL directa al PDF"
            className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
              px-3 py-2.5 text-white outline-none focus:border-indigo-500/40
              transition-colors placeholder:text-white/20"
          />
          {esGoogleDrive && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80">
                Asegurate que el archivo sea público o accesible por link en Google Drive
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── PASO B: Formulario LINK ─────────────────────────────────

function FormLink({
  url,
  setUrl,
  descripcion,
  setDescripcion,
  plataforma,
  setPlataforma,
}: {
  url: string
  setUrl: (v: string) => void
  descripcion: string
  setDescripcion: (v: string) => void
  plataforma: LinkPlataforma
  setPlataforma: (v: LinkPlataforma) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">
          URL *
        </label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
            px-3 py-2.5 text-white outline-none focus:border-indigo-500/40
            transition-colors placeholder:text-white/20"
        />
      </div>

      <div>
        <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">
          Descripción <span className="text-white/20 normal-case tracking-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="¿Qué encontrarán en este link?"
          className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
            px-3 py-2.5 text-white outline-none focus:border-indigo-500/40
            transition-colors placeholder:text-white/20"
        />
      </div>

      <div>
        <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">
          Plataforma <span className="text-white/20 normal-case tracking-normal">(opcional)</span>
        </label>
        <select
          value={plataforma}
          onChange={e => setPlataforma(e.target.value as LinkPlataforma)}
          className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
            px-3 py-2.5 text-white outline-none focus:border-indigo-500/40 transition-colors"
        >
          {LINK_PLATAFORMAS.map(p => (
            <option key={p.value} value={p.value} className="bg-[#0f1f3d]">
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── PASO B: Formulario ARCHIVO ──────────────────────────────

function FormArchivo(dropzoneProps: DropzoneProps) {
  return (
    <Dropzone
      {...dropzoneProps}
      label="Arrastrá el archivo o hacé click para seleccionar"
      hint="Word, Excel, PowerPoint, ZIP, CSV · Máximo 50MB"
    />
  )
}
```

### Step 2: Commit

```bash
git add src/components/admin/ContenidoModal.tsx
git commit -m "feat: add ContenidoModal with two-step flow and all content types"
```

---

## Task 6: Update conocimiento/page.tsx

**Files:**
- Modify: `src/app/admin/conocimiento/page.tsx`

### Step 1: Replace inline imports and remove inline MiniMarkdownPreview

At the top of the file, replace the current `formatInline` and `MiniMarkdownPreview` functions (lines 99-157) with an import. Also add `ContenidoModal` and new lucide icons. Add imports:

```typescript
import { FileText, Image, Play, FileDown, Link2, FolderOpen } from 'lucide-react'
import { ContenidoModal } from '@/components/admin/ContenidoModal'
import { MiniMarkdownPreview } from '@/components/shared/MiniMarkdownPreview'
import { estadoBloque, infoBloque, TIPO_LABELS } from '@/lib/conocimiento'
import type { TipoContenido } from '@/types'
```

Remove `formatInline` and `MiniMarkdownPreview` function definitions from the page file (they now come from the shared component).

### Step 2: Remove inline estadoBloque, add TipoIcon helper

Remove the `estadoBloque` function (it now comes from `@/lib/conocimiento`).

Add after the imports section:

```typescript
// Ícono del tipo de contenido (14px) para la lista de bloques
function TipoIcon({ tipo }: { tipo: TipoContenido }) {
  const cls = 'w-3.5 h-3.5 text-white/25'
  switch (tipo) {
    case 'texto':   return <FileText  className={cls} />
    case 'imagen':  return <Image     className={cls} />
    case 'video':   return <Play      className={cls} />
    case 'pdf':     return <FileDown  className={cls} />
    case 'link':    return <Link2     className={cls} />
    case 'archivo': return <FolderOpen className={cls} />
    default:        return <FileText  className={cls} />
  }
}
```

### Step 3: Update state in ConocimientoPage

Replace the `modalContenido` / `editTitulo` / `editContenido` state group (lines 180-193) with just:

```typescript
const [modalContenido, setModalContenido] = useState<{
  modulo: string
  bloque: string
  label: string
} | null>(null)
```

Remove `editTitulo`, `editContenido`, `guardando`, `guardadoFeedback` state variables (they now live inside `ContenidoModal`).

### Step 4: Update abrirModalContenido

Replace the function:

```typescript
const abrirModalContenido = (modulo: string, bloque: string, label: string) => {
  setModalContenido({ modulo, bloque, label })
}
```

Remove `guardarContenido` function entirely (logic moved to `ContenidoModal`).

### Step 5: Update the block row to show tipo icon + info

Replace the block row inner JSX (the part with `contenido && <span>X chars</span>`) with:

```tsx
<EstadoDot estado={estadoBloque(contenido)} />
<span className="flex-1 text-sm text-white/65 truncate flex items-center gap-1.5">
  {contenido && <TipoIcon tipo={contenido.tipo} />}
  {bloque.label}
</span>
{contenido && (
  <span className="text-[10px] text-white/25 font-mono mr-2 truncate max-w-[80px]">
    {infoBloque(contenido)}
  </span>
)}
```

### Step 6: Replace inline modal with ContenidoModal

Remove the entire inline modal JSX block (the `<Portal>` wrapping `modalContenido` modal, lines ~495-613). Replace with:

```tsx
{/* ── Modal de contenido ── */}
{modalContenido && empresaId && (
  <ContenidoModal
    modulo={modalContenido.modulo}
    bloque={modalContenido.bloque}
    label={modalContenido.label}
    empresaId={empresaId}
    existing={conocimientoMap[`${modalContenido.modulo}-${modalContenido.bloque}`] ?? null}
    onClose={() => setModalContenido(null)}
    onGuardado={(bloque) => {
      const key = `${modalContenido.modulo}-${modalContenido.bloque}`
      setConocimientoMap(prev => ({ ...prev, [key]: bloque }))
      setModalContenido(null)
    }}
  />
)}
```

Keep the alerta modal untouched — it still uses local state and `MiniMarkdownPreview` (now imported from shared).

### Step 7: Commit

```bash
git add src/app/admin/conocimiento/page.tsx
git commit -m "feat: integrate ContenidoModal and multi-type support in conocimiento page"
```

---

## Task 7: CLAUDE.md + final verification

**Files:**
- Modify: `CLAUDE.md`

### Step 1: Add Storage bucket documentation to CLAUDE.md

Find the `## Tablas principales en Supabase` section and add after it:

```markdown
## Supabase Storage

### Bucket: `conocimiento`
- **Creado manualmente** en el dashboard de Supabase → Storage → New Bucket
- Nombre: `conocimiento`
- **Público: true** (permite URLs públicas directas)
- Política de acceso: lectura pública, escritura solo vía API con service role key
- Path de archivos: `{empresa_id}/{modulo}/{uuid}.{ext}`
- Tipos permitidos: imagen (5MB), pdf (20MB), archivo genérico (50MB)
- API de upload: `POST /api/admin/conocimiento/upload`
```

Also update the `## Variables de entorno necesarias` section to confirm `SUPABASE_SERVICE_ROLE_KEY` usage (already documented — just verify it mentions the upload route).

### Step 2: Final TypeScript check

Run the TypeScript compiler to verify no errors:

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit 2>&1 | head -50
```

Fix any type errors before committing.

### Step 3: Commit

```bash
git add CLAUDE.md
git commit -m "docs: add Supabase Storage bucket 'conocimiento' to CLAUDE.md"
```

---

## Checklist pre-deploy

Antes de testear en browser:

1. **Ejecutar SQL en Supabase**: copiar el bloque de Task 1 y ejecutarlo en el SQL Editor
2. **Crear bucket en Supabase Storage**: Dashboard → Storage → New Bucket → nombre `conocimiento`, público `true`
3. **Verificar `.env.local`**: confirmar que `SUPABASE_SERVICE_ROLE_KEY` está seteada
4. **Verificar `NEXT_PUBLIC_SUPABASE_URL`**: requerida en la API route de upload

## Testing manual por tipo

| Tipo | Qué probar |
|---|---|
| Texto | Escribir markdown, ver preview en tiempo real, guardar, re-abrir y ver contenido |
| Imagen | Tab "Subir" → drag & drop o click → preview inmediato. Tab "URL" → pegar URL pública → preview con debounce |
| Video | Pegar URL de YouTube → ver iframe embed. Pegar URL de Vimeo → ver iframe embed |
| PDF | Subir PDF → ver nombre + tamaño. URL de Drive → ver warning |
| Link | URL + descripción + plataforma → preview card |
| Archivo | Subir .docx / .xlsx → ver emoji + nombre + tamaño |

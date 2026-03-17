'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Plus, FileText, Image, Play, FileDown, Link2,
  FolderOpen, Check, Upload, AlertCircle,
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

// Labels de módulo para el breadcrumb
const MODULO_LABELS: Record<string, string> = {
  cultura: 'Cultura e Identidad',
  rol:     'Rol y Herramientas',
}

const TIPO_OPCIONES: { tipo: TipoContenido; descripcion: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { tipo: 'texto',   descripcion: 'Contenido escrito en Markdown', Icon: FileText },
  { tipo: 'imagen',  descripcion: 'JPG, PNG, WebP o GIF',          Icon: Image },
  { tipo: 'video',   descripcion: 'YouTube o Vimeo',               Icon: Play },
  { tipo: 'pdf',     descripcion: 'Documento PDF',                 Icon: FileDown },
  { tipo: 'link',    descripcion: 'Enlace externo con descripción', Icon: Link2 },
  { tipo: 'archivo', descripcion: 'Word, Excel, ZIP, etc.',         Icon: FolderOpen },
]

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

  // ── Tipo seleccionado ───────────────────────
  const [tipo, setTipo] = useState<TipoContenido | null>(existing?.tipo ?? null)

  // ── Campos compartidos ──────────────────────
  const [titulo, setTitulo] = useState(existing?.titulo ?? label)

  // ── Campos por tipo ─────────────────────────
  const [contenido,   setContenido]   = useState(existing?.contenido ?? '')
  const [url,         setUrl]         = useState(existing?.url ?? '')
  const [activeTab,   setActiveTab]   = useState<'upload' | 'url'>('upload')
  const [descripcion, setDescripcion] = useState('')
  const [plataforma,  setPlataforma]  = useState<LinkPlataforma>('otro')
  const [embedUrl,    setEmbedUrl]    = useState('')
  const [videoPlatf,  setVideoPlatf]  = useState<'youtube' | 'vimeo' | null>(null)

  // ── Upload state ────────────────────────────
  const [uploadedFile,      setUploadedFile]      = useState<File | null>(null)
  const [uploadedPublicUrl, setUploadedPublicUrl] = useState('')
  const [uploadedPath,      setUploadedPath]      = useState('')
  const [uploadStatus,      setUploadStatus]      = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadError,       setUploadError]       = useState<string | null>(null)
  const [dragOver,          setDragOver]          = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Guardado ────────────────────────────────
  const [guardando,        setGuardando]        = useState(false)
  const [guardadoFeedback, setGuardadoFeedback] = useState(false)

  // ── Inicializar desde bloque existente ──────
  useEffect(() => {
    if (!existing) return
    setTitulo(existing.titulo)
    setTipo(existing.tipo)

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

  // ── Seleccionar tipo ────────────────────────
  const seleccionarTipo = (t: TipoContenido) => {
    setTipo(t)
  }

  // ── Subir archivo ───────────────────────────
  const subirArchivo = useCallback(async (file: File) => {
    if (!tipo) return

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
        {/* Overlay con blur */}
        <motion.div
          className="fixed inset-0 z-[99] bg-black/75 backdrop-blur-[12px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />

        {/* Modal */}
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        >
          <div
            className="relative bg-[#111e38] border border-white/[0.12]
              rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.6)]
              w-full max-w-2xl max-h-[88vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header con breadcrumb ───────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
              <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest">
                <span>{MODULO_LABELS[modulo] ?? modulo}</span>
                <span>›</span>
                <span className="text-white/70 normal-case text-sm font-medium tracking-normal">
                  {label}
                </span>
              </div>
              <button
                onClick={onClose}
                disabled={guardando}
                className="text-white/30 hover:text-white/70 transition-colors p-1 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">

              {/* Selector de tipo — siempre visible */}
              <SelectorTipo tipoActual={tipo} onSelect={seleccionarTipo} />

              {/* Resto del formulario — solo cuando hay tipo */}
              {tipo && (
                <>
                  {/* Campo título */}
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Título de la sección"
                    className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
                      px-3 py-2.5 text-white outline-none focus:border-indigo-500/40
                      transition-colors placeholder:text-white/20"
                  />

                  {/* Formulario del tipo */}
                  {tipo === 'texto'   && <FormTexto    contenido={contenido} setContenido={setContenido} />}
                  {tipo === 'imagen'  && <FormImagen   activeTab={activeTab} setActiveTab={setActiveTab} url={url} setUrl={setUrl} uploadedPublicUrl={uploadedPublicUrl} uploadedFile={uploadedFile} uploadStatus={uploadStatus} uploadError={uploadError} dragOver={dragOver} setDragOver={setDragOver} fileInputRef={fileInputRef} handleDrop={handleDrop} handleFileChange={handleFileChange} tipo={tipo} />}
                  {tipo === 'video'   && <FormVideo    url={url} setUrl={setUrl} embedUrl={embedUrl} />}
                  {tipo === 'pdf'     && <FormPdf      activeTab={activeTab} setActiveTab={setActiveTab} url={url} setUrl={setUrl} uploadedPublicUrl={uploadedPublicUrl} uploadedFile={uploadedFile} uploadStatus={uploadStatus} uploadError={uploadError} dragOver={dragOver} setDragOver={setDragOver} fileInputRef={fileInputRef} handleDrop={handleDrop} handleFileChange={handleFileChange} tipo={tipo} />}
                  {tipo === 'link'    && <FormLink     url={url} setUrl={setUrl} descripcion={descripcion} setDescripcion={setDescripcion} plataforma={plataforma} setPlataforma={setPlataforma} />}
                  {tipo === 'archivo' && <FormArchivo  uploadedPublicUrl={uploadedPublicUrl} uploadedFile={uploadedFile} uploadStatus={uploadStatus} uploadError={uploadError} dragOver={dragOver} setDragOver={setDragOver} fileInputRef={fileInputRef} handleDrop={handleDrop} handleFileChange={handleFileChange} tipo={tipo} />}

                  {/* Botón decorativo agregar otro bloque */}
                  <BtnAgregarBloque />
                </>
              )}
            </div>

            {/* ── Footer ──────────────────────────────── */}
            {tipo && (
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.08] flex-shrink-0">
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
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════

// ── Selector de tipo (siempre visible, con estado seleccionado) ──

function SelectorTipo({
  tipoActual,
  onSelect,
}: {
  tipoActual: TipoContenido | null
  onSelect: (t: TipoContenido) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TIPO_OPCIONES.map(({ tipo, descripcion, Icon }) => {
        const activo = tipoActual === tipo
        return (
          <button
            key={tipo}
            onClick={() => onSelect(tipo)}
            className={cn(
              'flex flex-col items-center gap-2 py-3 px-3 rounded-xl text-center',
              'border transition-all duration-150 group',
              activo
                ? 'bg-indigo-600/15 border-indigo-500/50'
                : 'border-white/[0.07] bg-white/[0.02] hover:border-indigo-500/40 hover:bg-indigo-500/[0.07]'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150',
              activo
                ? 'bg-indigo-500/20 border border-indigo-500/30'
                : 'bg-white/[0.06] border border-white/[0.08] group-hover:bg-indigo-500/15 group-hover:border-indigo-500/25'
            )}>
              <Icon className={cn(
                'w-4 h-4 transition-colors duration-150',
                activo ? 'text-indigo-300' : 'text-white/40 group-hover:text-indigo-300'
              )} />
            </div>
            <div>
              <p className={cn(
                'text-xs font-medium transition-colors',
                activo ? 'text-white' : 'text-white/70 group-hover:text-white'
              )}>
                {TIPO_LABELS[tipo]}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{descripcion}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Botón decorativo: agregar otro bloque ───────────────────

function BtnAgregarBloque() {
  return (
    <div className="flex items-center gap-3 mt-3 p-3
      rounded-xl border border-dashed border-white/[0.08]
      hover:border-indigo-500/30 hover:bg-indigo-600/5
      cursor-pointer transition-all duration-150 group">
      <div className="w-6 h-6 rounded-md bg-indigo-600/20
        flex items-center justify-center flex-shrink-0">
        <Plus className="w-3.5 h-3.5 text-indigo-400" />
      </div>
      <span className="text-xs text-white/35 group-hover:text-white/60">
        Agregar otro bloque de contenido
      </span>
      <div className="flex gap-1.5 ml-auto">
        {['🖼️ Imagen', '🔗 Link', '🎬 Video'].map(chip => (
          <span
            key={chip}
            className="text-[10px] px-2 py-1 rounded-md
              bg-white/[0.04] border border-white/[0.07]
              text-white/35 hover:text-white/60 cursor-pointer"
          >
            {chip}
          </span>
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

// ── PASO B: Dropzone genérico ───────────────────────────────

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

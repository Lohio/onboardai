// POST /api/admin/conocimiento/upload
// Recibe FormData: file (File), empresaId, modulo, tipo
// Sube al bucket 'conocimiento' de Supabase Storage
// Devuelve: { path, publicUrl }
// Requiere SUPABASE_SERVICE_ROLE_KEY

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'

// ── Validación server-side de tipo de archivo ────────────────────────────────

/** Extensiones permitidas por tipo de contenido */
const EXT_POR_TIPO: Record<string, Set<string>> = {
  imagen:  new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']),
  pdf:     new Set(['pdf']),
  archivo: new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip']),
}

/** Tamaños máximos por tipo (bytes) */
const MAX_BYTES: Record<string, number> = {
  imagen:   5 * 1024 * 1024,   //  5 MB
  pdf:     20 * 1024 * 1024,   // 20 MB
  archivo: 50 * 1024 * 1024,   // 50 MB
}

/** Máximo de caracteres de texto extraído que se persiste por archivo */
const MAX_TEXTO_EXTRAIDO = 50_000

/**
 * Extrae el texto de PDFs y DOCX para que el contenido nutra al agente IA.
 * Best-effort: si falla, el archivo se sube igual y se retorna null.
 */
async function extraerTexto(buffer: Buffer, ext: string): Promise<string | null> {
  try {
    if (ext === 'pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await extractText(pdf, { mergePages: true })
      const limpio = text.replace(/\s+\n/g, '\n').trim()
      return limpio ? limpio.slice(0, MAX_TEXTO_EXTRAIDO) : null
    }
    if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ buffer })
      const limpio = value.trim()
      return limpio ? limpio.slice(0, MAX_TEXTO_EXTRAIDO) : null
    }
    return null
  } catch (err) {
    console.warn('[upload/conocimiento] No se pudo extraer texto:',
      err instanceof Error ? err.message : err)
    return null
  }
}

/** Detecta MIME real via magic bytes — ignora el Content-Type enviado por el cliente */
function detectarMime(buf: Buffer): string | null {
  if (buf.length < 4) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png'
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'
  return null
}

export const POST = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    bodyType: 'formdata',
    rateLimit: RATE_LIMITS.upload,
  },
  async ({ req, user }) => {
    // Leer FormData manualmente (sin schema Zod para FormData)
    const formData = await req.formData()
    const file      = formData.get('file') as File | null
    const empresaId = formData.get('empresaId') as string | null
    const modulo    = formData.get('modulo') as string | null
    const tipo      = (formData.get('tipo') as string | null) ?? 'archivo'

    if (!file || !empresaId || !modulo) {
      return ApiError.badRequest('Faltan parámetros: file, empresaId, modulo')
    }

    // Validar que el empresaId del admin coincide (evitar subir a empresa ajena)
    if (user!.empresaId !== empresaId) {
      return ApiError.forbidden()
    }

    // `modulo` se interpola en el path del bucket — solo slugs, sin '/' ni '..'
    if (!/^[a-z0-9_-]{1,50}$/i.test(modulo)) {
      return ApiError.badRequest("Parámetro 'modulo' inválido")
    }

    // ── Validaciones server-side ─────────────────────────────────────────────

    // Tamaño máximo
    const maxBytes = MAX_BYTES[tipo] ?? MAX_BYTES.archivo
    if (file.size > maxBytes) {
      return ApiError.badRequest(`Archivo demasiado grande. Máximo ${maxBytes / 1024 / 1024} MB para tipo '${tipo}'`)
    }

    // Extensión permitida
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const extsPermitidas = EXT_POR_TIPO[tipo] ?? EXT_POR_TIPO.archivo
    if (!extsPermitidas.has(ext)) {
      return ApiError.badRequest(`Extensión .${ext} no permitida para tipo '${tipo}'`)
    }

    // Leer contenido del archivo
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Magic bytes: verificar que el contenido real coincide con la extensión declarada
    const realMime = detectarMime(buffer)
    if (tipo === 'imagen') {
      if (!realMime?.startsWith('image/')) {
        return ApiError.badRequest('El archivo no es una imagen válida (magic bytes inválidos)')
      }
    } else if (tipo === 'pdf') {
      if (realMime !== 'application/pdf') {
        return ApiError.badRequest('El archivo no es un PDF válido (magic bytes inválidos)')
      }
    }

    // Usar MIME detectado (o octet-stream como fallback seguro)
    const contentType = realMime ?? 'application/octet-stream'

    // Generar path único: {empresaId}/{modulo}/{uuid}.{ext}
    const uuid = crypto.randomUUID()
    const path = `${empresaId}/${modulo}/${uuid}.${ext}`

    // Subir con service role key (bypass RLS de Storage)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: uploadError } = await serviceSupabase
      .storage
      .from('conocimiento')
      .upload(path, buffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload/conocimiento] Error subiendo archivo:', uploadError)
      return ApiError.internal(uploadError.message)
    }

    // Extraer texto de PDFs/DOCX para que el agente IA pueda usar su contenido
    const textoExtraido = await extraerTexto(buffer, ext)

    // El bucket es privado: la URL de acceso es el proxy autenticado,
    // que verifica sesión + empresa y redirige a una signed URL
    const proxyUrl = `/api/storage/conocimiento?path=${encodeURIComponent(path)}`

    return NextResponse.json({ path, publicUrl: proxyUrl, textoExtraido })
  }
)

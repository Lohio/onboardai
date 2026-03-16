# Módulo 4 — Asistente IA: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the AI chat assistant at `/empleado/asistente` — multi-turn conversations grounded in company knowledge, streaming responses from Claude, persistent history, thumbs feedback, and gap alerts.

**Architecture:** Two files: `src/app/api/chat/route.ts` (server-side API route that builds context from Supabase, streams Claude responses, persists messages post-stream) and `src/app/empleado/asistente/page.tsx` (Client Component with sidebar, chat bubbles, streaming UI, and feedback). Auth validated server-side; client sends only `conversacion_id`, `mensaje`, `historial`.

**Tech Stack:** `@anthropic-ai/sdk` (streaming), Next.js 14 App Router Route Handlers, `@supabase/ssr` (server client), Framer Motion v12, Tailwind CSS, lucide-react, react-hot-toast.

---

## Reference files (read before coding)

- `src/lib/supabase.ts` — has `createClient()` (browser) AND `createServerSupabaseClient()` (server, for API routes)
- `src/app/empleado/cultura/page.tsx` — animation patterns to follow
- `src/types/index.ts` — add new types in Task 2
- `src/components/ui/Badge.tsx` — variants: `default`, `success`, `warning`, `error`, `info`
- `src/app/globals.css` — `.glass-card`, `.gradient-bg`, `.shimmer`, `.animate-pulse-soft`

---

## Task 1: Install Anthropic SDK + create `src/lib/claude.ts`

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/lib/claude.ts`

**Step 1: Install the SDK**

```bash
cd C:/Users/Maxi/onboardai && npm install @anthropic-ai/sdk
```

Expected: `@anthropic-ai/sdk` added to `package.json` dependencies.

**Step 2: Create the client singleton**

Create `src/lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

// Singleton — usado exclusivamente en Server Components y API routes
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

**Step 3: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add package.json package-lock.json src/lib/claude.ts && git commit -m "feat(lib): install @anthropic-ai/sdk and create Claude client singleton"
```

---

## Task 2: Add TypeScript types to `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Append at the end of `src/types/index.ts`**

```typescript
export interface ConversacionIA {
  id: string
  empresa_id: string
  usuario_id: string
  titulo: string
  created_at: string
  updated_at: string
}

export interface MensajeIA {
  id: string
  conversacion_id: string
  role: 'user' | 'assistant'
  contenido: string
  sin_info?: boolean
  feedback?: -1 | 1 | null
  created_at: string
}
```

**Step 2: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/types/index.ts && git commit -m "feat(types): add ConversacionIA and MensajeIA interfaces"
```

---

## Task 3: Create API route `src/app/api/chat/route.ts`

**Files:**
- Create: `src/app/api/chat/route.ts`

**Step 1: Create the directory and file**

Create `src/app/api/chat/route.ts` with the following complete implementation:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { anthropic } from '@/lib/claude'

const SIN_INFO_TAG = '[SIN_INFO]'

// Formatea todos los datos de la empresa como texto plano para el contexto
function buildContexto(
  conocimiento: Array<{ modulo: string; bloque: string; titulo: string; contenido: string }> | null,
  herramientas: Array<{ nombre: string; url?: string; guia?: Array<{ titulo: string; pasos: string[] }> }> | null,
  objetivos: Array<{ semana: number; titulo: string; descripcion?: string; estado: string }> | null,
  tareas: Array<{ semana: number; titulo: string; completada: boolean }> | null,
): string {
  const partes: string[] = []

  if (conocimiento?.length) {
    partes.push('=== CONOCIMIENTO DE LA EMPRESA ===')
    for (const c of conocimiento) {
      partes.push(`[${c.modulo} / ${c.bloque}] ${c.titulo}\n${c.contenido}`)
    }
  }

  if (herramientas?.length) {
    partes.push('\n=== HERRAMIENTAS ===')
    for (const h of herramientas) {
      const guiaTexto = h.guia
        ? h.guia
            .map(g => `  ${g.titulo}:\n${g.pasos.map(p => `    - ${p}`).join('\n')}`)
            .join('\n')
        : ''
      partes.push(`${h.nombre}${h.url ? ` (${h.url})` : ''}${guiaTexto ? '\n' + guiaTexto : ''}`)
    }
  }

  if (objetivos?.length) {
    partes.push('\n=== OBJETIVOS ===')
    for (const o of objetivos) {
      partes.push(
        `Semana ${o.semana}: ${o.titulo} [${o.estado}]${o.descripcion ? ` — ${o.descripcion}` : ''}`,
      )
    }
  }

  if (tareas?.length) {
    partes.push('\n=== TAREAS DEL EMPLEADO ===')
    for (const t of tareas) {
      partes.push(`Semana ${t.semana}: ${t.titulo} [${t.completada ? 'completada' : 'pendiente'}]`)
    }
  }

  return partes.join('\n') || 'No hay información cargada aún.'
}

export async function POST(req: NextRequest) {
  try {
    // Autenticación server-side (no confiamos en datos del cliente)
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // empresa_id lo leemos de la DB, nunca del cliente
    const { data: perfil } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single()

    if (!perfil) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { conversacion_id: conversacionIdEntrada, mensaje, historial } = await req.json()

    if (!mensaje?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }

    const usuario_id = user.id
    const empresa_id = perfil.empresa_id

    // 1. Crear conversación si es la primera pregunta de esta sesión
    let conversacionId = conversacionIdEntrada as string | null
    if (!conversacionId) {
      const titulo = (mensaje as string).slice(0, 50)
      const { data: nuevaConv, error: convError } = await supabase
        .from('conversaciones_ia')
        .insert({ empresa_id, usuario_id, titulo })
        .select('id')
        .single()
      if (convError) throw convError
      conversacionId = nuevaConv.id
    }

    // 2. Guardar mensaje del usuario
    const { error: msgError } = await supabase
      .from('mensajes_ia')
      .insert({ conversacion_id: conversacionId, role: 'user', contenido: mensaje })
    if (msgError) throw msgError

    // 3. Cargar contexto de la empresa en paralelo
    const [conocimientoRes, herramientasRes, objetivosRes, tareasRes] = await Promise.all([
      supabase
        .from('conocimiento')
        .select('modulo, bloque, titulo, contenido')
        .eq('empresa_id', empresa_id),
      supabase
        .from('herramientas_rol')
        .select('nombre, url, guia')
        .eq('empresa_id', empresa_id)
        .order('orden'),
      supabase
        .from('objetivos_rol')
        .select('semana, titulo, descripcion, estado')
        .eq('empresa_id', empresa_id)
        .order('semana'),
      supabase
        .from('tareas_onboarding')
        .select('semana, titulo, completada')
        .eq('empresa_id', empresa_id)
        .eq('usuario_id', usuario_id)
        .order('semana')
        .order('orden'),
    ])

    const contexto = buildContexto(
      conocimientoRes.data,
      herramientasRes.data as Array<{ nombre: string; url?: string; guia?: Array<{ titulo: string; pasos: string[] }> }> | null,
      objetivosRes.data,
      tareasRes.data,
    )

    const systemPrompt = `Sos el asistente de onboarding de la empresa. Respondés SOLO usando la información que te doy sobre la empresa. Si no encontrás la respuesta en la información disponible, empezá tu respuesta EXACTAMENTE con [SIN_INFO] y luego explicá honestamente que no tenés esa info y que ya avisaste al equipo para que la agreguen. NUNCA inventes información. Respondé en español, con tono amigable y profesional.

Información disponible:
${contexto}`

    // Convertir historial al formato de Anthropic (strip [SIN_INFO] de mensajes previos)
    type HistorialItem = { role: string; contenido: string }
    const mensajesAnthropic = [
      ...((historial as HistorialItem[]) ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content:
          m.role === 'assistant' && m.contenido.startsWith(SIN_INFO_TAG)
            ? m.contenido.slice(SIN_INFO_TAG.length)
            : m.contenido,
      })),
      { role: 'user' as const, content: mensaje as string },
    ]

    // 4. Stream de Claude + guardar post-stream
    let textoCompleto = ''
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const claudeStream = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: systemPrompt,
            messages: mensajesAnthropic,
            stream: true,
          })

          for await (const chunk of claudeStream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              textoCompleto += chunk.delta.text
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }

          // DB operations BEFORE closing — ensures they complete in serverless env
          const esSinInfo = textoCompleto.startsWith(SIN_INFO_TAG)
          const contenidoLimpio = esSinInfo
            ? textoCompleto.slice(SIN_INFO_TAG.length)
            : textoCompleto

          await supabase.from('mensajes_ia').insert({
            conversacion_id: conversacionId,
            role: 'assistant',
            contenido: contenidoLimpio,
            sin_info: esSinInfo,
          })

          if (esSinInfo) {
            await supabase.from('alertas_conocimiento').insert({
              empresa_id,
              usuario_id,
              pregunta: mensaje,
            })
          }

          await supabase
            .from('conversaciones_ia')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversacionId)
        } catch (err) {
          console.error('Error en stream de Claude:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Conversacion-Id': conversacionId!,
      },
    })
  } catch (err) {
    console.error('Error en /api/chat:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

**Step 2: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors. Common fix: if `chunk.delta` type narrows fail, cast `chunk` as `unknown` then narrow manually.

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/api/chat/route.ts && git commit -m "feat(api): add /api/chat streaming route with Claude + Supabase context"
```

---

## Task 4: Create page `src/app/empleado/asistente/page.tsx`

**Files:**
- Create: `src/app/empleado/asistente/page.tsx`

**Step 1: Create the full page file**

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Menu, Plus, ThumbsUp, ThumbsDown,
  AlertTriangle, ArrowUp, Loader2,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { ConversacionIA, MensajeIA } from '@/types'

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────

const SIN_INFO_TAG = '[SIN_INFO]'

const CHIPS_SUGERIDOS = [
  '¿Cuáles son mis tareas para esta semana?',
  '¿Cómo funciona la política de vacaciones?',
  '¿Qué herramientas voy a usar en mi trabajo?',
  '¿Cuáles son los valores de la empresa?',
  '¿A quién le reporto directamente?',
]

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function agruparPorFecha(conversaciones: ConversacionIA[]) {
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000)
  const semanaAtras = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000)

  return {
    hoy: conversaciones.filter(c => new Date(c.updated_at) >= hoy),
    ayer: conversaciones.filter(c => {
      const d = new Date(c.updated_at)
      return d >= ayer && d < hoy
    }),
    semana: conversaciones.filter(c => {
      const d = new Date(c.updated_at)
      return d >= semanaAtras && d < ayer
    }),
    antes: conversaciones.filter(c => new Date(c.updated_at) < semanaAtras),
  }
}

// ─────────────────────────────────────────
// TypingIndicator
// ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 glass-card rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/40"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────
// SinInfoAlert
// ─────────────────────────────────────────

function SinInfoAlert() {
  return (
    <div className="flex gap-2 items-start px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 mt-2">
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-300/80 leading-relaxed">
        No encontré esa información en lo que compartió la empresa. Ya le avisé al equipo para que la agreguen.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────
// ThumbsRow
// ─────────────────────────────────────────

function ThumbsRow({
  mensaje,
  onFeedback,
}: {
  mensaje: MensajeIA
  onFeedback: (id: string, valor: 1 | -1) => void
}) {
  return (
    <div className="flex items-center gap-0.5 mt-1.5 ml-1">
      <button
        onClick={() => onFeedback(mensaje.id, 1)}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          mensaje.feedback === 1
            ? 'text-teal-400'
            : 'text-white/20 hover:text-white/40',
        )}
        aria-label="Útil"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onFeedback(mensaje.id, -1)}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          mensaje.feedback === -1
            ? 'text-red-400'
            : 'text-white/20 hover:text-white/40',
        )}
        aria-label="No útil"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────
// MessageBubble
// ─────────────────────────────────────────

function MessageBubble({
  mensaje,
  onFeedback,
}: {
  mensaje: MensajeIA
  onFeedback: (id: string, valor: 1 | -1) => void
}) {
  const isUser = mensaje.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-[80%] flex flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'glass-card text-white/85 rounded-tl-sm',
          )}
        >
          <span className="whitespace-pre-wrap">{mensaje.contenido}</span>
        </div>
        {!isUser && mensaje.sin_info && <SinInfoAlert />}
        {!isUser && <ThumbsRow mensaje={mensaje} onFeedback={onFeedback} />}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────
// StreamingBubble
// ─────────────────────────────────────────

function StreamingBubble({ text, sinInfo }: { text: string; sinInfo: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="flex justify-start"
    >
      <div className="max-w-[80%] flex flex-col items-start">
        <div className="glass-card px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-white/85 leading-relaxed">
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
        {sinInfo && text && <SinInfoAlert />}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────
// SuggestedChips
// ─────────────────────────────────────────

function SuggestedChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="flex flex-wrap gap-2 justify-center"
    >
      {CHIPS_SUGERIDOS.map((chip, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.07 }}
          onClick={() => onSelect(chip)}
          className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80 hover:border-white/20 transition-all"
        >
          {chip}
        </motion.button>
      ))}
    </motion.div>
  )
}

// ─────────────────────────────────────────
// AssistantHeader
// ─────────────────────────────────────────

function AssistantHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-white/[0.06] flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="md:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/40 hover:text-white/70"
        aria-label="Abrir historial"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3">
        {/* Avatar con pulso */}
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center animate-pulse-soft">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal-400 border-2 border-[#0F1F3D]" />
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Asistente OnboardAI</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse-soft" />
            <p className="text-[11px] text-teal-400/80">En línea</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// SidebarContent (reutilizado en desktop y mobile drawer)
// ─────────────────────────────────────────

function SidebarContent({
  conversaciones,
  conversacionActualId,
  onSeleccionar,
  onNueva,
}: {
  conversaciones: ConversacionIA[]
  conversacionActualId: string | null
  onSeleccionar: (id: string) => void
  onNueva: () => void
}) {
  const grupos = agruparPorFecha(conversaciones)
  const LABELS: Record<string, string> = {
    hoy: 'Hoy',
    ayer: 'Ayer',
    semana: 'Esta semana',
    antes: 'Antes',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Botón nueva conversación */}
      <div className="p-4 border-b border-white/[0.06]">
        <button
          onClick={onNueva}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] hover:bg-white/[0.05] transition-all text-sm text-white/50 hover:text-white/75"
        >
          <Plus className="w-4 h-4" />
          Nueva conversación
        </button>
      </div>

      {/* Lista agrupada por fecha */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {(['hoy', 'ayer', 'semana', 'antes'] as const).map(grupo => {
          const items = grupos[grupo]
          if (items.length === 0) return null
          return (
            <div key={grupo}>
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-2 mb-1">
                {LABELS[grupo]}
              </p>
              <div className="space-y-0.5">
                {items.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => onSeleccionar(conv.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-xs transition-all leading-snug',
                      conversacionActualId === conv.id
                        ? 'bg-indigo-600/20 text-white/90 border border-indigo-500/20'
                        : 'text-white/45 hover:bg-white/[0.04] hover:text-white/65',
                    )}
                  >
                    {conv.titulo}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {conversaciones.length === 0 && (
          <p className="text-xs text-white/25 text-center mt-8 px-4 leading-relaxed">
            Aún no tenés conversaciones. ¡Hacé tu primera pregunta!
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// InputBar
// ─────────────────────────────────────────

function InputBar({
  value,
  onChange,
  onEnviar,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onEnviar: () => void
  disabled: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEnviar()
    }
  }

  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  return (
    <div className="border-t border-white/[0.06] p-4 flex-shrink-0">
      <div className="glass-card rounded-2xl flex items-end gap-2 px-4 py-3 max-w-2xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => {
            onChange(e.target.value)
            autoResize()
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Escribí tu pregunta..."
          rows={1}
          className="flex-1 bg-transparent text-sm text-white/85 placeholder:text-white/25 resize-none outline-none leading-relaxed disabled:opacity-50"
        />
        <button
          onClick={onEnviar}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Enviar mensaje"
        >
          {disabled ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-4 h-4 text-white" />
            </motion.div>
          ) : (
            <ArrowUp className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-white/20 text-center mt-2">
        Enter para enviar · Shift+Enter para nueva línea
      </p>
    </div>
  )
}

// ─────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────

export default function AsistentePage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const [conversaciones, setConversaciones] = useState<ConversacionIA[]>([])
  const [conversacionActualId, setConversacionActualId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<MensajeIA[]>([])
  const [inputText, setInputText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [sinInfo, setSinInfo] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll automático al fondo
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, streamingText])

  // ── Carga inicial ──
  useEffect(() => {
    async function inicializar() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const { data: convs } = await supabase
          .from('conversaciones_ia')
          .select('*')
          .eq('usuario_id', user.id)
          .order('updated_at', { ascending: false })

        if (convs) setConversaciones(convs as ConversacionIA[])
      } catch (err) {
        console.error('Error cargando historial:', err)
        toast.error('Error al cargar el historial')
      } finally {
        setLoading(false)
      }
    }
    inicializar()
  }, [])

  // ── Recargar lista de conversaciones ──
  const cargarConversaciones = useCallback(async () => {
    if (!userId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('conversaciones_ia')
      .select('*')
      .eq('usuario_id', userId)
      .order('updated_at', { ascending: false })
    if (data) setConversaciones(data as ConversacionIA[])
  }, [userId])

  // ── Abrir una conversación del historial ──
  const abrirConversacion = useCallback(async (id: string) => {
    setConversacionActualId(id)
    setSidebarAbierto(false)
    const supabase = createClient()
    const { data } = await supabase
      .from('mensajes_ia')
      .select('*')
      .eq('conversacion_id', id)
      .order('created_at')
    if (data) setMensajes(data as MensajeIA[])
  }, [])

  // ── Nueva conversación ──
  const nuevaConversacion = useCallback(() => {
    setConversacionActualId(null)
    setMensajes([])
    setSidebarAbierto(false)
    setStreamingText('')
    setSinInfo(false)
  }, [])

  // ── Enviar mensaje y manejar streaming ──
  const enviarMensaje = useCallback(async (texto?: string) => {
    const textoFinal = texto ?? inputText
    if (streaming || !textoFinal.trim()) return

    setStreaming(true)
    setStreamingText('')
    setSinInfo(false)
    setInputText('')

    // Mensaje optimista (ID temporal)
    const tempId = `temp-${Date.now()}`
    const userMsg: MensajeIA = {
      id: tempId,
      conversacion_id: conversacionActualId ?? '',
      role: 'user',
      contenido: textoFinal,
      created_at: new Date().toISOString(),
    }
    setMensajes(prev => [...prev, userMsg])

    const historial = mensajes.map(m => ({ role: m.role, contenido: m.contenido }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversacionActualId,
          mensaje: textoFinal,
          historial,
        }),
      })

      if (!res.ok) throw new Error(`Error ${res.status}`)

      const nuevaConversacionId = res.headers.get('X-Conversacion-Id')
      const cid = nuevaConversacionId ?? conversacionActualId

      if (nuevaConversacionId && !conversacionActualId) {
        setConversacionActualId(nuevaConversacionId)
      }

      // Leer stream
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let primerChunk = true
      let esSinInfo = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk

        if (primerChunk) {
          primerChunk = false
          if (fullText.startsWith(SIN_INFO_TAG)) {
            esSinInfo = true
            setSinInfo(true)
          }
        }

        setStreamingText(esSinInfo ? fullText.slice(SIN_INFO_TAG.length) : fullText)
      }

      // Recargar mensajes desde DB (tienen IDs reales + sin_info)
      if (cid) {
        const supabase = createClient()
        const { data } = await supabase
          .from('mensajes_ia')
          .select('*')
          .eq('conversacion_id', cid)
          .order('created_at')
        if (data) setMensajes(data as MensajeIA[])
        await cargarConversaciones()
      }
    } catch (err) {
      console.error('Error enviando mensaje:', err)
      toast.error('Error al enviar el mensaje')
      // Rollback del mensaje optimista
      setMensajes(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setStreaming(false)
      setStreamingText('')
      setSinInfo(false)
    }
  }, [streaming, inputText, conversacionActualId, mensajes, cargarConversaciones])

  // ── Feedback thumbs ──
  const handleFeedback = useCallback(async (mensajeId: string, valor: 1 | -1) => {
    setMensajes(prev => prev.map(m => m.id === mensajeId ? { ...m, feedback: valor } : m))
    const supabase = createClient()
    await supabase.from('mensajes_ia').update({ feedback: valor }).eq('id', mensajeId)
  }, [])

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center mx-auto mb-3 animate-pulse-soft">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-sm text-white/40">Cargando asistente...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh gradient-bg overflow-hidden">
      <Toaster position="top-right" />

      {/* Sidebar desktop (md+): siempre visible */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/[0.06] bg-[#0a1528] flex-shrink-0">
        <SidebarContent
          conversaciones={conversaciones}
          conversacionActualId={conversacionActualId}
          onSeleccionar={abrirConversacion}
          onNueva={nuevaConversacion}
        />
      </aside>

      {/* Sidebar mobile: drawer con overlay */}
      <AnimatePresence>
        {sidebarAbierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-20 md:hidden"
              onClick={() => setSidebarAbierto(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 h-full w-64 z-30 md:hidden flex flex-col border-r border-white/[0.06] bg-[#0a1528]"
            >
              <SidebarContent
                conversaciones={conversaciones}
                conversacionActualId={conversacionActualId}
                onSeleccionar={abrirConversacion}
                onNueva={nuevaConversacion}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <AssistantHeader onToggleSidebar={() => setSidebarAbierto(v => !v)} />

        {/* Chat */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Estado vacío: chips sugeridos */}
            {mensajes.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
                <div className="text-center">
                  <p className="text-sm text-white/40 mb-1">¿En qué te puedo ayudar?</p>
                  <p className="text-xs text-white/25">
                    Preguntame lo que necesitás saber sobre tu empresa
                  </p>
                </div>
                <SuggestedChips onSelect={chip => enviarMensaje(chip)} />
              </div>
            )}

            {/* Mensajes */}
            {mensajes.map(msg => (
              <MessageBubble key={msg.id} mensaje={msg} onFeedback={handleFeedback} />
            ))}

            {/* Typing indicator (esperando primer chunk) */}
            {streaming && !streamingText && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}

            {/* Streaming bubble (mientras llegan chunks) */}
            {streaming && streamingText && (
              <StreamingBubble text={streamingText} sinInfo={sinInfo} />
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        <InputBar
          value={inputText}
          onChange={setInputText}
          onEnviar={() => enviarMensaje()}
          disabled={streaming}
        />
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors. Common fix: if `useCallback` dependency warnings appear, add missing deps.

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/empleado/asistente/page.tsx && git commit -m "feat(empleado): M4 — Asistente IA chat page"
```

---

## Task 5: Final build verification

**Files:** none (verification only)

**Step 1: Run full build**

```bash
cd C:/Users/Maxi/onboardai && npm run build
```

Expected: build completes with zero TypeScript errors.

**Step 2: Common fixes**

- `anthropic.messages.create({ stream: true })` type narrowing fails → cast chunk with `as unknown as { type: string; delta?: { type: string; text: string } }` or use the `.stream()` helper instead:
  ```typescript
  const claudeStream = anthropic.messages.stream({ ... })
  for await (const chunk of claudeStream) { ... }
  ```
- `useCallback` missing deps → add them or wrap stable refs with `useRef`
- `crypto.randomUUID()` not recognized → add `/// <reference lib="dom" />` or replace with `Date.now().toString()`

**Step 3: Commit if any fixes were needed**

```bash
cd C:/Users/Maxi/onboardai && git add -p && git commit -m "fix(asistente): resolve build errors"
```

---

## Supabase schema reminder

Create these tables before testing (or the API will fail on insert):

```sql
CREATE TABLE conversaciones_ia (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE mensajes_ia (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id uuid NOT NULL REFERENCES conversaciones_ia(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  contenido text NOT NULL,
  sin_info boolean DEFAULT false,
  feedback smallint CHECK (feedback IN (-1, 1)),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE alertas_conocimiento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  pregunta text NOT NULL,
  resuelta boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

All pages handle empty tables gracefully — the chat works even with no knowledge loaded (responds with `[SIN_INFO]`).

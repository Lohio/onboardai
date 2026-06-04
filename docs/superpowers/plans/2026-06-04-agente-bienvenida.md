# Agente de Bienvenida (Telegram) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un bot de Telegram separado del CopilBot que responde solo sobre el primer día del empleado (dónde está la oficina, horario de ingreso, referente), con vinculación por deep-link token y panel admin para generar invitaciones.

**Architecture:** `bienvenidaCore.ts` es la lógica pura independiente de `botCore.ts` y de la tabla `conocimiento`. El endpoint `/api/bot/telegram` es el adaptador de transporte (verifica firma, parsea payload, devuelve `sendMessage`). El panel admin `/admin/bienvenida` lista empleados en preboarding y genera links tokenizados.

**Tech Stack:** Next.js 14 App Router, TypeScript estricto, Supabase (service role para el bot), Anthropic SDK (`claude-sonnet-4-6` leído de `app_config`), Vitest (ya instalado: `npm test` = `vitest run`), Zod, Framer Motion, Lucide React.

---

## File Map

| Tarea | Archivo | Acción |
|---|---|---|
| T1 | `scripts/agente_bienvenida.sql` | Crear |
| T2 | `src/lib/bienvenidaCore.ts` | Crear |
| T3 | `src/app/api/bot/telegram/route.ts` | Crear |
| T4a | `src/app/api/admin/bienvenida/invitar/route.ts` | Crear |
| T4b | `src/app/admin/bienvenida/page.tsx` | Crear |
| T5 | `src/lib/__tests__/bienvenidaCore.test.ts` | Crear |
| T6 | `scripts/telegram-set-webhook.md` + `docs/agente-bienvenida.md` | Crear |
| T7 | `src/lib/i18n.ts` + `src/app/admin/layout.tsx` | Modificar |

---

## Task 1: Migración SQL

**Files:**
- Create: `scripts/agente_bienvenida.sql`

> ⚠️ Este script debe ejecutarse manualmente en el SQL Editor de Supabase ANTES de hacer deploy del código.

- [ ] **Step 1: Crear el archivo SQL**

```sql
-- scripts/agente_bienvenida.sql
-- ══════════════════════════════════════════════════════════════
-- AGENTE DE BIENVENIDA (Telegram / WhatsApp)
-- Ejecutar en Supabase SQL Editor antes de deployar el código.
-- ══════════════════════════════════════════════════════════════

-- 1. Ampliar plataformas permitidas en bot_vinculaciones
ALTER TABLE bot_vinculaciones
  DROP CONSTRAINT IF EXISTS bot_vinculaciones_plataforma_check;
ALTER TABLE bot_vinculaciones
  ADD CONSTRAINT bot_vinculaciones_plataforma_check
  CHECK (plataforma IN ('teams', 'gchat', 'telegram', 'whatsapp'));

-- 2. Datos de la oficina (nivel empresa)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS direccion   text,
  ADD COLUMN IF NOT EXISTS maps_url    text,
  ADD COLUMN IF NOT EXISTS como_llegar text;

-- 3. Datos del primer día (nivel empleado)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS hora_ingreso                  text,
  ADD COLUMN IF NOT EXISTS referente_primer_dia_nombre   text,
  ADD COLUMN IF NOT EXISTS referente_primer_dia_contacto text;

-- 4. Invitaciones de bot (deep-link token)
CREATE TABLE IF NOT EXISTS bot_invitaciones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plataforma  text        NOT NULL CHECK (plataforma IN ('telegram', 'whatsapp')),
  token       text        NOT NULL UNIQUE,
  usado       boolean     NOT NULL DEFAULT false,
  expira_at   timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE bot_invitaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_invitaciones_dev"   ON bot_invitaciones;
DROP POLICY IF EXISTS "bot_invitaciones_admin" ON bot_invitaciones;

CREATE POLICY "bot_invitaciones_dev" ON bot_invitaciones
  FOR ALL USING (get_my_rol() = 'dev');

CREATE POLICY "bot_invitaciones_admin" ON bot_invitaciones
  FOR ALL USING (
    get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id()
  );

CREATE INDEX IF NOT EXISTS idx_bot_invitaciones_token ON bot_invitaciones(token);
```

- [ ] **Step 2: Ejecutar en Supabase**

Ir al SQL Editor de Supabase → pegar el contenido → Run.
Verificar que no hay errores. Confirmar que la tabla `bot_invitaciones` aparece en Table Editor.

- [ ] **Step 3: Commit**

```bash
git add scripts/agente_bienvenida.sql
git commit -m "feat(bienvenida): schema SQL — bot_invitaciones y columnas de primer día"
```

---

## Task 2: Core de bienvenida (`bienvenidaCore.ts`)

**Files:**
- Create: `src/lib/bienvenidaCore.ts`

- [ ] **Step 1: Crear el archivo completo**

```typescript
// src/lib/bienvenidaCore.ts
// Agente de bienvenida (preboarding). Separado del CopilBot.
// Solo sirve: ubicación, hora de llegada, referente del primer día, resumen.
// NO importa nada de src/lib/claude.ts ni de la tabla conocimiento.
import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

// ── Cliente admin (mismo patrón que botCore.ts) ──────────────
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Cliente Anthropic (mismo patrón que botCore.ts) ──────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tipos ────────────────────────────────────────────────────

type Plataforma = 'telegram' | 'whatsapp'

export interface BienvenidaInput {
  chatUserId: string
  plataforma: Plataforma
  mensaje:    string
}

export interface BienvenidaOutput {
  texto:          string
  mostrarBotones: boolean
}

export interface DatosBienvenida {
  nombreEmpleado:    string
  nombreEmpresa:     string
  fechaIngreso:      string | null
  horaIngreso:       string | null
  direccion:         string | null
  mapsUrl:           string | null
  comoLlegar:        string | null
  referenteNombre:   string | null
  referenteContacto: string | null
}

// Etiquetas de los botones (deben coincidir con el reply_markup de Telegram)
export const BOTONES_BIENVENIDA = [
  '📍 Dónde queda',
  '🕘 A qué hora llego',
  '🙋 Por quién pregunto',
  '✨ Mi primer día',
] as const

// ── Helpers exportados (usados en tests) ─────────────────────

export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export type Tema = 'ubicacion' | 'hora' | 'referente' | 'resumen' | 'otro'

export function detectarTema(mensaje: string): Tema {
  const m = normalizar(mensaje)
  if (/(donde|queda|direccion|ubica|oficina|llego a|como llego)/.test(m)) return 'ubicacion'
  if (/(hora|horario|a que hora|llegar|entro|entrada)/.test(m))           return 'hora'
  if (/(quien|pregunto|referente|busco|recibe|encargad)/.test(m))         return 'referente'
  if (/(primer dia|bienvenida|empiezo|arranco|resumen|que necesito)/.test(m)) return 'resumen'
  return 'otro'
}

export function fechaLegible(iso: string | null): string {
  if (!iso) return 'tu primer día'
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  } catch {
    return 'tu primer día'
  }
}

export function respuestaPorTema(tema: Tema, d: DatosBienvenida): string {
  switch (tema) {
    case 'ubicacion': {
      if (!d.direccion) {
        return 'Todavía no tengo cargada la dirección de la oficina. ' +
          'Cuando la confirmen te aviso por acá.'
      }
      const lineas = [`📍 Estamos en ${d.direccion}.`]
      if (d.comoLlegar) lineas.push('', d.comoLlegar)
      if (d.mapsUrl)    lineas.push('', `Mapa: ${d.mapsUrl}`)
      return lineas.join('\n')
    }
    case 'hora': {
      const fecha = fechaLegible(d.fechaIngreso)
      if (!d.horaIngreso) {
        return `Arrancás el ${fecha}. Todavía no tengo el horario exacto; ` +
          `apenas lo confirmen te lo paso.`
      }
      return `🕘 Tu primer día es el ${fecha} y te esperamos a las ${d.horaIngreso}. ` +
        `Si llegás unos minutos antes, mejor 🙂`
    }
    case 'referente': {
      if (!d.referenteNombre) {
        return 'Cuando llegues, avisá en recepción que sos nuevo/a y te van a acompañar. ' +
          'Apenas tenga asignado tu referente te lo digo.'
      }
      const lineas = [`🙋 Cuando llegues, preguntá por ${d.referenteNombre}.`]
      if (d.referenteContacto) {
        lineas.push(`Si necesitás avisar algo antes: ${d.referenteContacto}.`)
      }
      return lineas.join(' ')
    }
    case 'resumen': {
      const fecha = fechaLegible(d.fechaIngreso)
      const lineas = [
        `✨ Resumen de tu primer día en ${d.nombreEmpresa}:`,
        '',
        `• Cuándo: ${fecha}${d.horaIngreso ? ` a las ${d.horaIngreso}` : ''}`,
      ]
      if (d.direccion)       lineas.push(`• Dónde: ${d.direccion}`)
      if (d.referenteNombre) lineas.push(`• Quién te recibe: ${d.referenteNombre}`)
      lineas.push('', 'Cualquier duda escribime, para eso estoy.')
      return lineas.join('\n')
    }
    default:
      return ''
  }
}

export function generarTokenInvitacion(): string {
  return crypto.randomBytes(16).toString('hex')
}

// ── Resolución de datos del empleado ─────────────────────────

export async function resolverDatosBienvenida(
  usuarioId: string
): Promise<DatosBienvenida | null> {
  const supabase = getAdminClient()

  const { data: u } = await supabase
    .from('usuarios')
    .select(
      'nombre, empresa_id, fecha_ingreso, hora_ingreso, manager_id, buddy_id, ' +
      'referente_primer_dia_nombre, referente_primer_dia_contacto, ' +
      'contacto_rrhh_nombre, contacto_rrhh_email'
    )
    .eq('id', usuarioId)
    .maybeSingle()

  if (!u) return null

  const { data: emp } = await supabase
    .from('empresas')
    .select('nombre, direccion, maps_url, como_llegar')
    .eq('id', u.empresa_id)
    .maybeSingle()

  // Fallback chain: override explícito → buddy → manager → RRHH
  let referenteNombre: string | null   = u.referente_primer_dia_nombre   ?? null
  let referenteContacto: string | null = u.referente_primer_dia_contacto ?? null

  if (!referenteNombre) {
    const { data: rels } = await supabase
      .from('equipo_relaciones')
      .select('relacion, miembro_id')
      .eq('usuario_id', usuarioId)
      .in('relacion', ['buddy', 'manager'])

    const buddyId   = rels?.find(r => r.relacion === 'buddy')?.miembro_id   ?? u.buddy_id   ?? null
    const managerId = rels?.find(r => r.relacion === 'manager')?.miembro_id ?? u.manager_id ?? null
    const refId = buddyId ?? managerId

    if (refId) {
      const { data: ref } = await supabase
        .from('usuarios')
        .select('nombre, email')
        .eq('id', refId)
        .maybeSingle()
      referenteNombre   = ref?.nombre ?? null
      referenteContacto = ref?.email  ?? null
    }
  }

  if (!referenteNombre && u.contacto_rrhh_nombre) {
    referenteNombre   = u.contacto_rrhh_nombre
    referenteContacto = u.contacto_rrhh_email ?? null
  }

  return {
    nombreEmpleado:    u.nombre    ?? 'vos',
    nombreEmpresa:     emp?.nombre ?? 'la empresa',
    fechaIngreso:      u.fecha_ingreso  ?? null,
    horaIngreso:       u.hora_ingreso   ?? null,
    direccion:         emp?.direccion   ?? null,
    mapsUrl:           emp?.maps_url    ?? null,
    comoLlegar:        emp?.como_llegar ?? null,
    referenteNombre,
    referenteContacto,
  }
}

// ── Fallback acotado con Claude ───────────────────────────────

async function resolverModelo(): Promise<string> {
  const supabase = getAdminClient()
  const { data } = await supabase
    .from('app_config')
    .select('valor')
    .eq('clave', 'claude_model')
    .maybeSingle()
  return data?.valor || 'claude-sonnet-4-6'
}

async function respuestaClaude(mensaje: string, d: DatosBienvenida): Promise<string> {
  const modelo = await resolverModelo()
  const system =
    `Sos el asistente de bienvenida de ${d.nombreEmpresa} para ${d.nombreEmpleado}, ` +
    `que ingresa por primera vez. SOLO podés hablar de la bienvenida y el primer día. ` +
    `Si te preguntan otra cosa (tareas, cultura, sueldo, herramientas, etc.), respondé amablemente ` +
    `que para eso van a tener la plataforma de onboarding desde el primer día, y volvé a ofrecer ` +
    `los temas de bienvenida. Respondé en español rioplatense, cálido y breve (máximo 3 oraciones). ` +
    `Texto plano sin markdown. Datos disponibles:\n` +
    `- Empresa: ${d.nombreEmpresa}\n` +
    `- Fecha de ingreso: ${fechaLegible(d.fechaIngreso)}\n` +
    `- Hora: ${d.horaIngreso ?? 'sin confirmar'}\n` +
    `- Dirección: ${d.direccion ?? 'sin confirmar'}\n` +
    `- Cómo llegar: ${d.comoLlegar ?? 'sin datos'}\n` +
    `- Referente: ${d.referenteNombre ?? 'sin asignar'} ${d.referenteContacto ?? ''}\n` +
    `Si un dato dice "sin confirmar/sin asignar", decí honestamente que todavía no lo tenés.`

  try {
    const res = await anthropic.messages.create({
      model:      modelo,
      max_tokens: 400,
      system,
      messages:   [{ role: 'user', content: mensaje }],
    })
    const bloque = res.content.find(c => c.type === 'text')
    return bloque && 'text' in bloque ? (bloque as { type: 'text'; text: string }).text : ''
  } catch {
    return 'Perdón, se me complicó procesar eso. Probá con uno de los botones de abajo 👇'
  }
}

// ── Función principal ─────────────────────────────────────────

export async function procesarBienvenida(input: BienvenidaInput): Promise<BienvenidaOutput> {
  const { chatUserId, plataforma, mensaje } = input
  const supabase = getAdminClient()
  const texto = mensaje.trim()

  // 1) Deep-link: "/start <token>" — vincula la cuenta de Telegram al empleado
  if (texto.startsWith('/start')) {
    const token = texto.split(/\s+/)[1]

    if (token) {
      const { data: inv } = await supabase
        .from('bot_invitaciones')
        .select('id, usuario_id, empresa_id, usado, expira_at')
        .eq('token', token)
        .eq('plataforma', plataforma)
        .maybeSingle()

      if (inv && !inv.usado && new Date(inv.expira_at) > new Date()) {
        await supabase.from('bot_vinculaciones').upsert({
          usuario_id:   inv.usuario_id,
          empresa_id:   inv.empresa_id,
          plataforma,
          chat_user_id: chatUserId,
          chat_email:   null,
        }, { onConflict: 'plataforma,chat_user_id' })
        await supabase.from('bot_invitaciones').update({ usado: true }).eq('id', inv.id)

        const d = await resolverDatosBienvenida(inv.usuario_id)
        const saludo = d
          ? `¡Hola ${d.nombreEmpleado}! 👋 Soy el asistente de bienvenida de ${d.nombreEmpresa}. ` +
            `Voy a ayudarte a llegar tranqui/a tu primer día. ¿Qué querés saber?`
          : '¡Hola! 👋 Soy tu asistente de bienvenida. ¿Qué querés saber?'
        return { texto: saludo, mostrarBotones: true }
      }

      return {
        texto: 'Ese enlace de invitación no es válido o ya venció. ' +
          'Pedile a tu contacto de RRHH que te genere uno nuevo.',
        mostrarBotones: false,
      }
    }
    // /start sin token → cae al bloque de vínculo existente abajo
  }

  // 2) Buscar vínculo existente por chat_user_id
  const { data: vin } = await supabase
    .from('bot_vinculaciones')
    .select('usuario_id')
    .eq('chat_user_id', chatUserId)
    .eq('plataforma', plataforma)
    .maybeSingle()

  if (!vin) {
    return {
      texto: 'No te tengo vinculado/a todavía. Abrí el enlace de bienvenida que te mandó ' +
        'RRHH (empieza con "https://t.me/...") para que te reconozca. 🙂',
      mostrarBotones: false,
    }
  }

  const datos = await resolverDatosBienvenida(vin.usuario_id)
  if (!datos) {
    return {
      texto: 'No pude encontrar tus datos de ingreso. Avisale a RRHH, por favor.',
      mostrarBotones: false,
    }
  }

  // Fix 1: /start sin token de usuario ya vinculado → re-saludar con botones
  if (/^\/?start$/i.test(texto)) {
    return {
      texto: `¡Hola de nuevo, ${datos.nombreEmpleado}! ¿Qué querés saber de tu primer día?`,
      mostrarBotones: true,
    }
  }

  // 3) Tema conocido → respuesta directa; si no, fallback acotado con Claude
  const tema = detectarTema(texto)
  if (tema !== 'otro') {
    return { texto: respuestaPorTema(tema, datos), mostrarBotones: true }
  }

  const respuesta = await respuestaClaude(texto, datos)
  return { texto: respuesta, mostrarBotones: true }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:\Users\Maxi\onboardai && npx tsc --noEmit
```

Esperado: sin errores. Si hay errores de tipos en `@supabase/supabase-js`, verificar que la versión instalada es ≥ 2.x.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bienvenidaCore.ts
git commit -m "feat(bienvenida): bienvenidaCore — lógica pura del agente de bienvenida"
```

---

## Task 3: Endpoint de Telegram

**Files:**
- Create: `src/app/api/bot/telegram/route.ts`

- [ ] **Step 1: Crear directorio y archivo**

```bash
mkdir -p src/app/api/bot/telegram
```

```typescript
// src/app/api/bot/telegram/route.ts
// Webhook del agente de bienvenida en Telegram.
// Telegram verifica con el header X-Telegram-Bot-Api-Secret-Token.
// Responde en el body del webhook (method: 'sendMessage') — no requiere llamar la API por separado.
import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { procesarBienvenida, BOTONES_BIENVENIDA } from '@/lib/bienvenidaCore'

// ── Keyboard con los 4 botones de bienvenida ────────────────
function replyKeyboard() {
  return {
    keyboard: [
      [{ text: BOTONES_BIENVENIDA[0] }, { text: BOTONES_BIENVENIDA[1] }],
      [{ text: BOTONES_BIENVENIDA[2] }, { text: BOTONES_BIENVENIDA[3] }],
    ],
    resize_keyboard: true,
  }
}

// ── POST /api/bot/telegram ───────────────────────────────────
export const POST = withHandler(
  {
    auth:      'webhook',  // la verificación la hace el handler, no withHandler
    bodyType:  'none',     // parseamos manualmente para verificar el secret primero
    rateLimit: RATE_LIMITS.bot,
  },
  async ({ req }) => {
    // Verificar que el secret esté configurado
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Telegram no configurado' }, { status: 503 })
    }

    // Verificar cabecera de autenticación de Telegram
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
    if (headerSecret !== secret) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }

    try {
      // Telegram envía el update como JSON en el body
      const update = (await req.json()) as {
        message?: {
          text?: string
          chat?: { id: number }
          from?: { id: number }
        }
      }

      const msg        = update.message
      const text       = (msg?.text ?? '').trim()
      const chatId     = msg?.chat?.id
      const chatUserId = msg?.from?.id != null ? String(msg.from.id) : ''

      // Updates que no son mensajes de texto (edits, joins, stickers, etc.) → 200 vacío
      if (!chatId || !chatUserId || !text) {
        return NextResponse.json({ ok: true })
      }

      const { texto, mostrarBotones } = await procesarBienvenida({
        chatUserId,
        plataforma: 'telegram',
        mensaje:    text,
      })

      return NextResponse.json({
        method:  'sendMessage',
        chat_id: chatId,
        text:    texto,
        ...(mostrarBotones ? { reply_markup: replyKeyboard() } : {}),
      })
    } catch (err) {
      // Nunca retornar 5xx a Telegram — reintentaría indefinidamente
      console.error('[telegram] Error procesando update:', err)
      return NextResponse.json({ ok: true })
    }
  }
)
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bot/telegram/route.ts
git commit -m "feat(bienvenida): endpoint webhook de Telegram"
```

---

## Task 4a: API endpoint — generar invitación

**Files:**
- Create: `src/app/api/admin/bienvenida/invitar/route.ts`

- [ ] **Step 1: Crear directorios y archivo**

```bash
mkdir -p src/app/api/admin/bienvenida/invitar
```

```typescript
// src/app/api/admin/bienvenida/invitar/route.ts
// POST /api/admin/bienvenida/invitar
// Genera un token de invitación de Telegram para un empleado en preboarding.
// Requiere sesión admin o dev. Usa service role para insertar en bot_invitaciones.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'
import { generarTokenInvitacion } from '@/lib/bienvenidaCore'

const schema = z.object({ usuarioId: z.string().uuid() })

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const POST = withHandler(
  { auth: 'session', rol: ['admin', 'dev'], schema },
  async ({ body, user }) => {
    // Verificar que TELEGRAM_BOT_USERNAME esté configurado
    // (Fix 3: guard ruidoso, no fallback silencioso)
    const username = process.env.TELEGRAM_BOT_USERNAME
    if (!username) return ApiError.internal('TELEGRAM_BOT_USERNAME no configurado')

    const db = adminClient()

    // Verificar que el empleado existe
    const { data: empleado } = await db
      .from('usuarios')
      .select('id, empresa_id')
      .eq('id', body.usuarioId)
      .maybeSingle()

    if (!empleado) return ApiError.notFound('Empleado')

    // Los admins solo pueden generar links para empleados de su propia empresa
    if (user!.rol !== 'dev' && empleado.empresa_id !== user!.empresaId) {
      return ApiError.forbidden()
    }

    const token = generarTokenInvitacion()

    const { error } = await db.from('bot_invitaciones').insert({
      usuario_id: empleado.id,
      empresa_id: empleado.empresa_id,
      plataforma: 'telegram',
      token,
    })

    if (error) return ApiError.internal(error.message)

    return NextResponse.json({
      link: `https://t.me/${username}?start=${token}`,
    })
  }
)
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/bienvenida/invitar/route.ts
git commit -m "feat(bienvenida): API endpoint POST /api/admin/bienvenida/invitar"
```

---

## Task 4b: Página admin `/admin/bienvenida`

**Files:**
- Create: `src/app/admin/bienvenida/page.tsx`

- [ ] **Step 1: Crear directorio y página**

```bash
mkdir -p src/app/admin/bienvenida
```

```tsx
// src/app/admin/bienvenida/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Send, Copy, Check, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Empleado {
  id:            string
  nombre:        string | null
  puesto:        string | null
  fecha_ingreso: string | null
}

export default function BienvenidaPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading]     = useState(true)
  const [generando, setGenerando] = useState<string | null>(null)
  const [copiado, setCopiado]     = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: yo } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single()
    if (!yo) { setLoading(false); return }

    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, puesto, fecha_ingreso')
      .eq('empresa_id', yo.empresa_id)
      .eq('rol', 'empleado')
      .eq('preboarding_activo', true)
      .order('fecha_ingreso', { ascending: true })

    setEmpleados((data ?? []) as Empleado[])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function generarLink(id: string) {
    setGenerando(id)
    try {
      const res = await fetch('/api/admin/bienvenida/invitar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ usuarioId: id }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(error ?? 'Error generando link')
      }
      const { link } = await res.json() as { link: string }
      await navigator.clipboard.writeText(link)
      setCopiado(id)
      toast.success('Link copiado. Mandáselo al empleado.')
      setTimeout(() => setCopiado(null), 2500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el link.')
    } finally {
      setGenerando(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Send className="w-5 h-5 text-[#38BDF8]" />
        <h1 className="text-lg font-semibold text-white">Agente de bienvenida</h1>
      </div>
      <p className="text-sm text-white/40 mb-6">
        Generá el link de Telegram para cada empleado en preboarding. Al abrirlo, el bot lo
        reconoce y le da info de su primer día: dónde queda, a qué hora llegar y por quién preguntar.
      </p>

      <Card>
        {loading ? (
          <p className="text-sm text-white/40 py-6 text-center">Cargando...</p>
        ) : empleados.length === 0 ? (
          <div className="py-10 text-center">
            <UserPlus className="w-6 h-6 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/40">
              No hay empleados en preboarding. Activá el preboarding desde el detalle de un empleado.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {empleados.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white/85">{e.nombre ?? 'Sin nombre'}</p>
                  <p className="text-xs text-white/40">
                    {e.puesto ?? '—'}
                    {e.fecha_ingreso
                      ? ` · ingresa ${new Date(e.fecha_ingreso).toLocaleDateString('es-AR')}`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={generando === e.id}
                  onClick={() => generarLink(e.id)}
                >
                  {copiado === e.id ? (
                    <><Check className="w-3.5 h-3.5 mr-1" />Copiado</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5 mr-1" />Generar link</>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/bienvenida/page.tsx
git commit -m "feat(bienvenida): página admin /admin/bienvenida — lista empleados en preboarding y genera links"
```

---

## Task 5: Tests de bienvenidaCore

**Files:**
- Create: `src/lib/__tests__/bienvenidaCore.test.ts`

Runner: Vitest ya instalado (`vitest` en devDependencies). Script: `npm test` = `vitest run`.

- [ ] **Step 1: Crear el archivo de tests**

```typescript
// src/lib/__tests__/bienvenidaCore.test.ts
import { describe, it, expect } from 'vitest'
import {
  detectarTema,
  fechaLegible,
  respuestaPorTema,
  generarTokenInvitacion,
  type DatosBienvenida,
  type Tema,
} from '@/lib/bienvenidaCore'

// Fixture con todos los datos completos
const base: DatosBienvenida = {
  nombreEmpleado:    'Sofía',
  nombreEmpresa:     'MailAmericas',
  fechaIngreso:      '2026-06-09',
  horaIngreso:       '9:00',
  direccion:         'Av. Corrientes 1234, CABA',
  mapsUrl:           'https://maps.google.com/x',
  comoLlegar:        'Línea B, estación Uruguay',
  referenteNombre:   'Juan Pérez',
  referenteContacto: 'juan@empresa.com',
}

// Fixture con datos vacíos (columnas sin llenar)
const vacio: DatosBienvenida = {
  nombreEmpleado:    'Sofía',
  nombreEmpresa:     'MailAmericas',
  fechaIngreso:      null,
  horaIngreso:       null,
  direccion:         null,
  mapsUrl:           null,
  comoLlegar:        null,
  referenteNombre:   null,
  referenteContacto: null,
}

// ─────────────────────────────────────────────────────────────
// detectarTema
// ─────────────────────────────────────────────────────────────
describe('detectarTema', () => {
  it('detecta ubicacion con "¿Dónde queda?"', () => {
    expect(detectarTema('¿Dónde queda la oficina?')).toBe<Tema>('ubicacion')
  })
  it('detecta ubicacion con "cómo llego"', () => {
    expect(detectarTema('cómo llego a la oficina')).toBe<Tema>('ubicacion')
  })
  it('detecta hora con "a qué hora llego"', () => {
    expect(detectarTema('a qué hora llego')).toBe<Tema>('hora')
  })
  it('detecta hora con "cuándo entro"', () => {
    expect(detectarTema('cuándo entro el primer día')).toBe<Tema>('hora')
  })
  it('detecta referente con "por quién pregunto"', () => {
    expect(detectarTema('por quién pregunto cuando llegue')).toBe<Tema>('referente')
  })
  it('detecta referente con "quién me recibe"', () => {
    expect(detectarTema('quién me recibe')).toBe<Tema>('referente')
  })
  it('detecta resumen con "contame mi primer día"', () => {
    expect(detectarTema('contame mi primer día')).toBe<Tema>('resumen')
  })
  it('detecta resumen con "✨ Mi primer día" (botón con emoji)', () => {
    expect(detectarTema('✨ Mi primer día')).toBe<Tema>('resumen')
  })
  it('ignora emojis del botón de ubicación', () => {
    expect(detectarTema('📍 Dónde queda')).toBe<Tema>('ubicacion')
  })
  it('ignora emojis del botón de hora', () => {
    expect(detectarTema('🕘 A qué hora llego')).toBe<Tema>('hora')
  })
  it('ignora emojis del botón de referente', () => {
    expect(detectarTema('🙋 Por quién pregunto')).toBe<Tema>('referente')
  })
  it('cae en "otro" para preguntas fuera de scope', () => {
    expect(detectarTema('cuánto voy a cobrar')).toBe<Tema>('otro')
  })
  it('cae en "otro" para preguntas sobre cultura', () => {
    expect(detectarTema('cuáles son los valores de la empresa')).toBe<Tema>('otro')
  })
})

// ─────────────────────────────────────────────────────────────
// fechaLegible
// ─────────────────────────────────────────────────────────────
describe('fechaLegible', () => {
  it('formatea una fecha ISO en español', () => {
    const resultado = fechaLegible('2026-06-09')
    // lunes 9 de junio (o similar según locale) — solo verificamos que no es el fallback
    expect(resultado).not.toBe('tu primer día')
    expect(resultado).toContain('junio')
  })
  it('retorna fallback para null', () => {
    expect(fechaLegible(null)).toBe('tu primer día')
  })
})

// ─────────────────────────────────────────────────────────────
// respuestaPorTema — datos completos
// ─────────────────────────────────────────────────────────────
describe('respuestaPorTema con datos completos', () => {
  it('ubicacion incluye dirección y link de maps', () => {
    const t = respuestaPorTema('ubicacion', base)
    expect(t).toContain('Corrientes 1234')
    expect(t).toContain('maps.google.com')
    expect(t).toContain('Línea B')
  })
  it('hora incluye la hora configurada', () => {
    expect(respuestaPorTema('hora', base)).toContain('9:00')
  })
  it('referente nombra al referente y su email', () => {
    const t = respuestaPorTema('referente', base)
    expect(t).toContain('Juan Pérez')
    expect(t).toContain('juan@empresa.com')
  })
  it('resumen incluye empresa, fecha, dirección y referente', () => {
    const t = respuestaPorTema('resumen', base)
    expect(t).toContain('MailAmericas')
    expect(t).toContain('9:00')
    expect(t).toContain('Corrientes 1234')
    expect(t).toContain('Juan Pérez')
  })
  it('resumen no contiene artefactos de .replace()', () => {
    // Verificar que el Fix 2 está aplicado: sin "Preguntá por" ni espacios dobles
    const t = respuestaPorTema('resumen', base)
    expect(t).not.toContain(' Preguntá por')
  })
})

// ─────────────────────────────────────────────────────────────
// respuestaPorTema — datos faltantes (no debe romper)
// ─────────────────────────────────────────────────────────────
describe('respuestaPorTema con datos faltantes', () => {
  it('ubicacion sin dirección da mensaje de "todavía no tengo"', () => {
    expect(respuestaPorTema('ubicacion', vacio)).toContain('Todavía no tengo')
  })
  it('hora sin horaIngreso dice que lo confirmará', () => {
    expect(respuestaPorTema('hora', vacio)).toContain('confirmen')
  })
  it('referente sin nombre dirige a recepción', () => {
    expect(respuestaPorTema('referente', vacio)).toContain('recepción')
  })
  it('resumen sin datos no lanza excepción', () => {
    expect(() => respuestaPorTema('resumen', vacio)).not.toThrow()
    const t = respuestaPorTema('resumen', vacio)
    expect(t).toContain('MailAmericas') // nombreEmpresa siempre está
  })
})

// ─────────────────────────────────────────────────────────────
// generarTokenInvitacion
// ─────────────────────────────────────────────────────────────
describe('generarTokenInvitacion', () => {
  it('genera exactamente 32 caracteres hex', () => {
    expect(generarTokenInvitacion()).toMatch(/^[0-9a-f]{32}$/)
  })
  it('genera tokens únicos en llamadas sucesivas', () => {
    const tokens = Array.from({ length: 10 }, generarTokenInvitacion)
    const unicos = new Set(tokens)
    expect(unicos.size).toBe(10)
  })
})
```

- [ ] **Step 2: Correr los tests**

```bash
npm test
```

Esperado: todos los tests en verde (`✓ 22 tests passed`). Si alguno falla, revisar que las funciones estén exportadas en `bienvenidaCore.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/bienvenidaCore.test.ts
git commit -m "test(bienvenida): tests unitarios del core de bienvenida"
```

---

## Task 6: Docs y setup del webhook

**Files:**
- Create: `scripts/telegram-set-webhook.md`
- Create: `docs/agente-bienvenida.md`

- [ ] **Step 1: Crear guía de setup del webhook**

```markdown
<!-- scripts/telegram-set-webhook.md -->
# Registrar el webhook de Telegram (una sola vez por entorno)

## Pre-requisitos

1. Crear el bot con @BotFather en Telegram → guardar TOKEN y username.
2. Ejecutar `scripts/agente_bienvenida.sql` en el SQL Editor de Supabase.
3. Agregar estas variables en Vercel (Settings → Environment Variables):
   - `TELEGRAM_BOT_TOKEN` — el token de @BotFather
   - `TELEGRAM_WEBHOOK_SECRET` — un string random seguro (ej: `openssl rand -hex 32`)
   - `TELEGRAM_BOT_USERNAME` — el username del bot SIN @ (ej: `HeeroBienvenidaBot`)
4. Redeployar en Vercel para que las env vars estén disponibles.

## Registrar el webhook

Reemplazá `TOKEN`, `SECRET` y el dominio antes de ejecutar:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://app.heero.la/api/bot/telegram","secret_token":"<SECRET>","allowed_updates":["message"]}'
```

Respuesta esperada: `{"ok":true,"result":true,...}`

## Verificar el webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Esperado:
- `"url"` apuntando a `/api/bot/telegram`
- `"pending_update_count": 0`
- Sin campo `"last_error_message"`

## Cargar datos de la empresa para probar

En la tabla `empresas`, completar las columnas nuevas para la empresa de prueba:
- `direccion` — ej: "Av. Corrientes 1234, CABA"
- `maps_url` — link de Google Maps
- `como_llegar` — indicaciones de transporte

En la tabla `usuarios` del empleado de prueba:
- `hora_ingreso` — ej: "9:00"
- `preboarding_activo` — `true`
```

- [ ] **Step 2: Crear doc de la feature**

```markdown
<!-- docs/agente-bienvenida.md -->
# Agente de Bienvenida (Telegram)

Bot de Telegram separado del CopilBot. Responde exclusivamente sobre el primer día del empleado. No expone el conocimiento institucional de `botCore.ts`.

## Flujo completo

1. **Admin** activa `preboarding_activo = true` en el empleado.
2. **Admin** abre `/admin/bienvenida` → hace click en "Generar link".
3. Heero inserta una fila en `bot_invitaciones` con un token aleatorio de 32 chars y expira en 14 días.
4. El link `https://t.me/BotUsername?start=TOKEN` se copia al portapapeles.
5. RRHH se lo manda al empleado (email, WhatsApp, etc.).
6. **Empleado** abre el link → Telegram envía `/start TOKEN` al webhook.
7. `bienvenidaCore` verifica el token, crea la vinculación en `bot_vinculaciones`, y responde con saludo + 4 botones.
8. **Conversación posterior**: el empleado pulsa los botones o escribe libremente. Si la pregunta es de bienvenida, respuesta directa. Si no, Claude acotado (no accede a `conocimiento`).

## 4 botones

| Botón | Tema | Datos usados |
|---|---|---|
| 📍 Dónde queda | `ubicacion` | `empresas.direccion`, `maps_url`, `como_llegar` |
| 🕘 A qué hora llego | `hora` | `usuarios.fecha_ingreso`, `hora_ingreso` |
| 🙋 Por quién pregunto | `referente` | `referente_primer_dia_*` → buddy → manager → RRHH |
| ✨ Mi primer día | `resumen` | Todo lo anterior combinado |

## Tablas involucradas

| Tabla | Cambios |
|---|---|
| `bot_vinculaciones` | CHECK ampliado: `'telegram'` y `'whatsapp'` |
| `bot_invitaciones` | Nueva tabla: token, expira_at, usado |
| `empresas` | Columnas nuevas: `direccion`, `maps_url`, `como_llegar` |
| `usuarios` | Columnas nuevas: `hora_ingreso`, `referente_primer_dia_nombre/contacto` |

## Variables de entorno

```
TELEGRAM_BOT_TOKEN=        # de @BotFather
TELEGRAM_WEBHOOK_SECRET=   # string random (mismo valor en setWebhook y en el server)
TELEGRAM_BOT_USERNAME=     # sin @ — obligatorio, sin fallback
```

## Extender a WhatsApp

El mismo `bienvenidaCore.ts` se reutiliza sin cambios. Solo cambia el adaptador de transporte:

1. Crear `src/app/api/bot/whatsapp/route.ts` con la verificación de firma específica de WhatsApp Business API (HMAC-SHA256 con `X-Hub-Signature-256`).
2. Parsear el payload de WhatsApp (estructura distinta a Telegram).
3. Llamar `procesarBienvenida({ chatUserId, plataforma: 'whatsapp', mensaje })`.
4. Enviar la respuesta vía la WhatsApp Cloud API (requiere llamada POST separada, no respuesta en body).
5. Agregar `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` a las env vars.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/telegram-set-webhook.md docs/agente-bienvenida.md
git commit -m "docs(bienvenida): guía de webhook y documentación de la feature"
```

---

## Task 7: Nav admin — agregar item "Bienvenida"

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Agregar clave i18n en `src/lib/i18n.ts`**

En el bloque `ES`, después de `'nav.soon': 'Pronto'`, agregar:

```typescript
  'nav.welcome':  'Bienvenida',
```

Buscar también los bloques EN, FR, PT (están más abajo en el mismo archivo) y agregar el placeholder en cada uno. Leer el resto del archivo para ver su estructura exacta antes de editar.

```typescript
// En EN:
  'nav.welcome':  'Welcome',
// En FR:
  'nav.welcome':  'Bienvenue',
// En PT:
  'nav.welcome':  'Boas-vindas',
```

- [ ] **Step 2: Agregar `Send` a los imports de `src/app/admin/layout.tsx`**

La línea de imports de lucide-react actual es:
```typescript
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Layers,
  BarChart2,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Pencil,
  ImagePlus,
  ChevronDown,
  CreditCard,
} from 'lucide-react'
```

Agregar `Send` a la lista:
```typescript
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Layers,
  BarChart2,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Pencil,
  ImagePlus,
  ChevronDown,
  CreditCard,
  Send,
} from 'lucide-react'
```

- [ ] **Step 3: Agregar el item al array `navItems` en `src/app/admin/layout.tsx`**

El array `navItems` empieza en la línea `const navItems: NavItemDef[] = [`. Agregar el item de Bienvenida después del item de Empleados (`href: '/admin/empleados'`):

```typescript
  {
    labelKey: 'nav.welcome',
    href:     '/admin/bienvenida',
    icon:     <Send className="w-[18px] h-[18px]" />,
    disabled: false,
  },
```

- [ ] **Step 4: Verificar TypeScript y correr tests**

```bash
npx tsc --noEmit && npm test
```

Esperado: sin errores TypeScript, todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/app/admin/layout.tsx
git commit -m "feat(bienvenida): link Bienvenida en el sidebar admin"
```

---

## Checklist de cierre

- [ ] SQL ejecutado en Supabase (`scripts/agente_bienvenida.sql`).
- [ ] `bienvenidaCore.ts` no importa nada de `src/lib/claude.ts` ni de `conocimiento`.
- [ ] Modelo de Claude leído de `app_config`, fallback `claude-sonnet-4-6`.
- [ ] Endpoint verifica `X-Telegram-Bot-Api-Secret-Token`.
- [ ] Guard `TELEGRAM_BOT_USERNAME` falla ruidosamente si no está configurado.
- [ ] Página `/admin/bienvenida` lista solo empleados con `preboarding_activo = true`.
- [ ] `npm test` en verde (22+ tests).
- [ ] `npx tsc --noEmit` sin errores.
- [ ] Env vars en Vercel + webhook registrado + `getWebhookInfo` sin `last_error_message`.
- [ ] Prueba E2E: activar preboarding → generar link → abrir en Telegram → confirmar saludo + 4 botones + pregunta libre que Claude limita a bienvenida.
- [ ] Item "Bienvenida" visible en el sidebar admin.

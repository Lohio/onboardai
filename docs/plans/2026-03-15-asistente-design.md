# Diseño: Módulo 4 — Asistente IA

**Fecha:** 2026-03-15
**Rutas:** `/src/app/empleado/asistente/page.tsx` + `/src/app/api/chat/route.ts`

---

## Contexto

Módulo 4 de OnboardAI. Asistente conversacional entrenado con el conocimiento
de la empresa. El empleado hace preguntas en lenguaje natural y recibe
respuestas basadas exclusivamente en los datos cargados por el admin.
Conversaciones multi-turno con historial persistido en Supabase. Streaming
de respuestas para UX fluida.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| Modelo de conversación | Multi-turno (sesiones con historial completo) |
| Contexto para Claude | conocimiento + herramientas_rol + objetivos_rol + tareas_onboarding |
| Título de conversación | Primeros 50 chars del primer mensaje (automático) |
| Sidebar mobile | Drawer overlay (oculto por defecto, toggle con ☰) |
| Sidebar desktop | Panel fijo 240px a la izquierda |
| Streaming | ReadableStream (plain text) desde Next.js API route |
| Detección "sin info" | Prefijo `[SIN_INFO]` en system prompt; detectado client y server side |
| Feedback | Campo `feedback smallint` en `mensajes_ia` (1=👍, -1=👎, NULL=sin rating) |
| Alertas | INSERT `alertas_conocimiento` post-stream si contiene `[SIN_INFO]` |

---

## Schema Supabase

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

---

## Tipos TypeScript (agregar a src/types/index.ts)

```ts
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
  feedback?: -1 | 1 | null
  created_at: string
}
```

---

## Flujo de la API (/api/chat/route.ts)

```
POST /api/chat
Body: { conversacion_id?, mensaje, empresa_id, usuario_id, historial: {role, contenido}[] }

1. Si no hay conversacion_id:
   INSERT conversaciones_ia { titulo: mensaje.slice(0, 50), empresa_id, usuario_id }
   → devuelve nueva_conversacion_id

2. INSERT mensajes_ia { conversacion_id, role: 'user', contenido: mensaje }

3. Promise.all (contexto de la empresa):
   a. SELECT * FROM conocimiento WHERE empresa_id
   b. SELECT * FROM herramientas_rol WHERE empresa_id
   c. SELECT * FROM objetivos_rol WHERE empresa_id
   d. SELECT * FROM tareas_onboarding WHERE empresa_id AND usuario_id

4. Formatear contexto como texto plano:
   === CONOCIMIENTO EMPRESA ===
   [bloques agrupados por módulo/bloque]
   === HERRAMIENTAS ===
   [nombre, url, guía]
   === OBJETIVOS ===
   [semana, titulo, estado]
   === TAREAS DEL EMPLEADO ===
   [semana, titulo, completada]

5. Llamar a Claude claude-sonnet-4-6 con stream:
   system: "Sos el asistente de onboarding de {empresa}. Respondés SOLO usando
            la información que te doy. Si no encontrás la respuesta, empezá tu
            respuesta EXACTAMENTE con [SIN_INFO] y luego decí honestamente que
            no tenés esa info y que ya avisaste al equipo. NUNCA inventes.
            Respondé en español, tono amigable y profesional.
            Información disponible: {contexto}"
   messages: [...historial, { role: 'user', content: mensaje }]
   max_tokens: 1024

6. Transmitir chunks al cliente via ReadableStream (text/plain)
   - Primera línea especial: `data:${nueva_conversacion_id}\n` (si fue creada nueva)
   - Luego chunks de texto de Claude

7. Post-stream (en el mismo ReadableStream.start):
   - Acumular texto completo
   - INSERT mensajes_ia { role: 'assistant', contenido: textoCompleto }
   - Si textoCompleto.startsWith('[SIN_INFO]'):
       INSERT alertas_conocimiento { empresa_id, usuario_id, pregunta: mensaje }
   - UPDATE conversaciones_ia SET updated_at = now()
```

---

## Flujo de datos del cliente

```
1. supabase.auth.getUser() → user.id
2. SELECT empresa_id FROM usuarios
3. Promise.all:
   a. conversaciones_ia WHERE usuario_id ORDER BY updated_at DESC
   b. mensajes_ia WHERE conversacion_id = conversacionActualId (si hay una activa)
4. Al enviar mensaje:
   fetch('/api/chat', { method: 'POST', body: JSON.stringify({...}) })
   → leer ReadableStream con reader.read()
   → actualizar streamingText chunk a chunk
   → al finalizar: recargar mensajes de la conversación
5. Al hacer thumbs: PATCH mensajes_ia SET feedback WHERE id
```

---

## Estructura de componentes (un solo archivo)

```
AsistentePage
├── Sidebar (colapsable)
│   ├── NuevaConversacionBtn
│   └── ConversacionItem (agrupados por fecha: Hoy / Ayer / Esta semana)
├── AssistantHeader (avatar con pulso + badge "En línea")
├── ChatArea
│   ├── SuggestedChips (solo si mensajes.length === 0)
│   ├── MessageBubble (user → indigo derecha, assistant → glass-card izquierda)
│   ├── ThumbsRow (bajo cada assistant bubble completa)
│   ├── StreamingBubble (mientras llega el stream)
│   ├── TypingIndicator (antes del primer chunk)
│   └── SinInfoAlert (amber card si [SIN_INFO] detectado)
└── InputBar (textarea + botón enviar, Enter=enviar, Shift+Enter=newline)
```

---

## Animaciones

```ts
// Sidebar (mobile): slide desde la izquierda
initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
transition: { type: 'spring', stiffness: 300, damping: 30 }

// Mensajes: fade + slide up
initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
transition: { type: 'spring', stiffness: 300, damping: 26 }

// Avatar: pulse suave (clase CSS animate-pulse-soft de globals.css)

// TypingIndicator: 3 dots con stagger
staggerChildren: 0.15, cada dot: y: [0, -4, 0], repeat: Infinity

// Chips sugeridos: fade + stagger
staggerChildren: 0.08
```

---

## Chips sugeridos (hardcodeados)

```ts
const CHIPS_SUGERIDOS = [
  '¿Cuáles son mis tareas para esta semana?',
  '¿Cómo funciona la política de vacaciones?',
  '¿Qué herramientas voy a usar en mi trabajo?',
  '¿Cuáles son los valores de la empresa?',
  '¿A quién le reporto directamente?',
]
```

---

## Manejo de "sin info"

- **System prompt:** instruye a Claude a prefixear exactamente con `[SIN_INFO]`
- **Cliente:** detecta `[SIN_INFO]` en el primer chunk → oculta el tag, muestra `SinInfoAlert`
- **Servidor:** post-stream → si `textoCompleto.startsWith('[SIN_INFO]')` → INSERT alertas_conocimiento
- **SinInfoAlert UI:** card amber, ícono `AlertTriangle`, texto: "No encontré esa información en lo que me compartió la empresa. Ya le avisé al equipo para que la agreguen."

---

## Instalación necesaria

```bash
npm install @anthropic-ai/sdk
```

Crear `src/lib/claude.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

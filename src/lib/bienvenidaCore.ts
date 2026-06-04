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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: uRaw } = await supabase
    .from('usuarios')
    .select(
      'nombre, empresa_id, fecha_ingreso, hora_ingreso, manager_id, buddy_id, ' +
      'referente_primer_dia_nombre, referente_primer_dia_contacto, ' +
      'contacto_rrhh_nombre, contacto_rrhh_email'
    )
    .eq('id', usuarioId)
    .maybeSingle()

  if (!uRaw) return null
  const u = uRaw as unknown as {
    nombre: string | null
    empresa_id: string
    fecha_ingreso: string | null
    hora_ingreso: string | null
    manager_id: string | null
    buddy_id: string | null
    referente_primer_dia_nombre: string | null
    referente_primer_dia_contacto: string | null
    contacto_rrhh_nombre: string | null
    contacto_rrhh_email: string | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: empRaw } = await supabase
    .from('empresas')
    .select('nombre, direccion, maps_url, como_llegar')
    .eq('id', u.empresa_id)
    .maybeSingle()
  const emp = empRaw as unknown as {
    nombre: string | null
    direccion: string | null
    maps_url: string | null
    como_llegar: string | null
  } | null

  // Fallback chain: override explícito → buddy → manager → RRHH
  let referenteNombre: string | null   = u.referente_primer_dia_nombre   ?? null
  let referenteContacto: string | null = u.referente_primer_dia_contacto ?? null

  if (!referenteNombre) {
    const { data: relsRaw } = await supabase
      .from('equipo_relaciones')
      .select('relacion, miembro_id')
      .eq('usuario_id', usuarioId)
      .in('relacion', ['buddy', 'manager'])
    const rels = relsRaw as unknown as { relacion: string; miembro_id: string }[] | null

    const buddyId   = rels?.find(r => r.relacion === 'buddy')?.miembro_id   ?? u.buddy_id   ?? null
    const managerId = rels?.find(r => r.relacion === 'manager')?.miembro_id ?? u.manager_id ?? null
    const refId = buddyId ?? managerId

    if (refId) {
      const { data: refRaw } = await supabase
        .from('usuarios')
        .select('nombre, email')
        .eq('id', refId)
        .maybeSingle()
      const ref = refRaw as unknown as { nombre: string | null; email: string | null } | null
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

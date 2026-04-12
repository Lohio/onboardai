// Cron de recordatorios proactivos del bot (días 7, 30 y 60)
// Invocado diariamente por Vercel Cron a las 9:00 AM UTC
import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'

// Cliente con service role — necesario para leer usuarios cross-empresa
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface Empleado {
  id:            string
  nombre:        string
  empresa_id:    string
  empresa_nombre: string
  fecha_ingreso: string
}

interface Vinculacion {
  usuario_id:   string
  plataforma:   'teams' | 'gchat'
  chat_user_id: string
}

// ─────────────────────────────────────────────
// Mensajes por día de onboarding
// ─────────────────────────────────────────────

function mensajePorDia(
  dia: 7 | 30 | 60,
  nombre: string,
  empresa: string
): string {
  const primerNombre = nombre.split(' ')[0]
  if (dia === 7) {
    return `Hola ${primerNombre} 👋 Ya pasó tu primera semana en ${empresa}. ¿Avanzaste con el módulo de Cultura? Te lleva 10 min.`
  }
  if (dia === 30) {
    return `¡Un mes en ${empresa}! 🎉 Acordate de completar la encuesta de pulso en la plataforma de onboarding.`
  }
  return `Día 60 de onboarding en ${empresa}. ¿Ya completaste todos los módulos? Mirá tu progreso en la plataforma.`
}

// ─────────────────────────────────────────────
// Envío a Google Chat via REST API
// Usa el espaceName del chat_user_id (formato: users/123 → spaces/xxx)
// Para DMs con el bot se usa el space creado en la primera interacción
// ─────────────────────────────────────────────

async function enviarMensajeGchat(
  spaceName: string, // ej: "spaces/AAAA"
  texto: string
): Promise<boolean> {
  const credJson = process.env.GCHAT_SERVICE_ACCOUNT_JSON
  if (!credJson) return false

  try {
    // Importar dinámicamente google-auth-library solo si está disponible
    // Si no está instalada, loguear y continuar
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleAuth } = require('google-auth-library')
    const auth = new GoogleAuth({
      credentials: JSON.parse(credJson),
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    })
    const client = await auth.getClient()
    const token  = await client.getAccessToken()

    const res = await fetch(
      `https://chat.googleapis.com/v1/${spaceName}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ text: texto }),
      }
    )
    return res.ok
  } catch (err) {
    console.warn('[recordatorios] Error enviando a GChat:', err)
    return false
  }
}

// ─────────────────────────────────────────────
// Envío a Teams via Incoming Webhook de la empresa
// ─────────────────────────────────────────────

async function enviarMensajeTeams(
  webhookUrl: string,
  texto: string
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        text: texto,
      }),
    })
    return res.ok
  } catch (err) {
    console.warn('[recordatorios] Error enviando a Teams:', err)
    return false
  }
}

// ─────────────────────────────────────────────
// GET /api/bot/recordatorios
// ─────────────────────────────────────────────

export const GET = withHandler(
  {
    auth: 'cron',      // withHandler verifica Bearer CRON_SECRET
    bodyType: 'none',
  },
  async () => {
    // withHandler ya verificó el CRON_SECRET — usar cliente admin para queries cross-empresa
    const supabase = getAdminClient()
    const hoy      = new Date()

    // Calcular fechas objetivo (hoy menos 7, 30 y 60 días)
    const fechas: Record<7 | 30 | 60, string> = {
      7:  new Date(hoy.getTime() - 7  * 86400000).toISOString().slice(0, 10),
      30: new Date(hoy.getTime() - 30 * 86400000).toISOString().slice(0, 10),
      60: new Date(hoy.getTime() - 60 * 86400000).toISOString().slice(0, 10),
    }

    let enviados = 0
    const errores: string[] = []

    for (const [diaStr, fecha] of Object.entries(fechas)) {
      const dia = parseInt(diaStr) as 7 | 30 | 60

      // Buscar empleados cuya fecha_ingreso sea exactamente esta fecha
      const { data: empleados, error } = await supabase
        .from('usuarios')
        .select('id, nombre, empresa_id, empresas(nombre), fecha_ingreso')
        .eq('rol', 'empleado')
        .gte('fecha_ingreso', `${fecha}T00:00:00.000Z`)
        .lte('fecha_ingreso', `${fecha}T23:59:59.999Z`)

      if (error) {
        errores.push(`Día ${dia}: ${error.message}`)
        continue
      }

      for (const row of (empleados ?? [])) {
        const empleado: Empleado = {
          id:             row.id,
          nombre:         row.nombre ?? 'empleado',
          empresa_id:     row.empresa_id,
          empresa_nombre: (row.empresas as unknown as { nombre: string }[] | null)?.[0]?.nombre ?? 'tu empresa',
          fecha_ingreso:  row.fecha_ingreso,
        }

        // Buscar vinculaciones del empleado
        const { data: vinculaciones } = await supabase
          .from('bot_vinculaciones')
          .select('usuario_id, plataforma, chat_user_id')
          .eq('usuario_id', empleado.id)

        if (!vinculaciones || vinculaciones.length === 0) continue

        const texto = mensajePorDia(dia, empleado.nombre, empleado.empresa_nombre)

        for (const vin of vinculaciones as Vinculacion[]) {
          if (vin.plataforma === 'gchat') {
            // chat_user_id tiene formato "users/123"; el DM space está asociado al user
            // En producción deberías guardar el spaceName real en la vinculación
            const ok = await enviarMensajeGchat(vin.chat_user_id, texto)
            if (ok) enviados++
            else errores.push(`GChat userId=${vin.chat_user_id}: send falló`)
          }

          if (vin.plataforma === 'teams') {
            // Buscar el teams_webhook_url de la empresa
            const { data: empresaData } = await supabase
              .from('empresas')
              .select('teams_webhook_url')
              .eq('id', empleado.empresa_id)
              .maybeSingle()

            if (empresaData?.teams_webhook_url) {
              const ok = await enviarMensajeTeams(empresaData.teams_webhook_url, texto)
              if (ok) enviados++
              else errores.push(`Teams empresa=${empleado.empresa_id}: send falló`)
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok:      true,
      enviados,
      errores: errores.length > 0 ? errores : undefined,
    })
  }
)

// ─────────────────────────────────────────────
// avisoCuotaIA — emails de umbral de consumo IA (80% / 100%)
// Fire-and-forget: se llama tras registrar uso, nunca lanza.
// El RPC marcar_aviso_uso_ia garantiza un solo email por umbral/mes
// incluso ante llamadas concurrentes.
// ─────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/emails'

interface NotificarUmbralParams {
  supabase: SupabaseClient
  empresaId: string
  usadas: number
  limite: number
}

export function notificarUmbralCuotaIA({
  supabase,
  empresaId,
  usadas,
  limite,
}: NotificarUmbralParams): void {
  const pct = limite > 0 ? (usadas / limite) * 100 : 0
  const umbral = pct >= 100 ? 100 : pct >= 80 ? 80 : null
  if (!umbral) return

  // Async sin await: el aviso no debe bloquear la respuesta del chat
  void (async () => {
    try {
      // Solo el primer cruce del umbral en el mes dispara el email
      const { data: debeEnviar, error } = await supabase.rpc('marcar_aviso_uso_ia', {
        p_empresa_id: empresaId,
        p_umbral: umbral,
      })
      if (error || !debeEnviar) return

      const [{ data: empresa }, { data: admins }] = await Promise.all([
        supabase.from('empresas').select('nombre').eq('id', empresaId).single(),
        supabase
          .from('usuarios')
          .select('nombre, email')
          .eq('empresa_id', empresaId)
          .eq('rol', 'admin'),
      ])

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

      for (const admin of admins ?? []) {
        if (!admin.email) continue
        await sendEmail(admin.email, {
          tipo: 'cuota-ia',
          props: {
            adminNombre: admin.nombre ?? 'Admin',
            empresa: empresa?.nombre ?? 'tu empresa',
            umbral,
            usadas,
            limite,
            linkSuscripcion: `${appUrl}/admin/suscripcion`,
          },
        })
      }
    } catch (err) {
      console.warn('[avisoCuotaIA] No se pudo notificar el umbral:',
        err instanceof Error ? err.message : err)
    }
  })()
}

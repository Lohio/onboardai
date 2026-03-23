import { z } from 'zod'

// Schema de validación de variables de entorno requeridas y opcionales
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  TEAMS_WEBHOOK_TOKEN: z.string().optional(),
  GCHAT_SERVICE_ACCOUNT_JSON: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
})

// Validar al importar en tiempo de build/runtime
// Solo ejecutar en servidor — el browser no tiene acceso a process.env completo
const _env =
  typeof window === 'undefined'
    ? envSchema.safeParse(process.env)
    : { success: true, data: {} as z.infer<typeof envSchema> }

if (typeof window === 'undefined' && !_env.success) {
  console.error('[env] Variables de entorno inválidas:', (_env as { success: false; error: z.ZodError }).error.format())
  // No lanzar error en build para no romper el análisis estático de Next.js
}

export const env =
  typeof window === 'undefined' && _env.success
    ? _env.data
    : ({} as z.infer<typeof envSchema>)

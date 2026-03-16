/**
 * seed-dev.mjs
 * Crea usuarios de desarrollo en Supabase:
 *   - desarrollo@dev.com  → rol admin  (para gestionar la app)
 *   - test@dev.com   → rol empleado (para probar el onboarding)
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 * (Dashboard Supabase → Settings → API → service_role key)
 *
 * Uso:
 *   node scripts/seed-admin.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Leer .env.local manualmente ──
const envPath = resolve(process.cwd(), '.env.local')
const envVars = {}
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) envVars[key.trim()] = rest.join('=').trim()
  }
} catch {
  console.error('No se encontró .env.local')
  process.exit(1)
}

const SUPABASE_URL     = envVars['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`
Error: falta SUPABASE_SERVICE_ROLE_KEY en .env.local

Conseguila en:
  Supabase Dashboard → Settings → API → service_role (secret)

Agregala en .env.local:
  SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
`)
  process.exit(1)
}

// ── Config ──
const EMPRESA_NOMBRE = 'Empresa Demo'
const PASSWORD       = 'Dev1234!'

const USUARIOS = [
  {
    email:   'desarrollo@dev.com',
    nombre:  'Admin Dev',
    rol:     'admin',
    puesto:  'Administrador',
  },
  {
    email:        'test@dev.com',
    nombre:       'Juan Test',
    rol:          'empleado',
    puesto:       'Desarrollador',
    area:         'Tecnología',
    fecha_ingreso: new Date().toISOString().split('T')[0],
  },
]

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helper: crear o recuperar auth user ──
async function upsertAuthUser(email) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })

  if (!error) return data.user.id

  if (error.message.includes('already been registered')) {
    const { data: list } = await supabase.auth.admin.listUsers()
    const found = list?.users?.find(u => u.email === email)
    if (found) return found.id
  }

  console.error(`✗ Error creando auth user ${email}:`, error.message)
  process.exit(1)
}

async function seed() {
  console.log('🌱 Seeding usuarios de desarrollo...\n')

  // 1. Empresa
  let empresaId
  const { data: existente } = await supabase
    .from('empresas')
    .select('id')
    .eq('nombre', EMPRESA_NOMBRE)
    .maybeSingle()

  if (existente) {
    empresaId = existente.id
    console.log(`✓ Empresa existente: "${EMPRESA_NOMBRE}"`)
  } else {
    const { data: nueva, error } = await supabase
      .from('empresas')
      .insert({ nombre: EMPRESA_NOMBRE })
      .select('id')
      .single()

    if (error) {
      console.error('✗ Error creando empresa:', error.message)
      process.exit(1)
    }
    empresaId = nueva.id
    console.log(`✓ Empresa creada: "${EMPRESA_NOMBRE}" (${empresaId})`)
  }

  console.log()

  // 2. Crear cada usuario
  for (const u of USUARIOS) {
    const userId = await upsertAuthUser(u.email)

    const { error } = await supabase
      .from('usuarios')
      .upsert({
        id:           userId,
        empresa_id:   empresaId,
        nombre:       u.nombre,
        email:        u.email,
        rol:          u.rol,
        puesto:       u.puesto   ?? null,
        area:         u.area     ?? null,
        fecha_ingreso: u.fecha_ingreso ?? null,
      }, { onConflict: 'id' })

    if (error) {
      console.error(`✗ Error insertando usuario ${u.email}:`, error.message)
      process.exit(1)
    }

    const icon = u.rol === 'admin' ? '🔧' : '👤'
    console.log(`${icon} ${u.rol.padEnd(8)} → ${u.email}  (${u.nombre})`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Usuarios listos  —  password: ${PASSWORD}

  🔧 Admin    desarrollo@dev.com   → /admin
  👤 Empleado test@dev.com    → /empleado/perfil
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

seed()

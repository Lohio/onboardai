/**
 * Migración: cifrar passwords existentes en texto plano
 *
 * Ejecutar UNA SOLA VEZ después de setear ENCRYPTION_KEY en el entorno:
 *
 *   ENCRYPTION_KEY=<tu-key-hex> NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx ts-node --project tsconfig.json scripts/encrypt_passwords_migration.ts
 *
 * El script:
 * 1. Lee todos los usuarios con al menos un password no nulo
 * 2. Detecta si ya están cifrados (formato iv:tag:data) — los salta
 * 3. Cifra y escribe de vuelta solo los que están en texto plano
 */

import { createClient } from '@supabase/supabase-js'
import { encrypt } from '../src/lib/encryption'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function esCifrado(valor: string): boolean {
  return valor.split(':').length === 3
}

async function migrar() {
  console.log('Iniciando migración de passwords...\n')

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, password_corporativo, password_bitlocker')
    .or('password_corporativo.not.is.null,password_bitlocker.not.is.null')

  if (error) {
    console.error('Error leyendo usuarios:', error.message)
    process.exit(1)
  }

  console.log(`Usuarios con passwords: ${usuarios?.length ?? 0}\n`)

  let cifrados = 0
  let saltados = 0
  let errores  = 0

  for (const u of usuarios ?? []) {
    const update: Record<string, string | null> = {}

    if (u.password_corporativo && !esCifrado(u.password_corporativo)) {
      update.password_corporativo = encrypt(u.password_corporativo)
    }
    if (u.password_bitlocker && !esCifrado(u.password_bitlocker)) {
      update.password_bitlocker = encrypt(u.password_bitlocker)
    }

    if (Object.keys(update).length === 0) {
      saltados++
      console.log(`  ⏭  ${u.id} — ya cifrado, saltando`)
      continue
    }

    const { error: updErr } = await supabase
      .from('usuarios')
      .update(update)
      .eq('id', u.id)

    if (updErr) {
      errores++
      console.error(`  ✗  ${u.id} — error: ${updErr.message}`)
    } else {
      cifrados++
      console.log(`  ✓  ${u.id} — cifrado OK (${Object.keys(update).join(', ')})`)
    }
  }

  console.log(`\n─────────────────────────────`)
  console.log(`Cifrados:  ${cifrados}`)
  console.log(`Saltados:  ${saltados}`)
  console.log(`Errores:   ${errores}`)
  console.log(`─────────────────────────────`)

  if (errores > 0) process.exit(1)
}

migrar()

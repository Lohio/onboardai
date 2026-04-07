/**
 * Migración: cifrar passwords existentes en texto plano
 * Ejecutar con Node.js (no requiere ts-node):
 *
 *   node scripts/encrypt_passwords_migration.mjs
 *
 * Lee las variables desde .env.local automáticamente.
 * Requiere que ENCRYPTION_KEY esté seteada ahí.
 */

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Leer .env.local ──────────────────────────────────────────
function cargarEnv() {
  try {
    const ruta = resolve(process.cwd(), '.env.local')
    const contenido = readFileSync(ruta, 'utf8')
    for (const linea of contenido.split('\n')) {
      const trimmed = linea.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx < 0) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (key && val && !process.env[key]) process.env[key] = val
    }
  } catch {
    console.warn('No se encontró .env.local — usando variables del entorno')
  }
}
cargarEnv()

// ── Cifrado AES-256-GCM (mismo algoritmo que src/lib/encryption.ts) ──
function encrypt(plaintext) {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe ser 64 caracteres hex. Generá uno con: openssl rand -hex 32')
  }
  const key = Buffer.from(hex, 'hex')
  const iv  = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

function esCifrado(valor) {
  return typeof valor === 'string' && valor.split(':').length === 3
}

// ── Main ─────────────────────────────────────────────────────
async function migrar() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !svcKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.error('Falta ENCRYPTION_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, svcKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('Buscando usuarios con passwords...\n')

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, password_corporativo, password_bitlocker')
    .or('password_corporativo.not.is.null,password_bitlocker.not.is.null')

  if (error) {
    console.error('Error leyendo usuarios:', error.message)
    process.exit(1)
  }

  console.log(`Usuarios encontrados: ${usuarios?.length ?? 0}\n`)

  let cifrados = 0, saltados = 0, errores = 0

  for (const u of usuarios ?? []) {
    const update = {}

    if (u.password_corporativo && !esCifrado(u.password_corporativo)) {
      update.password_corporativo = encrypt(u.password_corporativo)
    }
    if (u.password_bitlocker && !esCifrado(u.password_bitlocker)) {
      update.password_bitlocker = encrypt(u.password_bitlocker)
    }

    if (Object.keys(update).length === 0) {
      saltados++
      console.log(`  ⏭  ${u.id} — ya cifrado`)
      continue
    }

    const { error: updErr } = await supabase.from('usuarios').update(update).eq('id', u.id)
    if (updErr) {
      errores++
      console.error(`  ✗  ${u.id} — ${updErr.message}`)
    } else {
      cifrados++
      console.log(`  ✓  ${u.id} — OK (${Object.keys(update).join(', ')})`)
    }
  }

  console.log('\n─────────────────────────')
  console.log(`Cifrados : ${cifrados}`)
  console.log(`Saltados : ${saltados}`)
  console.log(`Errores  : ${errores}`)
  console.log('─────────────────────────')
  if (errores > 0) process.exit(1)
}

migrar()

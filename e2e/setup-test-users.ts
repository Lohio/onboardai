/**
 * Script para crear usuarios de test en Supabase.
 * Usar antes de correr los tests E2E.
 *
 * Uso: npx ts-node e2e/setup-test-users.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import * as dotenv from "dotenv"

// Cargar variables del .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

// Cargar variables del .env.test
dotenv.config({ path: path.resolve(__dirname, ".env.test") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface UsuarioTest {
  email: string
  password: string
  rol: "empleado" | "admin"
  nombre: string
}

const TEST_EMPLEADO_EMAIL    = process.env.TEST_EMPLEADO_EMAIL
const TEST_EMPLEADO_PASSWORD = process.env.TEST_EMPLEADO_PASSWORD
const TEST_ADMIN_EMAIL       = process.env.TEST_ADMIN_EMAIL
const TEST_ADMIN_PASSWORD    = process.env.TEST_ADMIN_PASSWORD

if (!TEST_EMPLEADO_EMAIL || !TEST_EMPLEADO_PASSWORD || !TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
  console.error(
    "Error: faltan variables de entorno.\n" +
    "Definí en e2e/.env.test:\n" +
    "  TEST_EMPLEADO_EMAIL, TEST_EMPLEADO_PASSWORD, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD"
  )
  process.exit(1)
}

const USUARIOS_TEST: UsuarioTest[] = [
  {
    email:    TEST_EMPLEADO_EMAIL,
    password: TEST_EMPLEADO_PASSWORD,
    rol:      "empleado",
    nombre:   "Test Empleado",
  },
  {
    email:    TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
    rol:      "admin",
    nombre:   "Test Admin",
  },
]

async function crearUsuarioSiNoExiste(usuario: UsuarioTest) {
  // Verificar si ya existe
  const { data: existentes } = await supabase.auth.admin.listUsers()
  const yaExiste = existentes?.users?.find((u) => u.email === usuario.email)

  if (yaExiste) {
    console.log(`✓ Usuario ya existe: ${usuario.email}`)
    return yaExiste.id
  }

  // Crear usuario nuevo
  const { data, error } = await supabase.auth.admin.createUser({
    email: usuario.email,
    password: usuario.password,
    email_confirm: true,
    user_metadata: { nombre: usuario.nombre, rol: usuario.rol },
  })

  if (error) {
    console.error(`✗ Error creando ${usuario.email}:`, error.message)
    throw error
  }

  console.log(`✓ Usuario creado: ${usuario.email} (id: ${data.user.id})`)
  return data.user.id
}

async function main() {
  console.log("Configurando usuarios de test en Supabase...\n")

  for (const usuario of USUARIOS_TEST) {
    await crearUsuarioSiNoExiste(usuario)
  }

  console.log("\n✅ Setup completado.")
}

main().catch((err) => {
  console.error("Error en setup:", err)
  process.exit(1)
})

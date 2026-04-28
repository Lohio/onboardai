/**
 * Setup global de Playwright: obtiene tokens desde Supabase directamente
 * (evita rate-limit del endpoint /api/auth/login) y guarda el storageState
 * completo (cookies SSR + localStorage) para que funcionen tanto los
 * server components como los client components.
 */
import { chromium } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import * as dotenv from "dotenv"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })
dotenv.config({ path: path.resolve(__dirname, ".env.test") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const BASE_URL = "http://localhost:3000"
const PROJECT_REF = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? ""
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`
const CHUNK_SIZE = 3180

async function guardarSesion(email: string, password: string, statePath: string) {
  // 1. Obtener tokens directamente desde Supabase (sin pasar por la API rate-limitada)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`Login fallido para ${email}: ${error?.message}`)
  }
  const session = data.session

  // 2. Abrir browser y navegar a la app para poder setear localStorage + cookies
  const browser = await chromium.launch({
    executablePath: "C:\\Users\\Maxi\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe",
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Navegar primero para tener un origen válido donde setear localStorage
  await page.goto(`${BASE_URL}/auth/login`)

  // 3. Setear sesión en localStorage (para cliente Supabase browser)
  const localStorageKey = `sb-${PROJECT_REF}-auth-token`
  const localStorageValue = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  })
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [localStorageKey, localStorageValue]
  )

  // 4. Setear cookies SSR (para middleware y server components)
  const sessionStr = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at ?? 0,
    refresh_token: session.refresh_token,
    user: session.user,
  })

  const cookieBase = {
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  }

  if (sessionStr.length <= CHUNK_SIZE) {
    await context.addCookies([{ name: COOKIE_NAME, value: sessionStr, ...cookieBase }])
  } else {
    const cookies = []
    for (let i = 0; i * CHUNK_SIZE < sessionStr.length; i++) {
      cookies.push({
        name: `${COOKIE_NAME}.${i}`,
        value: sessionStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        ...cookieBase,
      })
    }
    await context.addCookies(cookies)
  }

  // 5. Guardar el estado completo (cookies + localStorage)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  await context.storageState({ path: statePath })
  await browser.close()
  console.log(`✓ Sesión guardada: ${email} → ${statePath}`)
}

async function globalSetup() {
  const EMPLEADO_EMAIL = process.env.TEST_EMPLEADO_EMAIL
  const EMPLEADO_PASSWORD = process.env.TEST_EMPLEADO_PASSWORD
  const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL
  const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD

  if (!EMPLEADO_EMAIL || !EMPLEADO_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Faltan variables de entorno para los tests E2E.\n" +
      "Definí en e2e/.env.test:\n" +
      "  TEST_EMPLEADO_EMAIL, TEST_EMPLEADO_PASSWORD, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD"
    )
  }

  await guardarSesion(EMPLEADO_EMAIL, EMPLEADO_PASSWORD, "e2e/.auth/empleado.json")
  await guardarSesion(ADMIN_EMAIL, ADMIN_PASSWORD, "e2e/.auth/admin.json")
}

export default globalSetup

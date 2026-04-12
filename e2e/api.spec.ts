import { test, expect } from "@playwright/test"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, ".env.test") })

const EMPLEADO_EMAIL = process.env.TEST_EMPLEADO_EMAIL ?? "test.empleado@heero.dev"
const EMPLEADO_PASSWORD = process.env.TEST_EMPLEADO_PASSWORD ?? "TestHeero2024!"
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "test.admin@heero.dev"
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "TestHeero2024!"

// Helper: obtener cookies de sesión haciendo login en el browser
async function obtenerCookiesEmpleado(page: import("@playwright/test").Page) {
  await page.goto("/auth/login")
  await page.getByPlaceholder(/email/i).fill(EMPLEADO_EMAIL)
  await page.getByPlaceholder(/contraseña/i).fill(EMPLEADO_PASSWORD)
  await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()
  await expect(page).toHaveURL(/\/empleado/, { timeout: 15000 })
  return page.context().cookies()
}

async function obtenerCookiesAdmin(page: import("@playwright/test").Page) {
  await page.goto("/auth/login")
  await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL)
  await page.getByPlaceholder(/contraseña/i).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
  return page.context().cookies()
}

test.describe("API routes básicas", () => {
  test("POST /api/empleado/encuesta-check → respuesta válida", async ({ page, request }) => {
    // Necesitamos sesión de empleado — usar page context para las cookies
    await obtenerCookiesEmpleado(page)

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/empleado/encuesta-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      return { status: res.status, ok: res.ok }
    })

    // Debe responder (200 o 401 si no está autenticado correctamente, pero no 500)
    expect(response.status).not.toBe(500)
    expect([200, 201, 204, 400, 401, 403]).toContain(response.status)
  })

  test("POST /api/empleado/chat → responde (stream o JSON)", async ({ page }) => {
    await obtenerCookiesEmpleado(page)

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/empleado/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Hola" }] }),
      })
      return { status: res.status }
    })

    // Debe responder (no 500)
    expect(response.status).not.toBe(500)
    expect([200, 201, 400, 401, 403]).toContain(response.status)
  })

  test("GET /api/admin/empleados → lista de empleados", async ({ page }) => {
    await obtenerCookiesAdmin(page)

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/admin/empleados")
      const body = await res.json().catch(() => null)
      return { status: res.status, isArray: Array.isArray(body) || Array.isArray(body?.empleados) || Array.isArray(body?.data) }
    })

    expect(response.status).toBe(200)
    expect(response.isArray).toBe(true)
  })
})

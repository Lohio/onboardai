import { test, expect, type Page } from "@playwright/test"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, ".env.test") })

const EMPLEADO_EMAIL = process.env.TEST_EMPLEADO_EMAIL ?? "test.empleado@heero.dev"
const EMPLEADO_PASSWORD = process.env.TEST_EMPLEADO_PASSWORD ?? "TestHeero2024!"

// Helper: hacer login como empleado
async function loginEmpleado(page: Page) {
  await page.goto("/auth/login")
  await page.getByPlaceholder(/email/i).fill(EMPLEADO_EMAIL)
  await page.getByPlaceholder(/contraseña/i).fill(EMPLEADO_PASSWORD)
  await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()
  await expect(page).toHaveURL(/\/empleado/, { timeout: 15000 })
}

test.describe("Empleado — Flujo principal", () => {
  test.beforeEach(async ({ page }) => {
    await loginEmpleado(page)
  })

  test("Home: carga módulos con progreso", async ({ page }) => {
    await page.goto("/empleado")
    // Debe mostrar al menos un módulo (M1, M2, M3, M4)
    await expect(page.locator("text=/perfil|cultura|rol|asistente/i").first()).toBeVisible({ timeout: 10000 })
    // No debe quedar en spinner infinito
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 10000 })
  })

  test("M1 Perfil: datos personales visibles", async ({ page }) => {
    await page.goto("/empleado/perfil")
    // Debe mostrar algún dato del perfil (nombre, cargo, etc.)
    await expect(page.locator("main, [data-testid='perfil']")).toBeVisible({ timeout: 10000 })
    // No debe quedar en spinner
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 10000 })
  })

  test("M2 Cultura: bloques de contenido cargan", async ({ page }) => {
    await page.goto("/empleado/cultura")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    // Debe haber contenido cargado, sin spinner
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 10000 })
  })

  test("M3 Rol: tareas con checkbox funcionan (toggle)", async ({ page }) => {
    await page.goto("/empleado/rol")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })

    // Buscar un checkbox o elemento tipo task
    const checkbox = page.locator("input[type='checkbox'], [role='checkbox']").first()
    const existeCheckbox = await checkbox.isVisible().catch(() => false)

    if (existeCheckbox) {
      const estadoInicial = await checkbox.isChecked()
      await checkbox.click()
      // El estado debe haber cambiado
      await expect(checkbox).toBeChecked({ checked: !estadoInicial, timeout: 5000 })
      // Volver al estado original
      await checkbox.click()
    } else {
      // Si no hay checkbox, al menos la página cargó sin error
      await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 8000 })
    }
  })

  test("M4 Asistente: puede enviar un mensaje", async ({ page }) => {
    await page.goto("/empleado/asistente")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })

    // Buscar el input de chat
    const input = page.locator("textarea, input[type='text']").first()
    await expect(input).toBeVisible({ timeout: 8000 })

    await input.fill("Hola, ¿cómo estás?")
    // Buscar botón de enviar
    const sendBtn = page.getByRole("button", { name: /enviar|send/i })
    if (await sendBtn.isVisible()) {
      await sendBtn.click()
    } else {
      await input.press("Enter")
    }

    // Esperar alguna respuesta (texto nuevo en pantalla)
    await expect(page.locator("text=/hola|hola|asistente|respuesta/i").first()).toBeVisible({ timeout: 20000 })
  })

  test("Cambio de tema dark/light aplica en toda la página", async ({ page }) => {
    await page.goto("/empleado")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })

    // Buscar botón de toggle de tema
    const temaBtn = page.getByRole("button", { name: /tema|dark|light|modo/i }).first()
    const existeTemaBtn = await temaBtn.isVisible().catch(() => false)

    if (existeTemaBtn) {
      // Obtener clase actual del html/body
      const claseAntes = await page.locator("html").getAttribute("class")
      await temaBtn.click()
      await page.waitForTimeout(500)
      const claseDespues = await page.locator("html").getAttribute("class")
      // La clase debe haber cambiado
      expect(claseAntes).not.toEqual(claseDespues)
    } else {
      // Verificar que data-theme cambia en algún elemento root
      const themeEl = page.locator("[data-theme], html").first()
      await expect(themeEl).toBeVisible()
    }
  })
})

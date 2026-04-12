import { test, expect, type Page } from "@playwright/test"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, ".env.test") })

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "test.admin@heero.dev"
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "TestHeero2024!"

// Helper: hacer login como admin
async function loginAdmin(page: Page) {
  await page.goto("/auth/login")
  await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL)
  await page.getByPlaceholder(/contraseña/i).fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
}

test.describe("Admin — Flujo principal", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test("Dashboard: métricas cargan sin spinner infinito", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    // Esperar que los spinners desaparezcan (datos cargados)
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    // Debe haber algún número o métrica visible
    await expect(page.locator("main")).toContainText(/\d/, { timeout: 10000 })
  })

  test("Lista empleados: tabla con datos", async ({ page }) => {
    await page.goto("/admin/empleados")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    // Esperar que cargue la tabla o lista
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    // Debe haber al menos una fila/tarjeta de empleado
    const filas = page.locator("table tr, [data-testid='empleado-row'], a[href*='/admin/empleados/']")
    await expect(filas.first()).toBeVisible({ timeout: 10000 })
  })

  test("Detalle empleado: tabs Edición y Progreso funcionan", async ({ page }) => {
    await page.goto("/admin/empleados")
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })

    // Hacer click en el primer empleado de la lista
    const primerEmpleado = page.locator("a[href*='/admin/empleados/']").first()
    await expect(primerEmpleado).toBeVisible({ timeout: 10000 })
    await primerEmpleado.click()

    // Debe cargar la página de detalle
    await expect(page).toHaveURL(/\/admin\/empleados\//, { timeout: 10000 })
    await expect(page.locator("main")).toBeVisible()

    // Buscar tab de Progreso
    const tabProgreso = page.getByRole("tab", { name: /progreso/i }).first()
    const existeTabProgreso = await tabProgreso.isVisible().catch(() => false)

    if (existeTabProgreso) {
      await tabProgreso.click()
      await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 8000 })
    }

    // Buscar tab de Edición
    const tabEdicion = page.getByRole("tab", { name: /edición|editar|edit/i }).first()
    const existeTabEdicion = await tabEdicion.isVisible().catch(() => false)

    if (existeTabEdicion) {
      await tabEdicion.click()
      await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 8000 })
    }
  })

  test("Organigrama: carga el árbol", async ({ page }) => {
    await page.goto("/admin/organigrama")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    // Sin spinner infinito
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    // Debe haber contenido del organigrama (nodos, nombres, etc.)
    await expect(page.locator("main")).not.toBeEmpty()
  })

  test("Reportes: vista renderiza", async ({ page }) => {
    await page.goto("/admin/reportes")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    // Sin spinner infinito
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    await expect(page.locator("main")).not.toBeEmpty()
  })
})

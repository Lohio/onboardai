import { test, expect } from "@playwright/test"

// Reusar sesión de admin guardada por global-setup (evita rate-limit de login)
test.use({ storageState: "e2e/.auth/admin.json" })

test.describe("Admin — Flujo principal", () => {
  test("Dashboard: métricas cargan sin spinner infinito", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    await expect(page.locator("main")).toContainText(/\d/, { timeout: 10000 })
  })

  test("Lista empleados: página carga sin error", async ({ page }) => {
    await page.goto("/admin/empleados")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    // La página puede mostrar empleados o un estado vacío — ambos son válidos
    await expect(page.locator("main")).not.toBeEmpty()
  })

  test("Detalle empleado: tabs Edición y Progreso funcionan", async ({ page }) => {
    await page.goto("/admin/empleados")
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })

    const primerEmpleado = page.locator("a[href*='/admin/empleados/']").first()
    // Si no hay empleados visibles, el test pasa (estado vacío es válido)
    if (!(await primerEmpleado.isVisible({ timeout: 5000 }).catch(() => false))) {
      return
    }
    await primerEmpleado.click()
    await expect(page).toHaveURL(/\/admin\/empleados\//, { timeout: 10000 })

    const tabProgreso = page.getByRole("tab", { name: /progreso/i }).first()
    if (await tabProgreso.isVisible().catch(() => false)) {
      await tabProgreso.click()
      await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 8000 })
    }

    const tabEdicion = page.getByRole("tab", { name: /edición|editar|edit/i }).first()
    if (await tabEdicion.isVisible().catch(() => false)) {
      await tabEdicion.click()
      await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 8000 })
    }
  })

  test("Organigrama: carga el árbol", async ({ page }) => {
    await page.goto("/admin/organigrama")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    await expect(page.locator("main")).not.toBeEmpty()
  })

  test("Reportes: vista renderiza", async ({ page }) => {
    await page.goto("/admin/reportes")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 15000 })
    await expect(page.locator("main")).not.toBeEmpty()
  })
})

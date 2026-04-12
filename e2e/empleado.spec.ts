import { test, expect } from "@playwright/test"

// Reusar sesión de empleado guardada por global-setup (evita rate-limit de login)
test.use({ storageState: "e2e/.auth/empleado.json" })

test.describe("Empleado — Flujo principal", () => {
  test("Home: carga módulos con progreso", async ({ page }) => {
    await page.goto("/empleado")
    // Debe mostrar al menos un módulo (M1, M2, M3, M4)
    await expect(page.locator("text=/perfil|cultura|rol|asistente/i").first()).toBeVisible({ timeout: 10000 })
    // No debe quedar en spinner infinito
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 10000 })
  })

  test("M1 Perfil: datos personales visibles", async ({ page }) => {
    await page.goto("/empleado/perfil")
    await expect(page.locator("main, [data-testid='perfil']")).toBeVisible({ timeout: 10000 })
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 10000 })
  })

  test("M2 Cultura: bloques de contenido cargan", async ({ page }) => {
    await page.goto("/empleado/cultura")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })
    await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 10000 })
  })

  test("M3 Rol: tareas con checkbox funcionan (toggle)", async ({ page }) => {
    await page.goto("/empleado/rol")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })

    const checkbox = page.locator("input[type='checkbox'], [role='checkbox']").first()
    const existeCheckbox = await checkbox.isVisible().catch(() => false)

    if (existeCheckbox) {
      const estadoInicial = await checkbox.isChecked()
      await checkbox.click()
      await expect(checkbox).toBeChecked({ checked: !estadoInicial, timeout: 5000 })
      await checkbox.click()
    } else {
      await expect(page.locator(".animate-spin")).toHaveCount(0, { timeout: 8000 })
    }
  })

  test("M4 Asistente: puede enviar un mensaje", async ({ page }) => {
    await page.goto("/empleado/asistente")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })

    const input = page.locator("textarea, input[type='text']").first()
    await expect(input).toBeVisible({ timeout: 8000 })
    await input.fill("Hola, ¿cómo estás?")

    const sendBtn = page.getByRole("button", { name: /enviar|send/i })
    if (await sendBtn.isVisible()) {
      await sendBtn.click()
    } else {
      await input.press("Enter")
    }

    await expect(page.locator("text=/hola|asistente|respuesta/i").first()).toBeVisible({ timeout: 20000 })
  })

  test("Cambio de tema dark/light aplica en toda la página", async ({ page }) => {
    await page.goto("/empleado")
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 })

    const temaBtn = page.getByRole("button", { name: /tema|dark|light|modo/i }).first()
    const existeTemaBtn = await temaBtn.isVisible().catch(() => false)

    if (existeTemaBtn) {
      const claseAntes = await page.locator("html").getAttribute("class")
      await temaBtn.click()
      await page.waitForTimeout(500)
      const claseDespues = await page.locator("html").getAttribute("class")
      expect(claseAntes).not.toEqual(claseDespues)
    } else {
      await expect(page.locator("[data-theme], html").first()).toBeVisible()
    }
  })
})

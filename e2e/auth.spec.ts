import { test, expect } from "@playwright/test"
import * as dotenv from "dotenv"
import * as path from "path"

// Cargar credenciales de test
dotenv.config({ path: path.resolve(__dirname, ".env.test") })

// Usuarios DEDICADOS para tests de form — distintos a los de storageState
// para evitar que el login aquí invalide la sesión guardada por global-setup
const EMPLEADO_EMAIL = "form.empleado@heero.dev"
const EMPLEADO_PASSWORD = "TestHeero2024!"
const ADMIN_EMAIL = "form.admin@heero.dev"
const ADMIN_PASSWORD = "TestHeero2024!"

test.describe("Auth — Login y Logout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login")
  })

  test("login con credenciales inválidas muestra error", async ({ page }) => {
    await page.getByPlaceholder("tu@empresa.com").fill("invalido@ejemplo.com")
    await page.getByPlaceholder("Contraseña").fill("passwordmalo")
    await page.getByRole("button", { name: /comenzar/i }).click()

    // Debe mostrar mensaje de error visible
    await expect(page.locator("[data-testid='auth-error'], .text-red-400, .text-red-500")).toBeVisible({ timeout: 8000 })
  })

  test("login como empleado redirige a /empleado", async ({ page }) => {
    await page.getByPlaceholder("tu@empresa.com").fill(EMPLEADO_EMAIL)
    await page.getByPlaceholder("Contraseña").fill(EMPLEADO_PASSWORD)
    await page.getByRole("button", { name: /comenzar/i }).click()

    // Esperar redirección a la sección de empleado
    await expect(page).toHaveURL(/\/empleado/, { timeout: 15000 })
  })

  test("login como admin redirige a /admin", async ({ page }) => {
    await page.getByPlaceholder("tu@empresa.com").fill(ADMIN_EMAIL)
    await page.getByPlaceholder("Contraseña").fill(ADMIN_PASSWORD)
    await page.getByRole("button", { name: /comenzar/i }).click()

    // Esperar redirección a la sección de admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
  })

  test("logout redirige a /auth/login", async ({ page }) => {
    // Primero hacer login como empleado
    await page.getByPlaceholder("tu@empresa.com").fill(EMPLEADO_EMAIL)
    await page.getByPlaceholder("Contraseña").fill(EMPLEADO_PASSWORD)
    await page.getByRole("button", { name: /comenzar/i }).click()
    await expect(page).toHaveURL(/\/empleado/, { timeout: 15000 })

    // Buscar y hacer click en logout
    const logoutBtn = page.getByRole("button", { name: /salir|logout|cerrar sesión/i })
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
    } else {
      // El logout puede estar en un menú
      const menuBtn = page.getByRole("button", { name: /menú|perfil|avatar/i }).first()
      await menuBtn.click()
      await page.getByRole("button", { name: /salir|logout|cerrar sesión/i }).click()
    }

    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })
})

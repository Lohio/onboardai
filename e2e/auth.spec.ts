import { test, expect } from "@playwright/test"
import * as dotenv from "dotenv"
import * as path from "path"

// Cargar credenciales de test
dotenv.config({ path: path.resolve(__dirname, ".env.test") })

const EMPLEADO_EMAIL = process.env.TEST_EMPLEADO_EMAIL ?? "test.empleado@heero.dev"
const EMPLEADO_PASSWORD = process.env.TEST_EMPLEADO_PASSWORD ?? "TestHeero2024!"
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "test.admin@heero.dev"
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "TestHeero2024!"

test.describe("Auth — Login y Logout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login")
  })

  test("login con credenciales inválidas muestra error", async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill("invalido@ejemplo.com")
    await page.getByPlaceholder(/contraseña/i).fill("passwordmalo")
    await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()

    // Debe mostrar mensaje de error visible
    await expect(page.locator("[data-testid='auth-error'], .text-red-400, .text-red-500")).toBeVisible({ timeout: 8000 })
  })

  test("login como empleado redirige a /empleado", async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill(EMPLEADO_EMAIL)
    await page.getByPlaceholder(/contraseña/i).fill(EMPLEADO_PASSWORD)
    await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()

    // Esperar redirección a la sección de empleado
    await expect(page).toHaveURL(/\/empleado/, { timeout: 15000 })
  })

  test("login como admin redirige a /admin", async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL)
    await page.getByPlaceholder(/contraseña/i).fill(ADMIN_PASSWORD)
    await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()

    // Esperar redirección a la sección de admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
  })

  test("logout redirige a /auth/login", async ({ page }) => {
    // Primero hacer login como empleado
    await page.getByPlaceholder(/email/i).fill(EMPLEADO_EMAIL)
    await page.getByPlaceholder(/contraseña/i).fill(EMPLEADO_PASSWORD)
    await page.getByRole("button", { name: /ingresar|entrar|login/i }).click()
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

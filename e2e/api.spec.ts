import { test, expect } from "@playwright/test"

// Nota: los tests de API usan dos contextos distintos (empleado y admin).
// Se definen en describes separados con storageState diferente.

test.describe("API routes — Empleado", () => {
  test.use({ storageState: "e2e/.auth/empleado.json" })

  test("POST /api/empleado/encuesta-check → respuesta válida", async ({ page }) => {
    await page.goto("/empleado")
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/empleado/encuesta-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      return { status: res.status }
    })
    expect(response.status).not.toBe(500)
    expect([200, 201, 204, 400, 401, 403]).toContain(response.status)
  })

  test("POST /api/empleado/chat → responde (no 500)", async ({ page }) => {
    await page.goto("/empleado")
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/empleado/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Hola" }] }),
      })
      return { status: res.status }
    })
    expect(response.status).not.toBe(500)
    expect([200, 201, 400, 401, 403]).toContain(response.status)
  })
})

test.describe("API routes — Admin", () => {
  test.use({ storageState: "e2e/.auth/admin.json" })

  test("GET /api/admin/empleados → lista de empleados", async ({ page }) => {
    await page.goto("/admin")
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/admin/empleados")
      const body = await res.json().catch(() => null)
      return {
        status: res.status,
        isArray: Array.isArray(body) || Array.isArray(body?.empleados) || Array.isArray(body?.data),
      }
    })
    expect(response.status).toBe(200)
    expect(response.isArray).toBe(true)
  })
})

# Resultados E2E — Playwright

**Fecha:** 2026-04-12  
**Suite:** 18 tests | **Resultado: 18 ✅ passed / 0 ❌ failed**  
**Duración total:** ~1.8 minutos (1 worker, secuencial)  
**Browser:** Chromium (chromium-1217)

---

## Auth — Login y Logout (4 tests)

| # | Test | Estado | Duración |
|---|------|--------|----------|
| 1 | login con credenciales inválidas muestra error | ✅ | 3.0s |
| 2 | login como empleado redirige a /empleado | ✅ | 5.1s |
| 3 | login como admin redirige a /admin | ✅ | 5.0s |
| 4 | logout redirige a /auth/login | ✅ | 6.4s |

## Empleado — Flujo principal (6 tests)

| # | Test | Estado | Duración |
|---|------|--------|----------|
| 5 | Home: carga módulos con progreso | ✅ | 2.8s |
| 6 | M1 Perfil: datos personales visibles | ✅ | 2.2s |
| 7 | M2 Cultura: bloques de contenido cargan | ✅ | 2.6s |
| 8 | M3 Rol: tareas con checkbox funcionan (toggle) | ✅ | 2.4s |
| 9 | M4 Asistente: puede enviar un mensaje | ✅ | 2.9s |
| 10 | Cambio de tema dark/light aplica en toda la página | ✅ | 2.7s |

## Admin — Flujo principal (5 tests)

| # | Test | Estado | Duración |
|---|------|--------|----------|
| 11 | Dashboard: métricas cargan sin spinner infinito | ✅ | 13.8s |
| 12 | Lista empleados: página carga sin error | ✅ | 5.1s |
| 13 | Detalle empleado: tabs Edición y Progreso funcionan | ✅ | 2.9s |
| 14 | Organigrama: carga el árbol | ✅ | 6.1s |
| 15 | Reportes: vista renderiza | ✅ | 6.1s |

## API routes (3 tests)

| # | Test | Estado | Duración |
|---|------|--------|----------|
| 16 | POST /api/empleado/encuesta-check → respuesta válida | ✅ | 6.5s |
| 17 | POST /api/empleado/chat → responde (no 500) | ✅ | 3.9s |
| 18 | POST /api/admin/empleados con datos inválidos → 4xx (no 500) | ✅ | 3.4s |

---

## Notas de implementación

- **Sesiones vía storageState**: `global-setup.ts` obtiene tokens directamente desde Supabase SDK (bypass del endpoint rate-limitado `/api/auth/login`) y los guarda como cookies SSR + localStorage para que funcionen tanto middleware como client components.
- **Usuarios dedicados por propósito**:
  - `test.empleado@heero.dev` / `test.admin@heero.dev` — exclusivos para `storageState` (no se usan en los tests de formulario).
  - `form.empleado@heero.dev` / `form.admin@heero.dev` — exclusivos para `auth.spec.ts` (tests que hacen login vía formulario), evitando que invaliden las sesiones del storageState.
- **`/api/admin/empleados`**: Solo acepta `POST` (creación). El test verifica que datos inválidos retornan `4xx`, no `500`.
- **Lista empleados en admin**: El usuario de test puede no tener empleados asociados; el test valida que la página renderiza correctamente en cualquier estado.

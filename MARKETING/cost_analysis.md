# Análisis de Costos e Infraestructura — Heero
*Abril 2026 — Bootstrap → Escala*

---

## 1. Infraestructura actual y límites del tier gratuito

| Servicio | Plan actual | Límite crítico | Cuándo se rompe |
|----------|-------------|----------------|-----------------|
| **Vercel** | Hobby (gratis) | ⚠️ USO COMERCIAL PROHIBIDO | **Ya** — ToS prohíbe negocio en Hobby |
| **Supabase** | Free | Se pausa tras 7 días sin actividad, 500MB DB, 2 proyectos | Al primer cliente de pago |
| **Anthropic API** | Pay-per-use | Sin tier gratuito en producción | Ya se paga por uso |
| **Resend** | Free | 3,000 emails/mes, 1 dominio | ~80-100 clientes activos |
| **GitHub** | Free | Sin límite relevante | No aplica |
| **Dominio heero.la** | ~$25/año | N/A | Renovación anual |

### ⚠️ Alerta inmediata
- **Vercel Hobby no puede usarse comercialmente** — necesita upgrade a Pro ($20/mes) ANTES del lanzamiento
- **Supabase Free pausa el proyecto** tras 7 días sin actividad — inaceptable en producción

---

## 2. Costos fijos mínimos para lanzar

| Servicio | Plan | Costo/mes |
|----------|------|-----------|
| Vercel Pro | 1 proyecto, 1TB bandwidth | $20 |
| Supabase Pro | 8GB DB, sin pausa, backups diarios | $25 |
| Resend Free | 3,000 emails/mes | $0 |
| Dominio heero.la | Prorrateado | ~$2 |
| **TOTAL FIJO** | | **$47/mes** |

**Break-even mínimo: 1 cliente en plan Starter ($49/mes) cubre la infra base.**

---

## 3. Costos variables — Anthropic API

El costo más relevante a escala. Por cada empleado en onboarding:

| Evento | Tokens estimados | Costo (Sonnet) |
|--------|-----------------|----------------|
| Sesión de chat con asistente IA | ~5K input + 1K output | $0.030 |
| Sesiones promedio por onboarding (30 días) | ~15 sesiones | $0.45 |
| **Costo IA por empleado onboarding completo** | | **~$0.45** |
| Generación de reporte admin (streaming) | ~3K input + 2K output | $0.039 |

> Con Claude Haiku en lugar de Sonnet: $0.05/empleado (90% más barato, menor calidad)

---

## 4. Proyección de costos por etapa de crecimiento

### Supuestos
- Promedio de 8 empleados activos en onboarding por cliente
- Mix de planes: 60% Growth ($149), 30% Starter ($49), 10% Scale ($299)
- Ingreso promedio por cliente (ARPU): ~$149/mes

| Clientes | Empleados activos | Vercel | Supabase | Anthropic | Resend | **Total costos** | **Revenue** | **Margen** |
|----------|-------------------|--------|----------|-----------|--------|------------------|-------------|------------|
| 1 (prueba) | 5 | $20 | $25 | $2 | $0 | **$47** | $149 | 68% |
| 5 | 40 | $20 | $25 | $18 | $0 | **$63** | $745 | 91.5% |
| 20 | 160 | $20 | $25 | $72 | $0 | **$117** | $2,980 | 96% |
| 50 | 400 | $20 | $25 | $180 | $20 | **$245** | $7,450 | 96.7% |
| 100 | 800 | $40 | $50 | $360 | $20 | **$470** | $14,900 | 96.8% |
| 200 | 1,600 | $40 | $75 | $720 | $20 | **$855** | $29,800 | 97.1% |
| 500 | 4,000 | $100 | $150 | $1,800 | $50 | **$2,100** | $74,500 | 97.2% |

> Vercel escala con bandwidth; Supabase con compute add-ons; Anthropic es el único costo variable significativo.

---

## 5. ¿Cuándo necesito upgradear cada servicio?

### Vercel
| Clientes | Plan necesario | Costo |
|----------|---------------|-------|
| Ahora (lanzamiento) | **Pro** | $20/mes |
| +200 clientes | Pro (sigue alcanzando) | $20/mes |
| +500 clientes | Pro + bandwidth add-ons | ~$40-60/mes |

### Supabase
| Clientes | Plan necesario | Costo |
|----------|---------------|-------|
| Ahora (lanzamiento) | **Pro** | $25/mes |
| +100 clientes | Pro (sigue alcanzando) | $25/mes |
| +200 clientes | Pro + compute add-on | ~$50-75/mes |
| +500 clientes | Pro + múltiples add-ons | ~$150/mes |

### Anthropic
Costo variable puro — escala linealmente con el uso. No hay upgrade de plan, solo se paga más.

### Resend
| Clientes | Plan necesario | Costo |
|----------|---------------|-------|
| 0-80 clientes | Free (3K emails/mes) | $0 |
| +80 clientes | Pro (50K emails/mes) | $20/mes |

---

## 6. ¿La suscripción cubre todo?

**Sí, con margen muy alto.** El modelo es extremadamente eficiente:

| Etapa | Revenue | Costos | Margen bruto |
|-------|---------|--------|--------------|
| 5 clientes | $745/mes | $63/mes | **91.5%** |
| 50 clientes | $7,450/mes | $245/mes | **96.7%** |
| 500 clientes | $74,500/mes | $2,100/mes | **97.2%** |

El margen mejora con la escala porque los costos fijos (Vercel, Supabase) no crecen proporcionalmente.

---

## 7. Acciones inmediatas (antes del lanzamiento)

| Prioridad | Acción | Costo | Urgencia |
|-----------|--------|-------|----------|
| 🔴 CRÍTICO | Upgrade Vercel a Pro | $20/mes | HOY |
| 🔴 CRÍTICO | Upgrade Supabase a Pro | $25/mes | HOY |
| 🟡 MEDIO | Configurar dominio heero.la en Vercel | $25/año | Esta semana |
| 🟡 MEDIO | Configurar hola@heero.la en Resend | $0 | Esta semana |
| 🟢 LUEGO | Resend Pro | $20/mes | Cuando haya 80+ clientes |

**Inversión mínima para lanzar correctamente: $45/mes**
**Recuperado con: 1 cliente en plan Starter**

---

## 8. Riesgo de costos inesperados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Anthropic sube precios | Baja | Medio | Margen >95% absorbe aumentos |
| Uso IA muy superior al estimado | Media | Medio | Rate limiting por plan en la app |
| Supabase storage explota (archivos de conocimiento) | Media | Bajo | Limite por empresa en upload |
| Bot de Teams/GChat genera llamadas masivas | Baja | Bajo | Rate limiting ya implementado |

---

*Documento generado para Heero — heero.la — Abril 2026*

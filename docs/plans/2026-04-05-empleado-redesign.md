# Empleado Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar el rediseño visual de la app empleado según el mockup `onboardai_redesign_mockup.html`, incluyendo paleta navy, sidebar desktop, M1 page header, profile hero gradient y tracker vertical.

**Architecture:** Tres archivos afectados. globals.css actualiza la paleta global a navy. layout.tsx agrega sidebar de 220px (solo desktop, `hidden lg:flex`). perfil/page.tsx reorganiza la UI de M1 con header, hero gradient, tracker vertical stepper y contactos dentro del Row 2.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Framer Motion, Lucide React, DM Sans (ya cargada)

---

### Task 1: globals.css — Paleta navy

**Files:**
- Modify: `src/app/globals.css` (`:root` block y `@theme`)

**Cambios exactos:**

En `:root` reemplazar:
```css
--background: #111110;
--surface: #1a1a18;
--surface-2: #222220;
--sidebar-bg: #1a1a18;
--gradient-bg:
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(14, 165, 233, 0.12) 0%, transparent 65%),
  radial-gradient(ellipse 40% 35% at 85% 85%, rgba(14, 165, 233, 0.05) 0%, transparent 55%),
  radial-gradient(ellipse 30% 25% at 10% 60%, rgba(14, 165, 233, 0.04) 0%, transparent 50%),
  #111110;
```
Por:
```css
--background: #0A1628;
--surface: #0F1F3D;
--surface-2: #162440;
--sidebar-bg: #080F1E;
--gradient-bg:
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59, 79, 216, 0.12) 0%, transparent 65%),
  radial-gradient(ellipse 40% 35% at 85% 85%, rgba(13, 148, 136, 0.06) 0%, transparent 55%),
  radial-gradient(ellipse 30% 25% at 10% 60%, rgba(59, 79, 216, 0.05) 0%, transparent 50%),
  #0A1628;
```

En `@theme` reemplazar heero colors:
```css
--color-heero-950: #070d1a;
--color-heero-900: #0A1628;
--color-heero-800: #0F1F3D;
--color-heero-700: #162440;
--color-heero-600: #1d2d52;
```

También en `@theme`:
```css
--color-surface-950: #070d1a;
--color-surface-900: #0A1628;
--color-surface-800: #0F1F3D;
--color-surface-700: #162440;
--color-surface-600: #1d2d52;
--color-surface-500: #243260;
--color-surface-400: #2c3c72;
```

Actualizar `.theme-light` overrides que referenciaban `#111110`:
- `background: #f8f8f7` → se mantiene
- Las reglas `[class*="bg-[#111110]"]` en theme-light siguen apuntando al hex literal → NO TOCAR (siguen siendo válidas)

**Step 1: Aplicar cambios**

Editar `src/app/globals.css` con los valores de arriba.

**Step 2: Verificar TypeScript**
```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```
Expected: sin errores.

**Step 3: Commit**
```bash
git add src/app/globals.css
git commit -m "feat(design): navy dark theme — #0A1628 background + indigo/teal gradients"
```

---

### Task 2: layout.tsx — Sidebar desktop

**Files:**
- Modify: `src/app/empleado/layout.tsx`

**Cambios:**

Agregar constante de labels antes de `export default`:
```tsx
const MODULO_LABELS: Record<string, string> = {
  M1: 'Perfil',
  M2: 'Rol',
  M3: 'Cultura',
}
```

Cambiar el outer wrapper `<div className="min-h-dvh flex flex-col">` por `<div className="min-h-dvh flex">`.

Envolver el contenido existente (`<header>` + `<main>`) en un div `flex-1 flex flex-col min-w-0`.

Agregar el sidebar como `<aside className="hidden lg:flex ...">` ANTES del nuevo wrapper:

```tsx
{/* ── Sidebar (desktop only) ── */}
<aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-white/[0.06]"
  style={{ background: '#080F1E' }}
>
  {/* Logo */}
  <div className="px-[18px] py-5 border-b border-white/[0.06] flex items-center gap-2.5">
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #3B4FD8, #0D9488)' }}
    >
      H
    </div>
    <span className="text-sm font-semibold text-white/90 tracking-tight">Heero</span>
  </div>

  {/* Nav */}
  <nav className="flex-1 p-3">
    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.08em] px-2 py-2">
      Módulos
    </p>
    {MODULOS.map((mod, idx) => {
      const completado = modulos[mod.key]
      const esActual   = pathname.startsWith(mod.href)
      const bloqueado  = esTrial(planEmpresa) && idx === 2
      if (bloqueado) {
        return (
          <div key={mod.key}
            className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg opacity-40 cursor-not-allowed mb-0.5"
          >
            <div className="w-[7px] h-[7px] rounded-full bg-white/15 flex-shrink-0" />
            <span className="text-[13px] text-white/40 flex-1">
              {mod.key} — {MODULO_LABELS[mod.key]}
            </span>
            <span className="text-[9px] text-amber-500/60 font-semibold">Pro</span>
          </div>
        )
      }
      return (
        <Link key={mod.key} href={mod.href}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors duration-150 text-[13px] mb-0.5 border',
            esActual
              ? 'bg-[#3B4FD8]/15 text-[#818CF8] border-[#3B4FD8]/25'
              : 'text-white/50 hover:text-white/90 hover:bg-white/[0.04] border-transparent'
          )}
        >
          <div className={cn(
            'w-[7px] h-[7px] rounded-full flex-shrink-0',
            completado ? 'bg-[#0D9488]' : esActual ? 'bg-[#818CF8]' : 'bg-white/20'
          )} />
          {mod.key} — {MODULO_LABELS[mod.key]}
        </Link>
      )
    })}
    {/* M4 Asistente */}
    <Link href="/empleado/asistente"
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors duration-150 text-[13px] mb-0.5 border',
        pathname.startsWith('/empleado/asistente')
          ? 'bg-[#3B4FD8]/15 text-[#818CF8] border-[#3B4FD8]/25'
          : 'text-white/50 hover:text-white/90 hover:bg-white/[0.04] border-transparent',
        esTrial(planEmpresa) ? 'opacity-40 pointer-events-none' : ''
      )}
    >
      <div className="w-[7px] h-[7px] rounded-full bg-white/20 flex-shrink-0" />
      <span className="flex-1">M4 — Asistente</span>
      {esTrial(planEmpresa) && (
        <span className="text-[9px] text-amber-500/60 font-semibold">Pro</span>
      )}
    </Link>

    {/* Quick access */}
    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.08em] px-2 pt-4 pb-2 mt-2">
      Accesos rápidos
    </p>
    <Link href="/empleado"
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors border border-transparent"
    >
      <span className="text-sm leading-none">📋</span> Mi progreso
    </Link>
  </nav>

  {/* User info */}
  <div className="px-3.5 py-3.5 border-t border-white/[0.06] flex items-center gap-2.5">
    <div
      className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #3B4FD8, #0D9488)' }}
    >
      {empleadoNombre
        ? empleadoNombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : 'U'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-semibold text-white/90 truncate">
        {empleadoNombre || 'Empleado'}
      </p>
      <p className="text-[11px] text-white/30 truncate">
        {empleadoPuesto || ''}
      </p>
    </div>
  </div>
</aside>
```

La estructura final del return queda:
```tsx
<ThemeProvider section="empleado">
  <div className="min-h-dvh flex">
    {/* sidebar */}
    <aside className="hidden lg:flex ..."> ... </aside>

    {/* main column */}
    <div className="flex-1 flex flex-col min-w-0">
      <header ...> ... </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>

    <AgenteFlotante ... />
  </div>
</ThemeProvider>
```

**Step 1: Aplicar cambios**

**Step 2: Verificar TypeScript**
```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add src/app/empleado/layout.tsx
git commit -m "feat(empleado): desktop sidebar navigation with module progress dots"
```

---

### Task 3: perfil/page.tsx — M1 page header

**Files:**
- Modify: `src/app/empleado/perfil/page.tsx`

Reemplazar el `<motion.h1>Mi perfil</motion.h1>` (el heading actual) con el nuevo page header M1. El header usa la clase `mod-m1-header` (ya definida en globals.css via el task 1 del prompt anterior, pero hay que agregar `.mod-m1-header` si no existe aún).

**Verificar** que en `globals.css` exista `.mod-m1-header`. Si no, agregar junto a `.mod-m2-header`:
```css
.mod-m1-header {
  background: var(--mod-m1-accent-bg);
  border: 1px solid var(--mod-m1-accent-border);
  border-radius: 14px;
  padding: 20px 24px;
}
```

**Reemplazar** el `motion.h1` por:
```tsx
{/* ── Page header M1 ── */}
<div className="mod-m1-header flex items-center justify-between gap-6 mb-6">
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-xl bg-[#3B4FD8]/20 flex items-center justify-center flex-shrink-0">
      <User className="w-5 h-5 text-[#818CF8]" />
    </div>
    <div>
      <p className="tag-m1 mb-1">Módulo 1</p>
      <h1 className="text-xl font-bold text-white leading-tight">Mi perfil</h1>
      <p className="text-sm text-white/45 mt-0.5">
        Tus accesos, credenciales e información de equipo
      </p>
    </div>
  </div>
  {/* Progress ring */}
  <div className="flex-shrink-0 relative w-14 h-14">
    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
      <circle
        cx="26" cy="26" r="22" fill="none"
        stroke="#3B4FD8" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * 22}`}
        strokeDashoffset={2 * Math.PI * 22 * (1 - progresoTotal / 100)}
      />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-xs font-bold text-white">{progresoTotal}%</span>
    </div>
  </div>
</div>
```

Nota: `User` ya está importado. `progresoTotal` ya está calculado.

**Step 1: Agregar `.mod-m1-header` y `.tag-m1` a globals.css si no existen**

Verificar en globals.css — si `.mod-m1-header` no está, agregar antes de `.mod-m2-header`.

**Step 2: Reemplazar motion.h1 en perfil/page.tsx**

**Step 3: Verificar TypeScript**
```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add src/app/globals.css src/app/empleado/perfil/page.tsx
git commit -m "feat(perfil): M1 unified page header with progress ring"
```

---

### Task 4: perfil/page.tsx — Row 2 completo (hero gradient + contactos + tracker stepper)

**Files:**
- Modify: `src/app/empleado/perfil/page.tsx`

Este task reemplaza todo el bloque del Row 2 (actualmente: `{/* Row 2: Hero + Onboarding */}`) y elimina el bloque de Contactos que está DESPUÉS del Row 2 (ya que los contactos se mueven dentro de Row 2).

**Nueva estructura Row 2:**
```tsx
{/* ── Row 2: (Hero + Contactos) | Tracker ── */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

  {/* Columna izquierda: Hero gradient + Contactos */}
  <div className="space-y-4">

    {/* Bloque A: Profile hero — gradient style */}
    <motion.section id="tour-hero-card" variants={blockVariants}>
      {/* Hero card */}
      <div
        className="rounded-xl p-5 flex items-start gap-4"
        style={{
          background: 'linear-gradient(135deg, rgba(59,79,216,0.12) 0%, rgba(13,148,136,0.08) 100%)',
          border: '1px solid rgba(59,79,216,0.2)',
        }}
      >
        <HeroAvatar
          src={perfil.foto_url}
          nombre={perfil.nombre}
          onUpload={handleAvatarUpload}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-white/95 leading-tight truncate">
                {perfil.nombre}
              </h2>
              {(perfil.puesto || perfil.area) && (
                <p className="text-[13px] text-white/50 mt-0.5 truncate">
                  {[perfil.puesto, perfil.area].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {perfil.fecha_ingreso && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/[0.06] flex-shrink-0"
                style={{ background: 'rgba(10,22,40,0.8)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                <span className="text-[10px] text-white/45 whitespace-nowrap">
                  Día {diasDesde(perfil.fecha_ingreso) ?? 1}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {perfil.modalidad && (
              <Badge variant={modalidadVariant(perfil.modalidad)}>
                {modalidadLabel(perfil.modalidad, t)}
              </Badge>
            )}
            <button
              onClick={handleCopyEmail}
              className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/70 transition-colors group"
              title="Copiar email"
            >
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono truncate max-w-[160px]">{perfil.email}</span>
              {emailCopied
                ? <Check className="w-2.5 h-2.5 text-teal-400 flex-shrink-0" />
                : <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Sobre mí — editable inline */}
      <Card className="mt-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
            Sobre mí
          </span>
          <AnimatePresence>
            {savedFeedback && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-teal-400 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> guardado
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {editandoBio ? (
          <textarea
            autoFocus
            value={bio}
            onChange={e => setBio(e.target.value)}
            onBlur={handleBioBlur}
            rows={3}
            placeholder="Contá algo sobre vos..."
            className={cn(
              'w-full text-sm text-white/80 bg-surface-800/60 rounded-lg',
              'border border-white/10 focus:border-[#3B4FD8]/40',
              'p-2.5 resize-none outline-none',
              'placeholder:text-white/25 transition-colors duration-150',
            )}
          />
        ) : (
          <p
            onClick={() => setEditandoBio(true)}
            className={cn(
              'text-sm cursor-text rounded-lg p-2 -ml-2',
              'hover:bg-white/[0.03] transition-colors duration-150',
              bio ? 'text-white/70' : 'text-white/25 italic',
            )}
          >
            {bio || 'Contá algo sobre vos...'}
          </p>
        )}
      </Card>
    </motion.section>

    {/* Bloque D: Contactos clave */}
    <motion.section variants={blockVariants}>
      <Card>
        <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
          Contactos clave
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ContactoCard
            tipo="manager"
            nombre={manager?.nombre}
            email={manager?.email}
            herramienta={herramientaContacto}
          />
          <ContactoCard
            tipo="buddy"
            nombre={buddy?.nombre}
            email={buddy?.email}
            herramienta={herramientaContacto}
          />
          <ContactoCard
            tipo="it"
            nombre={perfil.contacto_it_nombre}
            email={perfil.contacto_it_email}
            herramienta={herramientaContacto}
          />
          <ContactoCard
            tipo="rrhh"
            nombre={perfil.contacto_rrhh_nombre}
            email={perfil.contacto_rrhh_email}
            herramienta={herramientaContacto}
          />
        </div>
      </Card>
    </motion.section>

  </div>{/* /columna izquierda */}

  {/* Columna derecha: Onboarding tracker — vertical stepper */}
  <motion.section id="tour-onboarding-tracker" variants={blockVariants}>
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest">
          Mi onboarding
        </h2>
        <span className="text-xs text-white/40 font-mono tabular-nums">
          {modulosCompletados} / 4 módulos
        </span>
      </div>

      <ProgressBar value={progresoTotal} showPercentage={false} />

      {/* Vertical stepper */}
      <div className="mt-5">
        {MODULO_INFO.map(({ key, label }, idx) => {
          const completado = modulosProgreso[key]
          const activo     = moduloActivo === key
          return (
            <div key={key} className="relative flex items-start gap-3 pb-4">
              {/* Connecting line */}
              {idx < MODULO_INFO.length - 1 && (
                <div className="absolute left-[11px] top-7 w-px h-[calc(100%-4px)] bg-white/[0.08]" />
              )}
              {/* Step dot */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center',
                'text-[11px] font-bold flex-shrink-0 relative z-10 mt-0.5',
                completado
                  ? 'bg-teal-500/20 text-[#2DD4BF] border-[1.5px] border-[#0D9488]'
                  : activo
                  ? 'bg-[#3B4FD8]/20 text-[#818CF8] border-[1.5px] border-[#3B4FD8]'
                  : 'bg-white/[0.04] text-white/25 border-[1.5px] border-white/[0.1]'
              )}>
                {completado ? '✓' : idx + 1}
              </div>
              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-[13px] font-medium leading-tight',
                  completado ? 'text-white/90' : activo ? 'text-[#818CF8]' : 'text-white/30'
                )}>
                  {key} — {label}
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {completado ? 'Completado' : activo ? 'En curso' : 'Bloqueado'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress summary */}
      <div className="border-t border-white/[0.06] pt-3 mt-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-white/35">Progreso total</span>
          <span className="text-[13px] font-bold text-[#818CF8]">{progresoTotal}%</span>
        </div>
        <div className="h-[5px] bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progresoTotal}%`, background: 'linear-gradient(90deg, #3B4FD8, #0D9488)' }}
          />
        </div>
      </div>
    </Card>
  </motion.section>

</div>{/* /Row 2 */}
```

**Después del nuevo Row 2**, eliminar el bloque de Contactos standalone que quedó de la restructura anterior (el `{/* ── Bloque D: Contactos clave ── */}` que está solo).

**Step 1: Reemplazar Row 2 completo y eliminar Contactos standalone**

Buscar `{/* ── Row 2: (Hero + Contactos) | Tracker ── */}` hasta el cierre `</div>{/* /Row 2 */}` y reemplazar con la nueva estructura de arriba.

Luego eliminar el `{/* ── Bloque D: Contactos clave ── */}` que queda debajo.

**Step 2: Verificar TypeScript**
```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add src/app/empleado/perfil/page.tsx
git commit -m "feat(perfil): gradient hero + contactos in Row 2 + vertical stepper tracker"
```

---

### Task 5: Push

```bash
cd C:/Users/Maxi/onboardai && git push origin master
```

---

## Notas de implementación

- `.mod-m1-header` usa `--mod-m1-accent-bg` (indigo) — token ya en globals.css desde el prompt 1
- El `HeroAvatar` se mantiene como componente circular — encaja en el nuevo hero gradient
- El sidebar no tiene estado propio — lee `modulos`, `empleadoNombre`, `empleadoPuesto`, `pathname`, `planEmpresa` que ya existen en el layout component
- Para mobile: el sidebar es `hidden lg:flex` — el topbar sigue manejando la navegación móvil sin cambios
- NO tocar `src/app/admin/layout.tsx` ni `src/app/dev/layout.tsx`

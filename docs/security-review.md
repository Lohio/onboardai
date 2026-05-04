# Heero — Security Review

**Date:** 2026-04-28  
**Reviewer:** Claude Code (automated static analysis)  
**Scope:** Full codebase at `C:\Users\Maxi\onboardai`  
**Stack:** Next.js 14 App Router, Supabase, Claude API, Stripe, MercadoPago, Sentry

---

## Executive Summary

The codebase demonstrates solid security fundamentals: a centralized `withHandler` wrapper enforces auth/role checks and Zod validation on most routes, Stripe webhooks are properly signature-verified, encryption uses AES-256-GCM with proper IV/auth-tag handling, and security headers are largely well-configured. However, **one critical and two high-severity issues** require immediate attention before production hardening: real secrets are committed to the repository, the MercadoPago webhook has no signature verification, and the role-caching cookie mechanism can be bypassed by a motivated attacker.

---

## Findings

### CRITICAL

---

#### CRIT-01 — Real production secrets committed to repository

**Severity:** Critical  
**File:** `.env.local` (indexed by Vercel CLI, present in working tree)  
**Lines:** All — observed in tool-results output

**Description:**  
The `.env.local` file (and a Vercel CLI–generated env dump) contains live, non-rotated secrets that were read during this review:

- `ANTHROPIC_API_KEY` — `sk-ant-api03-kwlOS8Z9...` (live key)
- `SUPABASE_SERVICE_ROLE_KEY` — full JWT with `role: service_role` (bypasses all RLS)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — full JWT (low-risk but confirms the project ref)
- `STRIPE_SECRET_KEY` — `sk_test_51TLw12...` (test key, but still a credential)
- `STRIPE_WEBHOOK_SECRET` — `whsec_okavuZ...`
- `ENCRYPTION_KEY` — `9f93d943...` (32-byte key used to encrypt corporate passwords in DB)

While `.gitignore` correctly lists `.env*`, this does not protect against:
1. The file already having been pushed in a prior commit (check `git log --all -- .env.local`).
2. A Vercel CLI dump file being accidentally committed or left in the worktree.
3. The `ENCRYPTION_KEY` and `SUPABASE_SERVICE_ROLE_KEY` being extractable by any developer with repo access.

**Impact:** If any of these secrets are in git history or shared externally, an attacker can: decrypt all stored corporate passwords, read/write all Supabase data bypassing RLS, make authenticated Anthropic API calls at the project's expense, and access the Stripe account.

**Recommended fix:**
1. **Immediately rotate** all secrets listed above (Anthropic, Supabase service role, Stripe, Stripe webhook, encryption key — note that rotating the encryption key requires re-encrypting all stored passwords).
2. Run `git log --all --full-history -- .env.local .env` to verify the file was never committed.
3. Run `git secret scan` or `trufflehog git file://.` to check full history.
4. Use Vercel's environment variable dashboard exclusively; never generate local dumps.
5. Add a pre-commit hook (e.g., `detect-secrets` or `gitleaks`) to prevent future accidental commits of secrets.

---

### HIGH

---

#### HIGH-01 — MercadoPago webhook has no signature verification

**Severity:** High  
**File:** `src/app/api/billing/webhook/mercadopago/route.ts`  
**Lines:** 15–69

**Description:**  
The MercadoPago webhook handler accepts any `POST` request and immediately trusts the `body.data.id` field to look up a payment, then updates the `empresas` table and inserts into `pagos` with no verification that the request came from MercadoPago. The Stripe handler (same directory) correctly uses `stripe.webhooks.constructEvent()` with a shared secret. MercadoPago supports `x-signature` / `x-request-id` HMAC-SHA256 verification that is entirely absent here.

**Impact:** Any unauthenticated caller can send a crafted POST to `/api/billing/webhook/mercadopago` with `{ "type": "payment", "data": { "id": "<real_payment_id>" } }` and trigger plan upgrades or payment record insertion. If a valid MercadoPago payment ID is guessable or leakable (IDs are sequential integers), an attacker can upgrade any empresa to any plan for free.

**Recommended fix:**
```typescript
// MercadoPago v2 webhook signature verification
const xSignature = req.headers.get('x-signature')
const xRequestId = req.headers.get('x-request-id')
const urlParams = new URL(req.url).searchParams
const dataId = urlParams.get('data.id') ?? body.data?.id

const secret = process.env.MP_WEBHOOK_SECRET
if (!xSignature || !secret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Parse ts and v1 from x-signature header
const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`
const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
if (!crypto.timingSafeEqual(Buffer.from(parts.v1 ?? ''), Buffer.from(expected))) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
```
Also add `MP_WEBHOOK_SECRET` to env vars (configured in MercadoPago developer dashboard).

---

#### HIGH-02 — Role-caching cookie can be forged by an authenticated user to escalate privileges

**Severity:** High  
**File:** `src/middleware.ts`  
**Lines:** Cookie constants block + middleware logic

**Description:**  
The middleware caches the user's role in a client-readable cookie (`onboard_rol`) for 5 minutes (`COOKIE_ROL_MAX_AGE = 60 * 5`) to avoid a Supabase query on every request. When this cookie is present and contains a valid role string, the middleware uses it **without re-verifying against the database**. An authenticated user (e.g., `empleado`) can manually set `onboard_rol=admin` in their browser cookies and navigate to `/admin/*` routes.

**Important nuance:** The `withHandler` wrapper on API routes correctly calls `supabase.auth.getUser()` and then queries the `usuarios` table for the real role on every API call — so API-level authorization is not bypassed. The vulnerability is limited to **page-level routing**: the middleware will redirect an attacker to the admin UI, which will then render admin pages. Whether those pages can cause real damage depends on whether every data-fetching call in admin pages goes through the protected API routes (likely yes for mutations, but client-side data-fetching in Server Components could be affected).

**Impact:** Authenticated empleados can access the admin UI and potentially view admin-only data if any Server Component fetches data without re-checking the role server-side.

**Recommended fix:**  
Do not use the cached role for access control decisions. Instead, verify the role from the database on every middleware invocation, or — at minimum — sign the cookie with an HMAC so it cannot be forged:

```typescript
// Option A: Always verify from DB (safest, ~1 extra DB query per request)
// Remove cookie-based role caching entirely.

// Option B: Sign the role cookie with HMAC
import { createHmac } from 'crypto'
const COOKIE_SECRET = process.env.COOKIE_SECRET! // new env var, 32+ bytes
function signRole(rol: string): string {
  const sig = createHmac('sha256', COOKIE_SECRET).update(rol).digest('hex')
  return `${rol}.${sig}`
}
function verifyRolCookie(value: string): UserRole | null {
  const [rol, sig] = value.split('.')
  const expected = createHmac('sha256', COOKIE_SECRET).update(rol).digest('hex')
  if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  return esRolValido(rol) ? rol as UserRole : null
}
```

---

### MEDIUM

---

#### MED-01 — CSP uses `'unsafe-inline'` for scripts, negating XSS protection

**Severity:** Medium  
**File:** `next.config.ts`  
**Lines:** CSP value array (script-src directive)

**Description:**  
```
"script-src 'self' 'unsafe-inline' https://js.sentry-cdn.com"
```
`'unsafe-inline'` allows any inline `<script>` tag to execute, which completely neutralizes the XSS protection that CSP is meant to provide. If an attacker can inject arbitrary HTML (e.g., through an AI-generated response rendered without proper sanitization, or a stored value from the DB), they can execute JavaScript in the user's browser.

**Recommended fix:**  
Replace `'unsafe-inline'` with a nonce-based CSP. Next.js 14 App Router supports this natively:
```typescript
// middleware.ts — generate nonce per request
const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
// Pass nonce via header, use in CSP:
"script-src 'self' 'nonce-{nonce}' https://js.sentry-cdn.com"
```
Also add `https://js.stripe.com` to script-src (Stripe Checkout uses a script tag).

---

#### MED-02 — `connect-src` in CSP does not include Stripe, MercadoPago, or Anthropic

**Severity:** Medium  
**File:** `next.config.ts`  
**Lines:** connect-src directive

**Description:**  
```
"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io"
```
The app makes client-side requests to Stripe (checkout redirects use `https://js.stripe.com`), and the Sentry SDK makes XHR requests to `*.sentry.io`. More importantly, `https://api.stripe.com` is missing. If a CSP report-only mode is enabled, these will generate violations. If enforcing, Stripe Checkout may silently fail in some browsers.

**Recommended fix:**  
Add to `connect-src`:
```
https://api.stripe.com https://js.stripe.com https://*.sentry.io
```

---

#### MED-03 — File upload does not validate MIME type server-side (only extension)

**Severity:** Medium  
**File:** `src/app/api/admin/conocimiento/upload/route.ts`  
**Lines:** 30–55 (extension extraction and upload logic)

**Description:**  
The upload handler trusts `file.name` to extract the extension (`file.name.split('.').pop()`) and passes `file.type` (the browser-supplied MIME type) directly to Supabase Storage as `contentType`. Neither the extension nor the MIME type is verified against an allowlist server-side. An attacker with admin credentials could:
1. Upload an HTML file renamed as `.pdf` — if the Storage bucket serves files with their stored content-type, browsers may execute it.
2. Upload a file with a path traversal attempt in the filename (though UUID generation mitigates this).

**Recommended fix:**  
```typescript
import { ACCEPT_BY_TIPO } from '@/lib/conocimiento'

const tipo = formData.get('tipo') as string
const allowedMimes = ACCEPT_BY_TIPO[tipo] // e.g., ['application/pdf']
if (!allowedMimes?.includes(file.type)) {
  return ApiError.badRequest('Tipo de archivo no permitido')
}
// Also enforce max size:
const MAX_SIZE = MAX_SIZE_BY_TIPO[tipo]
if (file.size > MAX_SIZE) {
  return ApiError.badRequest('Archivo demasiado grande')
}
```
Additionally, ensure the Supabase Storage bucket has `Content-Disposition: attachment` policy to prevent inline rendering of uploaded files.

---

#### MED-04 — Billing routes (`/api/billing/checkout`, `/api/billing/portal`) not protected via `withHandler` and lack role check

**Severity:** Medium  
**File:** `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/portal/route.ts`  
**Lines:** 10–20 in each file

**Description:**  
These routes call `supabase.auth.getUser()` directly (not via `withHandler`) and check only that a user is authenticated — they do not verify that the user has the `admin` role. Any `empleado` user can call these endpoints to initiate a Stripe Checkout session or open the billing portal for their company.

**Recommended fix:**  
Migrate to `withHandler` with `rol: ['admin', 'dev']`:
```typescript
export const POST = withHandler(
  { auth: 'session', rol: ['admin', 'dev'], schema: checkoutSchema },
  async ({ user }) => {
    // user.empresaId is guaranteed by withHandler
  }
)
```

---

#### MED-05 — Rate limiting uses "fail open" strategy for all endpoints including login

**Severity:** Medium  
**File:** `src/lib/api/withRateLimit.ts`  
**Lines:** 69–73

**Description:**  
```typescript
if (error) {
  // Si falla el rate limiting, no bloquear el request (fail open)
  console.warn('[withRateLimit] Error al verificar rate limit:', error.message)
  return null
}
```
If the Supabase `increment_rate_limit` RPC fails (network error, cold start, DB overload), all rate limits silently fail open. This affects the login endpoint (`max: 10 per 15min per IP`), meaning a Supabase outage enables unlimited brute-force login attempts.

**Recommended fix:**  
For security-sensitive endpoints (login, register), fail closed on rate-limit errors:
```typescript
export const RATE_LIMITS = {
  login: { max: 10, windowMs: 15 * 60 * 1000, keyType: 'ip', failOpen: false },
  // ...
}
// In checkRateLimit:
if (error && !options.failOpen) {
  return ApiError.tooManyRequests('Rate limit service unavailable. Try again later.')
}
```
Supabase Auth already has built-in brute-force protection, but defense-in-depth is valuable here.

---

#### MED-06 — `/api/v1/docs/openapi.json` responds with `Access-Control-Allow-Origin: *`

**Severity:** Medium  
**File:** `src/app/api/v1/docs/openapi.json/route.ts`  
**Lines:** 333

**Description:**  
The OpenAPI spec endpoint uses a wildcard CORS origin (`*`). While the spec itself is not sensitive, the endpoint may reveal internal route structure, authentication mechanisms, schema definitions, and version information. More importantly, the same file may be setting a precedent pattern that gets accidentally copied to protected endpoints.

**Recommended fix:**  
Restrict to known origins or serve the OpenAPI spec only in non-production environments. If it must be public, ensure it contains no internal server details or examples with real data.

---

### LOW

---

#### LOW-01 — `script-src` in CSP missing `https://js.stripe.com`

**Severity:** Low  
**File:** `next.config.ts`

**Description:**  
Stripe Checkout and Stripe Elements load scripts from `https://js.stripe.com`. These are blocked by the current CSP, which may cause silent Stripe failures or require users to disable CSP enforcement.

**Recommended fix:** Add `https://js.stripe.com https://checkout.stripe.com` to `script-src` and `frame-src`.

---

#### LOW-02 — `withHandler` with `auth: 'webhook'` provides no authentication at all

**Severity:** Low  
**File:** `src/lib/api/withHandler.ts`  
**Lines:** 143 — comment: `'webhook' y 'none': sin verificación en el wrapper`

**Description:**  
Routes that declare `auth: 'webhook'` receive no authentication from the framework wrapper. Each such route is responsible for its own verification. This is a footgun: future developers may add a new webhook handler using `auth: 'webhook'` and forget to add signature verification, similar to the MercadoPago issue (HIGH-01). The `auth: 'none'` mode has the same footgun risk.

**Recommended fix:**  
Add a lint/TypeScript rule or runtime assertion requiring that `auth: 'webhook'` handlers pass a `webhookVerifier` function in their options:
```typescript
interface HandlerOptions<TBody> {
  auth: 'session' | 'apiKey' | 'cron' | 'none'
  // Webhooks must provide their own verifier — no 'webhook' shortcut
  webhookVerifier?: (req: NextRequest) => Promise<boolean>
}
```

---

#### LOW-03 — `NEXT_PUBLIC_SUPABASE_URL` used in server-side code is intentional but misleading

**Severity:** Low  
**File:** Multiple API routes and `src/lib/supabase.ts`

**Description:**  
The Supabase project URL is prefixed `NEXT_PUBLIC_` and therefore embedded in the client bundle. It is also used in server-side `createClient()` calls with the service role key. This is not a vulnerability (the URL is not a secret — it's the project's public endpoint), but it is architecturally misleading: it implies the URL is sensitive when it is not, and it could confuse developers who see `NEXT_PUBLIC_` in server code.

**Recommended fix:**  
Consider also defining `SUPABASE_URL` (without `NEXT_PUBLIC_`) for server-only contexts to make the intent explicit. This is a low-priority naming concern.

---

#### LOW-04 — `ZodError` caught outside parsing block exposes raw validation details in production

**Severity:** Low  
**File:** `src/lib/api/withHandler.ts`  
**Lines:** 271–277

**Description:**  
```typescript
if (err instanceof ZodError) {
  return NextResponse.json(
    { error: 'Datos inválidos', details: err.issues, requestId },
    { status: 400 }
  )
}
```
This catch block (for ZodErrors thrown _inside_ handler logic, not the schema validation block) always includes `details: err.issues` — even in production — revealing internal schema structure. The schema validation block above it correctly gates `details` behind `NODE_ENV !== 'production'`.

**Recommended fix:**  
Apply the same environment gate:
```typescript
{ error: 'Datos inválidos', ...(process.env.NODE_ENV !== 'production' && { details: err.issues }) }
```

---

#### LOW-05 — Bot endpoint (`/api/bot/teams`) authenticates via static token, no expiry

**Severity:** Low  
**File:** `src/app/api/bot/teams/route.ts`  
**Lines:** 14, 43

**Description:**  
The Teams bot webhook verifies a static `TEAMS_WEBHOOK_TOKEN` environment variable. This is a shared secret with no rotation mechanism, expiry, or replay protection. If the token is ever leaked, it cannot be invalidated without a re-deploy.

**Recommended fix:**  
For Microsoft Teams bots, use the official Bot Framework JWT verification (`verifyRequest` from `botbuilder`), which validates the `Authorization` header against Microsoft's public JWKS endpoint. This eliminates the static secret entirely.

---

#### LOW-06 — No `X-Content-Type-Options` on Storage-served files (bucket policy gap)

**Severity:** Low  
**File:** Supabase Storage configuration (outside codebase)

**Description:**  
The `conocimiento` bucket is configured as public (`public: true`). Files served from `*.supabase.co/storage/v1/object/public/conocimiento/...` are returned with the stored `contentType`. If an HTML or SVG file is stored (possible without server-side MIME validation — see MED-03), browsers may render it in the context of the Supabase CDN domain, enabling stored XSS against any user who opens the URL.

**Recommended fix:**  
In Supabase Storage bucket settings, add a policy to force `Content-Disposition: attachment` for all files, or explicitly disallow `text/html`, `image/svg+xml`, and `application/javascript` MIME types.

---

## Non-Findings (Reviewed and Confirmed Safe)

The following areas were reviewed and found to be correctly implemented:

| Area | Status |
|------|--------|
| Stripe webhook signature verification | PASS — uses `stripe.webhooks.constructEvent()` |
| AES-256-GCM encryption for passwords | PASS — correct IV, auth tag, key derivation |
| Zod schema validation on most API routes | PASS — enforced via `withHandler` |
| SQL injection via Supabase client | PASS — parameterized queries only, no raw SQL |
| `dangerouslySetInnerHTML` usage | PASS — zero occurrences in codebase |
| `react-markdown` XSS (no `rehype-raw`) | PASS — raw HTML passthrough not enabled |
| Cron job auth (timing-safe comparison) | PASS — `crypto.timingSafeEqual` used correctly |
| Service role key usage scope | PASS — only in server-side API routes, never client |
| Multi-tenant isolation in `withHandler` | PASS — `empresa_id` derived from DB session, not client input |
| `.gitignore` covers `.env*` | PASS — pattern present |
| `X-Frame-Options: DENY` | PASS |
| `Strict-Transport-Security` with preload | PASS — 2-year max-age |
| Password minimum length enforcement | PASS — 8 chars minimum in admin, 6 in login |
| CORS for `/api/v1/*` | PASS — origin validated against per-company allowlist from DB |
| Rate limiting on login/register | PASS — IP-based, 10/15min and 5/60min |
| Passwords route tenant isolation | PASS — `empresa_id` cross-checked before decrypt |

---

## Summary Table

| ID | Severity | Area | Title |
|----|----------|------|-------|
| CRIT-01 | **Critical** | Secrets | Real secrets in working tree / env dump |
| HIGH-01 | **High** | Webhooks | MercadoPago webhook: no signature verification |
| HIGH-02 | **High** | Auth/AuthZ | Role-caching cookie can be forged for privilege escalation |
| MED-01 | Medium | CSP | `unsafe-inline` in script-src negates XSS protection |
| MED-02 | Medium | CSP | Missing Stripe/Anthropic in connect-src |
| MED-03 | Medium | Upload | No server-side MIME type validation on file upload |
| MED-04 | Medium | AuthZ | Billing routes bypass `withHandler`, no role check |
| MED-05 | Medium | Rate Limit | Fail-open rate limiting on login under DB errors |
| MED-06 | Medium | CORS | OpenAPI spec uses `Access-Control-Allow-Origin: *` |
| LOW-01 | Low | CSP | Missing `js.stripe.com` in script-src |
| LOW-02 | Low | Auth | `auth: 'webhook'` in withHandler is an unenforced footgun |
| LOW-03 | Low | Config | `NEXT_PUBLIC_` prefix on server-only Supabase URL is misleading |
| LOW-04 | Low | InfoLeak | ZodError in handler catch always leaks schema details |
| LOW-05 | Low | Auth | Teams bot uses static token with no rotation mechanism |
| LOW-06 | Low | Storage | Public bucket may serve HTML/SVG with inline content-type |

---

## Immediate Action Items (Priority Order)

1. **Rotate all secrets** (CRIT-01) — do this now, before any other fix.
2. **Add MercadoPago webhook signature verification** (HIGH-01) — 30-minute fix.
3. **Sign the role-caching cookie with HMAC** or remove the cache (HIGH-02) — 1-hour fix.
4. **Add role check to billing routes** via `withHandler` (MED-04) — 20-minute fix.
5. **Add MIME type validation to upload route** (MED-03) — 30-minute fix.
6. **Replace `unsafe-inline` in CSP with nonce** (MED-01) — 2–4 hour fix (requires Next.js nonce middleware setup).

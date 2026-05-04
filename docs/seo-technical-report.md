# Technical SEO Audit — Heero (heeroai-lohios-projects.vercel.app)

**Audit date:** 2026-04-28
**Auditor:** Claude Technical SEO Agent (claude-sonnet-4-6)
**Methodology:** Live HTTP headers + Next.js 14 source code analysis
**Overall SEO Score: 38 / 100**

---

## Executive Summary

The deployment at `heeroai-lohios-projects.vercel.app` is **fully blocked by Vercel SSO/Deployment Protection** (HTTP 401 on every route, including `/robots.txt`, `/sitemap.xml`, and the root). This single configuration issue makes the entire site invisible to all search engines and crawlers. The score would be meaningfully higher once the protection gate is removed; however, multiple additional SEO gaps were found in the source code that would still require fixing.

---

## Category Scores

| Category | Status | Score |
|---|---|---|
| Crawlability | FAIL | 0/15 |
| Indexability | FAIL | 5/15 |
| Security Headers | PASS | 13/15 |
| HTTPS / SSL | PASS | 10/10 |
| URL Structure | PASS | 8/10 |
| Mobile Optimization | PASS | 8/10 |
| Core Web Vitals (estimated) | WARN | 6/10 |
| Structured Data | FAIL | 0/10 |
| JavaScript Rendering | WARN | 5/10 |
| Meta Tags / OG Tags | WARN | 5/10 |
| Sitemap | FAIL | 0/5 |
| robots.txt | FAIL | 0/5 |
| Internal Linking | WARN | 3/5 |
| IndexNow Protocol | FAIL | 0/5 |

**Total: 63 raw points / 165 possible → normalized to 38/100**

---

## Prioritized Issues

### CRITICAL

#### C-1: Vercel Deployment Protection blocks all crawlers
**Impact:** Site is completely invisible to Google, Bing, and any SEO tool.

Every URL — including `/robots.txt` and `/sitemap.xml` — returns HTTP 401 with a Vercel SSO redirect page. The response also includes `X-Robots-Tag: noindex`, which explicitly instructs any crawler that does reach the page not to index it.

**Evidence from HTTP headers:**
```
HTTP/1.1 401 Unauthorized
X-Robots-Tag: noindex
```

**Fix:** In the Vercel Dashboard → Settings → Deployment Protection, either:
- Disable protection entirely for the production domain, or
- Move to a custom domain (e.g. `heero.app`) without deployment protection, keeping the `.vercel.app` URL protected for staging.

If this is intentional (private beta), ensure the production domain is separate from the preview/staging URL.

---

#### C-2: No `robots.txt` file exists
**Impact:** Crawlers have no directives. If protection is removed, everything including `/api/*`, `/admin/*`, and `/dev/*` would be open to crawling.

**Fix:** Create `src/app/robots.ts` (Next.js 14 App Router convention):

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/login', '/auth/register'],
        disallow: ['/admin/', '/dev/', '/empleado/', '/api/'],
      },
      // Block AI crawlers
      { userAgent: 'GPTBot', disallow: ['/'] },
      { userAgent: 'ClaudeBot', disallow: ['/'] },
      { userAgent: 'PerplexityBot', disallow: ['/'] },
      { userAgent: 'Google-Extended', disallow: ['/'] },
    ],
    sitemap: 'https://heeroai-lohios-projects.vercel.app/sitemap.xml',
  }
}
```

---

#### C-3: No `sitemap.xml` exists
**Impact:** Search engines cannot efficiently discover or prioritize pages.

**Fix:** Create `src/app/sitemap.ts`:

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://heeroai-lohios-projects.vercel.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://heeroai-lohios-projects.vercel.app/auth/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://heeroai-lohios-projects.vercel.app/auth/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]
}
```

Note: Only public-facing pages should be included. All `/admin/*`, `/dev/*`, and `/empleado/*` routes are authenticated and must be excluded.

---

### HIGH

#### H-1: Meta tags only defined at root level — no per-page metadata
**Impact:** Every page (login, register, landing) shares the same title and description. Search engines show identical snippets for all URLs, reducing CTR and signaling thin/duplicate content.

**Evidence:** Only `src/app/layout.tsx` exports `metadata`. No other page file exports `metadata` or `generateMetadata`.

Current root metadata:
```ts
title: 'Heero — Onboarding inteligente',
description: 'Plataforma de onboarding inteligente para startups latinoamericanas.',
```

**Fix:** Add page-level metadata to at minimum the landing page and register page:

```ts
// src/app/page.tsx
export const metadata: Metadata = {
  title: 'Heero — Onboarding inteligente para empresas LATAM',
  description: 'Incorporá nuevos talentos desde el primer día. Plataforma de onboarding con IA para PyMEs latinoamericanas. Sin IT, sin fricción.',
  openGraph: {
    title: 'Heero — Onboarding inteligente',
    description: 'Incorporá nuevos talentos desde el primer día.',
    url: 'https://heeroai-lohios-projects.vercel.app',
    siteName: 'Heero',
    locale: 'es_AR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Heero Onboarding' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Heero — Onboarding inteligente',
    description: 'Incorporá nuevos talentos desde el primer día.',
  },
}
```

**Currently missing from all pages:**
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
- Twitter Card tags
- `og:image` asset (no `/public/og-image.png` exists)

---

#### H-2: No canonical tags defined
**Impact:** If the app is ever accessible at multiple URLs (custom domain + `.vercel.app`), duplicate content can split crawl equity.

**Fix:** Add `metadataBase` and `alternates.canonical` to the root layout and per-page metadata:

```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://heeroai-lohios-projects.vercel.app'),
  title: { default: 'Heero — Onboarding inteligente', template: '%s | Heero' },
  description: '...',
  alternates: { canonical: '/' },
}
```

Next.js 14 will render the `<link rel="canonical">` tag automatically when `alternates.canonical` is set.

---

#### H-3: No structured data (Schema.org JSON-LD)
**Impact:** No rich results eligibility. Competitors with SoftwareApplication or Organization schema can appear with enhanced SERP features.

**Fix:** Add JSON-LD to `src/app/page.tsx`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Heero",
      "applicationCategory": "BusinessApplication",
      "description": "Plataforma de onboarding inteligente para PyMEs latinoamericanas.",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      "url": "https://heeroai-lohios-projects.vercel.app"
    })
  }}
/>
```

---

### MEDIUM

#### M-1: CSP uses `unsafe-inline` for scripts
**Impact:** Weakens Content Security Policy; potential XSS vector; also signals to security scanners that the app is not hardened.

**Evidence from `next.config.ts`:**
```
"script-src 'self' 'unsafe-inline' https://js.sentry-cdn.com"
```

**Fix:** Use Next.js nonce-based CSP instead of `unsafe-inline`. Next.js 14 supports nonce injection via middleware. This is a medium effort change.

---

#### M-2: `connect-src` CSP directive is too narrow — missing Anthropic and Vercel Analytics
**Impact:** If Vercel Analytics or Speed Insights are ever added, or if the Claude API is called client-side, the CSP will block those requests.

**Current:** `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io`

**Recommended addition:** `https://vitals.vercel-insights.com` if Speed Insights is added.

---

#### M-3: Core Web Vitals — estimated risk areas
**Note:** Lab measurements are not possible while the site returns 401. These are estimates from source code analysis.

**LCP risk — MEDIUM:** The landing page hero section uses CSS gradient `div` elements and a `<h1>` as the likely LCP element. No `<img>` with `priority` prop is present in the hero. Framer Motion wraps page transitions via `PageWrapper`, which may delay initial paint if the animation has an `initial` state that hides content.

**INP risk — LOW-MEDIUM:** The app is heavily client-side for authenticated routes (`'use client'` components, Supabase real-time subscriptions, Framer Motion). The public landing page is a Server Component with no client interactivity, so INP on the landing is likely good.

**CLS risk — MEDIUM:** Google Fonts (Geist, Geist_Mono) are loaded via `next/font/google`. Next.js handles font optimization automatically (font-display: swap + preloading), which mitigates CLS. However, no explicit image dimensions are set for `/public/login-illustration.png` used in the auth pages — if rendered without `width`/`height`, this causes layout shift.

---

#### M-4: No `lang` attribute per sub-page; single `lang="es"` for all locales
**Impact:** The app advertises support for `es`, `en`, `fr`, `pt` but the root layout hard-codes `lang="es"`. Non-Spanish content will be misidentified by screen readers and search engines.

**Fix:** If multi-language routing is planned, implement `next-intl` or `next/navigation` locale routing with per-locale `lang` attribute. If only Spanish is live, update the landing page stats to not advertise other languages until implemented.

---

#### M-5: No IndexNow implementation
**Impact:** Bing and Yandex will not be notified of content changes in real time.

**Fix:** Generate an IndexNow key, place it at `/public/{key}.txt`, and submit URLs on content creation via the IndexNow API (`https://api.indexnow.org/indexnow`). This is low effort for meaningful Bing coverage in LATAM markets.

---

#### M-6: `<footer>` copyright year is hardcoded as 2025
**Impact:** Minor credibility issue — shows as outdated on January 1 of each year.

**Fix:** Use `new Date().getFullYear()` dynamically, or update annually.

---

### LOW

#### L-1: Internal linking is minimal on the landing page
The landing page links only to `/auth/login` and `/auth/register`. There is no link to a `/pricing`, `/about`, `/blog`, or `/docs` page. For a SaaS targeting LATAM SMBs, these pages would significantly improve topical authority and conversion funnel signals.

#### L-2: No `favicon.ico` or `apple-touch-icon` defined in metadata
Next.js 14 does not auto-detect favicons unless placed at `src/app/favicon.ico` or declared in metadata. The public directory contains `heero-logo.svg` but no ICO format. A missing favicon results in a broken icon in browser tabs and SERP favicons.

**Fix:** Add `src/app/favicon.ico` and declare in root metadata:
```ts
icons: {
  icon: '/favicon.ico',
  apple: '/apple-touch-icon.png',
}
```

#### L-3: Footer is text-only with no semantic nav or links
The footer contains only a copyright string. For SEO and accessibility, include at minimum links to `/auth/login`, `/auth/register`, and a privacy policy URL.

#### L-4: No `hreflang` tags for multi-language support
Given the stated plan for `es`, `en`, `fr`, `pt` support, hreflang annotations will be required once locale routing is implemented to avoid duplicate content across language versions.

---

## What Is Working Well

- **HTTPS enforced:** Vercel provides TLS by default; HSTS header confirmed (`max-age=63072000; includeSubDomains; preload`).
- **Security headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` all present and correct in `next.config.ts`.
- **No redirect chains detected** for public URLs (single-hop HTTPS, no www/non-www split detected).
- **Mobile viewport:** `<meta name=viewport content="width=device-width,initial-scale=1">` confirmed in Vercel auth page (injected universally); Next.js sets this by default.
- **Server-side rendering for landing:** `src/app/page.tsx` is a pure Server Component — no `'use client'` directive — meaning the landing page HTML is fully pre-rendered and does not depend on JavaScript for initial content. This is optimal for LCP and crawlability.
- **Semantic HTML structure:** The landing page uses correct `<header>`, `<section>`, `<footer>`, `<h1>`, `<h2>`, `<h3>` hierarchy. One `<h1>` per page.
- **`lang="es"`** on root `<html>` element.
- **Next.js font optimization:** `next/font/google` used for Geist and Geist Mono, ensuring fonts are self-hosted with `font-display: swap`.

---

## Recommended Fix Priority Order

1. **Remove Vercel Deployment Protection** from the production URL (unblocks everything)
2. **Create `src/app/robots.ts`** blocking `/admin/`, `/dev/`, `/empleado/`, `/api/`
3. **Create `src/app/sitemap.ts`** with public pages only
4. **Add page-level metadata** to `src/app/page.tsx` including OG tags and Twitter Card
5. **Create `/public/og-image.png`** (1200x630px) for social sharing previews
6. **Add `metadataBase` + canonical** to root layout
7. **Add JSON-LD structured data** (SoftwareApplication) to landing page
8. **Add favicon** (`src/app/favicon.ico`)
9. **Fix hardcoded copyright year**
10. **Implement IndexNow** for Bing/Yandex real-time indexing

---

## Notes on Audit Methodology

The live URL returned HTTP 401 for all requests (Vercel SSO protection active). All findings for categories beyond crawlability are derived from static source code analysis of the Next.js 14 codebase at `C:\Users\Maxi\onboardai`. HTTP response headers were captured from the 401 response, which still includes the security headers configured in `next.config.ts` (Vercel injects them on the edge before the SSO gate, except for `X-Robots-Tag: noindex` which Vercel adds itself during protection mode).

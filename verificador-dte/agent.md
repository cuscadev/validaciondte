# Guía del agente — Kaiser DTE (`verificador-dte`)

Documento operativo para asistentes de IA y desarrolladores. Para dominio de producto, flujos y APIs, ver [`spec.md`](spec.md).

## Identidad

- **Producto:** Kaiser DTE — verificación y gestión de documentos tributarios electrónicos (DTE) en El Salvador.
- **Repositorio:** `verificador-dte` (Next.js, privado).
- **Usuarios:** contadores, empresas, equipos de auditoría tributaria.
- **Producción:** `https://verificadordtev2.cuscadev.com` (ver `app/layout.tsx` metadata).

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Estilos | Tailwind CSS v4, shadcn/ui (`components.json`, estilo `new-york`) |
| Auth / datos | Firebase Auth, Firestore (`lib/firebase.ts`, `lib/firebase-admin.ts`) |
| Verificación DTE | Playwright + `@sparticuz/chromium` en serverless |
| Estado cliente | TanStack React Query (`components/QueryProvider`) |
| i18n | i18next / react-i18next (`lib/i18n.ts`) |
| Exportaciones | `xlsx-js-style`, Vercel Blob (opcional), `@react-pdf/renderer` |
| Despliegue | Vercel |

## Estructura del repositorio

```
app/                 # Páginas App Router y Route Handlers (app/api/*)
  (public)/          # Landing, login, SEO, precios
  (protected)/       # Layout autenticado
  verificadorDTE/    # Módulos de verificación DTE
  extraer/           # Extracción desde JSON
  admin/             # Panel administración
  api/               # REST / Route Handlers
components/          # UI compartida (components/ui/* = shadcn)
hooks/               # Hooks React (p. ej. usePlanAccess)
lib/                 # Lógica de negocio, Firebase, DTE, PDF, mail
types/               # Tipos TypeScript compartidos
middleware.ts        # JWT Firebase en cookie __session
```

## Convenciones de código

- **Imports:** alias `@/` (`@/components`, `@/lib`, `@/hooks`).
- **Cliente:** `'use client'` en páginas/componentes con estado, Firebase client o hooks.
- **APIs:** Route Handlers en `app/api/**/route.ts` o `route.js`. Existen rutas legacy en `.js` (p. ej. `verificarcodyfecha`) — no migrar a TypeScript sin solicitud explícita.
- **DTE:** lógica compartida en [`lib/dteCommon.js`](lib/dteCommon.js):
  - `launchBrowser`, `consultarDte`, `procesarFilasConPool`
  - Parsers: `parseCSV_codFecha`, `parseXLSX_codFecha`
  - Excel: `buildWorkbook`
  - URLs Hacienda: `ADMIN`, `WEBAPP`
- **Idioma UI:** español (El Salvador). Mensajes de error claros para usuarios finales.
- **Fechas:** aceptar `dd/mm/yyyy`, `dd-MM-yyyy` y `yyyy-MM-dd` donde aplique.
- **Alcance:** cambios mínimos y focalizados; sin refactors colaterales ni archivos markdown no pedidos.

## Autenticación y autorización

1. **Middleware** ([`middleware.ts`](middleware.ts)): valida cookie `__session` (JWT Firebase vía JWKS). Redirige a `/login` si falta o es inválida.
2. **Rutas públicas** ([`lib/publicRoutes.ts`](lib/publicRoutes.ts)): landing, auth, páginas SEO. Las APIs (`/api/*`) se excluyen del middleware y validan por su cuenta.
3. **Cliente:** [`components/AuthProvider.tsx`](components/AuthProvider.tsx) sincroniza Firebase user + documento Firestore `users/{uid}`.
4. **Servidor:** [`lib/verifyAuth.ts`](lib/verifyAuth.ts), [`lib/server-auth.ts`](lib/server-auth.ts) en APIs protegidas.
5. **Roles globales** (`lib/firestoreUser.ts`): `superadmin` | `cliente` | `colaborador`. Helpers: `isOrgAdmin`, `canManageOrgUsers`, `isAccountUsable`.
6. **Organizaciones** (`organizations/{orgId}`, `lib/organization-admin.ts`, `lib/organization-types.ts`): dominio de correo único, KYC en `kyc`, cupos `maxCollaborators` / `collaboratorCount`. Colaboradores: `orgRole` `administrador` | `miembro`.
7. **Onboarding:** cliente sin `kyc.kycCompleted` → redirect `/onboarding` desde [`components/ProtectedAppShell.tsx`](components/ProtectedAppShell.tsx). API: `POST /api/organization/onboarding`.
8. **Gestión usuarios org:** `/usuarios` + `GET|POST /api/organization/users`. Superadmin: `/admin/users`.
9. **Membresía:** `free` | `premium` | `pro` — rutas, `queryLimit` y `maxCollaborators` en `config/plans`.
10. **MFA:** TOTP (`app/api/totp/*`, páginas `mfa-login`, `totp-verify`).
11. **Desktop / móvil:** APIs bajo `app/api/desktop/*` con JWT (`JWT_SECRET`).
12. **Session control:** `POST /api/users/session-control` — superadmin global; admin org solo colaboradores de su `organizationId`.

## Skills locales (`.agents/skills/`)

La carpeta `.agents/` está en `.gitignore` (solo local). Antes de implementar en un dominio cubierto, **leer el `SKILL.md`** correspondiente.

| Skill | Cuándo usarla |
|-------|----------------|
| `next-best-practices` | App Router, RSC, route handlers, metadata, errores |
| `next-cache-components` | Cache Components, PPR, `use cache` |
| `next-upgrade` | Actualizar versión de Next.js |
| `react-best-practices` | Rendimiento React, hooks, bundle |
| `composition-patterns` | Componentes compuestos, evitar boolean props |
| `shadcn` | Componentes UI, registries, theming |
| `tailwind-v4-shadcn` | Tailwind v4 + variables CSS + dark mode |
| `tailwind-css-patterns` | Utilidades Tailwind, layout responsive |
| `playwright-best-practices` | E2E, scraping, tests de APIs con browser |
| `accessibility` | WCAG, a11y, teclado, lectores de pantalla |
| `frontend-design` | Diseño UI distintivo, landing, dashboards |
| `seo` | Meta tags, structured data, sitemap |
| `nodejs-backend-patterns` | APIs Express/Fastify-style en Route Handlers |
| `nodejs-best-practices` | Node async, seguridad, arquitectura |
| `typescript-advanced-types` | Tipos complejos, genéricos |
| `threejs-*` | Escenas 3D (si se toca Three.js en el proyecto) |

Ruta: `.agents/skills/<nombre>/SKILL.md`

## Tipografía (Google Fonts vía `.env`)

- Variable: `NEXT_PUBLIC_GOOGLE_FONTS_URL` — URL completa del CSS de Google Fonts (css2).
- Parser: [`lib/fonts/app-font.ts`](lib/fonts/app-font.ts) extrae la familia del parámetro `family=` y define `--app-font-family` en el `<html>`.
- Layout: [`app/layout.tsx`](app/layout.tsx) inyecta `<link rel="stylesheet">` cuando la URL es válida (`https://fonts.googleapis.com`).
- Tailwind: `--font-sans` en [`app/globals.css`](app/globals.css); clase `font-sans` en `<body>`.
- CSP: `next.config.ts` debe permitir `fonts.googleapis.com` (styles) y `fonts.gstatic.com` (fuentes).
- Plantilla: [`.env.example`](.env.example). Sin variable → stack del sistema.

## Animaciones UI

- Usar [`components/motion/FadeIn.tsx`](components/motion/FadeIn.tsx) en lugar de importar `framer-motion` directamente en páginas.
- Props: `inView`, `delay`, `y`, `as="article"`, overrides vía `initial` / `whileInView` para ejes distintos (p. ej. `x`).

## Desarrollo local — troubleshooting

| Síntoma | Acción |
|---------|--------|
| `Can't resolve 'framer-motion'` | `Remove-Item -Recurse node_modules, .next`; `pnpm install` en `verificador-dte` |
| `Found multiple lockfiles` | Usar solo `pnpm` dentro de `verificador-dte`; no mezclar con `package-lock.json` |
| SWC Win32 inválido | Reinstalar deps; Next usará WASM si falla el binario nativo |
| Fuentes no cargan | Revisar CSP y que `NEXT_PUBLIC_GOOGLE_FONTS_URL` use `fonts.googleapis.com` |

## Comandos

```bash
pnpm dev       # Servidor desarrollo (localhost:3000)
pnpm build     # Build producción (+ postbuild: next-sitemap)
pnpm start     # Servidor producción
pnpm lint      # ESLint (ignoreDuringBuilds en next.config)
```

## Archivos sensibles — no commitear

- `.env*`
- `*-firebase-adminsdk-*.json`, `serviceAccount*.json`
- `token.json`
- Credenciales SMTP o claves reales en código

## Documentación relacionada

- [`spec.md`](spec.md) — visión, flujos DTE, rutas, APIs, variables de entorno.
- [`.cursor/rules/project-context.mdc`](.cursor/rules/project-context.mdc) — resumen siempre activo en Cursor.

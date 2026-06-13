# Go DTE API

Microservicio Fiber para procesar/verificar DTEs. Mantiene una estructura parecida a NestJS con modulo padre y modulos por tipo de procesamiento:

- `cmd/api/main.go`: bootstrap.
- `internal/app/app.module.go`: modulo principal.
- `internal/modules/dte/dte.module.go`: modulo padre DTE.
- `internal/modules/dte/procesar_archivos`: modulo para multipart/enlaces.
- `internal/modules/dte/procesar_json`: modulo para requests JSON.
- `internal/modules/dte/shared`: utilidades compartidas del dominio DTE.

Cada modulo de procesamiento tiene su propio:

- `dto/`
- `*.controller.go`
- `*.service.go`
- `*.module.go`

## Endpoints

- `GET /health`
- `POST /api/dte/process-files`
- `POST /api/dte/process-items`
- Aliases compatibles con Next.js:
  - `POST /api/procesar`
  - `POST /api/procesaedte`

## Desarrollo

Copia `.env.example` a `.env` y configura al menos:

- `SUPABASE_DB_URL` — conexion Postgres (Session pooler IPv4 de Supabase)
- `GO_DTE_INTERNAL_API_KEY` — misma clave que `GO_DTE_INTERNAL_API_KEY` en verificador-dte

```bash
go mod tidy
go run ./cmd/api
```

Al arrancar, `cmd/api/main.go` carga automaticamente `go-dte-api/.env`.

Por defecto escucha en `0.0.0.0:8081`. El host lo fija el servidor; solo puedes cambiar el puerto con la variable estándar `PORT`:

```bash
PORT=8081 go run ./cmd/api
```

En plataformas cloud (Railway, Render, Fly, etc.) la plataforma inyecta `PORT` automáticamente.

Para ajustar velocidad/concurrencia del scraping:

```bash
GO_DTE_CONCURRENCY=8 go run ./cmd/api
```

El valor por defecto es `8`, pensado para acercarse a unas 2 consultas por segundo cuando Hacienda responde en 3-4 segundos. Si Hacienda empieza a responder lento o bloquea, baja a `4` o `2`.

En Next.js, configura la URL pública con la que el frontend llama a esta API (distinto del bind interno):

```bash
# Local
GO_DTE_API_URL=http://127.0.0.1:8081

# Render (producción)
GO_DTE_API_URL=https://validaciondte.onrender.com
```

Si no defines `GO_DTE_API_URL`, Next.js usa `http://127.0.0.1:8081` en desarrollo y `https://validaciondte.onrender.com` en producción (ver `verificador-dte/lib/go-dte-api.ts`).

## Documentos de correo (Postgres / Supabase)

Con `SUPABASE_DB_URL` configurada se habilitan:

- `GET/POST /api/email-documents` — documentos JSON importados desde Gmail/IMAP
- `GET /api/email-documents/:id/raw` — JSON crudo almacenado en Postgres

Esquema SQL: [`db/email-import-schema.sql`](db/email-import-schema.sql)

## Espejo de usuarios Firebase (Postgres / Supabase)

Perfiles de Firestore sincronizados a `app_users` (Firebase Auth sigue siendo el login).

Esquema SQL: [`db/app-users-schema.sql`](db/app-users-schema.sql)

Endpoints internos (header `X-Go-Dte-Internal-Key`):

- `PUT /api/app-users/:id` — upsert de un usuario
- `POST /api/app-users/bulk` — backfill masivo
- `GET /api/app-users/:id` — consulta
- `DELETE /api/app-users/:id` — eliminación

Backfill inicial desde verificador-dte:

```bash
cd verificador-dte
npx tsx scripts/sync-users-to-postgres.ts
```

Tras el backfill, verificar huérfanos y activar la FK comentada al final de `app-users-schema.sql`.


Por defecto la API consulta Hacienda con **HTTP puro**, usando el mismo endpoint REST que el portal Angular:

```text
GET https://admin.factura.gob.sv/{prod|test}/consultas/publica/simple/1
    ?codigoGeneracion=...&fechaEmi=...&ambiente=...
```

No hace falta instalar Chrome/Chromium en Render ni en local.

La consulta usa **race HTTP** entre `admin.factura.gob.sv` y `webapp.dtes.mh.gob.sv` (gana la respuesta válida más rápida).

Variables de rendimiento:

```bash
GO_DTE_CONCURRENCY=8
GO_DTE_RATE_LIMIT_PER_SEC=10   # max consultas a Hacienda por segundo (default 10)
GO_DTE_ENRICH_NC=false          # notas de crédito relacionadas (off por defecto)
GO_DTE_ASYNC_THRESHOLD=10       # lotes >10 ítems pueden ir async con Redis
GO_DTE_REDIS_ENABLED=true
REDIS_URL=rediss://...          # Upstash u otro Redis
GO_DTE_REDIS_TTL=600
```

Worker dedicado (Render background service):

```bash
go run ./cmd/worker
```

Métricas: `GET /metrics` (cache hits/misses, latencia media, fuente admin/webapp).

Jobs async: `GET /api/dte/jobs/:id`

Si necesitas el scraper legacy con navegador headless (chromedp/rod), actívalo explícitamente:

```bash
GO_DTE_USE_BROWSER=true go run ./cmd/api
```

Opcional con navegador: `GO_DTE_USE_ROD=true`, `GO_DTE_HTTP_FAST_PATH=true`, `GO_DTE_CHROME_PATH=/usr/bin/chromium`.

## Chromium / Chrome (solo si GO_DTE_USE_BROWSER=true)

La verificación de enlaces DTE usa un navegador headless (chromedp). En Linux el binario debe existir en el servidor; si no, verás:

```text
exec: "google-chrome": executable file not found in $PATH
```

Resolución automática de ruta (en orden):

1. `GO_DTE_CHROME_PATH` o `CHROME_PATH`
2. Rutas Linux: `/usr/bin/chromium`, `/usr/bin/chromium-browser`, etc.

**Render / Docker:** despliega con el `Dockerfile` incluido (instala Chromium). En el dashboard de Render:

- Runtime: **Docker**
- Root directory: `go-dte-api`
- Dockerfile path: `./Dockerfile`

O usa `render.yaml` en ese directorio. Variable recomendada:

```bash
GO_DTE_CHROME_PATH=/usr/bin/chromium
```

**Desarrollo local (Windows):** con Chrome/Edge instalado no hace falta configurar nada. Para probar sin la API de Render:

```bash
GO_DTE_API_URL=http://127.0.0.1:8081
PORT=8081 go run ./cmd/api
```

Variables de Hacienda usadas por Next.js y Go:

```bash
HACIENDA_ENV=test
HACIENDA_AUTH_URL_TEST=https://apitest.dtes.mh.gob.sv/seguridad/auth
HACIENDA_AUTH_URL_PROD=https://api.dtes.mh.gob.sv/seguridad/auth
HACIENDA_CONSULTA_DTE_LOTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadtelote
HACIENDA_CONSULTA_DTE_LOTE_URL_PROD=https://api.dtes.mh.gob.sv/fesv/recepcion/consultadtelote
HACIENDA_USER_AGENT=KaiserDTE
HACIENDA_CREDENTIALS_ENCRYPTION_KEY=valor-largo-y-secreto
```

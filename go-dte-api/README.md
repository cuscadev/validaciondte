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

```bash
go mod tidy
go run ./cmd/api
```

Por defecto escucha en `127.0.0.1:8081`. Puedes cambiarlo con:

```bash
GO_DTE_API_HOST=127.0.0.1 GO_DTE_API_PORT=8081 go run ./cmd/api
```

Para ajustar velocidad/concurrencia del scraping:

```bash
GO_DTE_CONCURRENCY=8 go run ./cmd/api
```

El valor por defecto es `8`, pensado para acercarse a unas 2 consultas por segundo cuando Hacienda responde en 3-4 segundos. Si Hacienda empieza a responder lento o bloquea, baja a `4` o `2`.

En Next.js, configura si necesitas otro host:

```bash
GO_DTE_API_URL=http://127.0.0.1:8081
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

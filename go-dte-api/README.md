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
- `POST /api/facturacion/documents/factura-consumidor-final`
- `POST /api/facturacion/documents/credito-fiscal`
- `POST /api/facturacion/documents/nota-credito`
- `POST /api/facturacion/documents/nota-debito`
- `POST /api/facturacion/documents/sujeto-excluido`
- `POST /api/facturacion/documents/preview`
- `POST /api/facturacion/receptors/build`
- `POST /api/facturacion/items/build`
- `GET /api/facturacion/catalogs/documents`
- `GET /api/facturacion/catalogs/documents/:tipoDte`
- `POST /api/facturacion/deliveries/package`
- `POST /api/facturacion/deliveries/download/json`
- `POST /api/facturacion/reports/export/:format`
- `POST /api/facturacion/queries/dte`
- `GET /api/facturacion/queries/dte/:codigoGeneracion`
- `POST /api/facturacion/queries/dte/batch`
- `GET /api/facturacion/queries/lote/:codigoLote`
- `POST /api/facturacion/queries/lote`
- `POST /api/facturacion/sign`
- `POST /api/facturacion/firmardocumento`
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
HACIENDA_CERTIFICATE_HOME=C:\ruta\a\certificados
HACIENDA_AUTH_URL_TEST=https://apitest.dtes.mh.gob.sv/seguridad/auth
HACIENDA_AUTH_URL_PROD=https://api.dtes.mh.gob.sv/seguridad/auth
HACIENDA_RECEPCION_DTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepciondte
HACIENDA_RECEPCION_DTE_URL_PROD=https://api.dtes.mh.gob.sv/fesv/recepciondte
HACIENDA_CONSULTA_DTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadte
HACIENDA_CONSULTA_DTE_URL_PROD=https://api.dtes.mh.gob.sv/fesv/recepcion/consultadte
HACIENDA_CONSULTA_DTE_LOTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadtelote
HACIENDA_CONSULTA_DTE_LOTE_URL_PROD=https://api.dtes.mh.gob.sv/fesv/recepcion/consultadtelote
HACIENDA_USER_AGENT=KaiserDTE
HACIENDA_CREDENTIALS_ENCRYPTION_KEY=valor-largo-y-secreto
```

## Firmador nativo Go

La primera version del modulo de facturacion firma DTEs con certificados locales `.crt` compatibles con el firmador oficial de Hacienda.

El servicio busca certificados con nombre `{NIT}.crt` en:

1. `HACIENDA_CERTIFICATE_HOME` o `CERTIFICATE_HOME`
2. `uploads/` dentro del directorio actual del proceso

Ejemplo:

```bash
curl -X POST http://127.0.0.1:8081/api/facturacion/sign \
  -H "Content-Type: application/json" \
  -d '{
    "nit": "06141812151015",
    "passwordPri": "clave_privada",
    "dteJson": {
      "identificacion": {
        "tipoDte": "01"
      }
    }
  }'
```

Respuesta:

```json
{
  "success": true,
  "firma": "eyJhbGciOiJSUzUxMiJ9..."
}
```

Tambien existe `POST /api/facturacion/firmardocumento` como endpoint de compatibilidad con el firmador Java.

Para pruebas locales el firmador busca certificados en `HACIENDA_CERTIFICATE_HOME`, `uploads/`, `ejemplodecertificado/` y en las carpetas de certificados incluidas en `Documentacion de hacienda`.

## Generacion de factura consumidor final

El modulo de facturacion puede generar el JSON base de una Factura Electronica `01` version `2`, lista para firmar con el firmador nativo.

```bash
curl -X POST http://127.0.0.1:8081/api/facturacion/documents/factura-consumidor-final \
  -H "Content-Type: application/json" \
  -d '{
    "ambiente": "00",
    "correlativo": 1,
    "establecimientoTipo": "M",
    "establecimiento": "001",
    "puntoVenta": "001",
    "emisor": {
      "nit": "06141812151015",
      "nrc": "1234567",
      "nombre": "MI EMPRESA S.A. DE C.V.",
      "codActividad": "62010",
      "descActividad": "Actividades de programacion informatica",
      "nombreComercial": "MI EMPRESA",
      "direccion": {
        "departamento": "06",
        "municipio": "14",
        "distrito": "01",
        "complemento": "San Salvador"
      },
      "telefono": "22222222",
      "correo": "facturacion@empresa.com",
      "codEstable": "0001",
      "codPuntoVenta": "1"
    },
    "receptor": {
      "nombre": "CONSUMIDOR FINAL",
      "correo": "cliente@example.com"
    },
    "items": [
      {
        "codigo": "SERV-001",
        "descripcion": "Servicio de ejemplo",
        "cantidad": 1,
        "uniMedida": 59,
        "precioUni": 11.30
      }
    ]
  }'
```

La respuesta incluye:

```json
{
  "success": true,
  "tipoDte": "01",
  "codigoGeneracion": "...",
  "numeroControl": "DTE-01-M001P001-000000000000001",
  "totalPagar": 11.3
}
```

La respuesta real tambien incluye `dteJson` con el documento completo generado para Hacienda, no un objeto vacio.

## Generacion de comprobante de credito fiscal

El modulo tambien puede generar el JSON base de un Comprobante de Credito Fiscal `03` version `4`.

```bash
curl -X POST http://127.0.0.1:8081/api/facturacion/documents/credito-fiscal \
  -H "Content-Type: application/json" \
  -d '{
    "ambiente": "00",
    "correlativo": 2,
    "establecimientoTipo": "M",
    "establecimiento": "001",
    "puntoVenta": "001",
    "emisor": {
      "nit": "06141812151015",
      "nrc": "1234567",
      "nombre": "MI EMPRESA S.A. DE C.V.",
      "codActividad": "62010",
      "descActividad": "Actividades de programacion informatica",
      "nombreComercial": "MI EMPRESA",
      "direccion": {
        "departamento": "06",
        "municipio": "14",
        "distrito": "01",
        "complemento": "San Salvador"
      },
      "telefono": "22222222",
      "correo": "facturacion@empresa.com",
      "codEstable": "0001",
      "codPuntoVenta": "1"
    },
    "receptor": {
      "nit": "06140000000000",
      "nrc": "7654321",
      "nombre": "CLIENTE S.A. DE C.V.",
      "codActividad": "62010",
      "descActividad": "Actividades de programacion informatica",
      "direccion": {
        "departamento": "06",
        "municipio": "14",
        "distrito": "01",
        "complemento": "San Salvador"
      },
      "telefono": "22223333",
      "correo": "cliente@example.com"
    },
    "items": [
      {
        "codigo": "SERV-001",
        "descripcion": "Servicio de ejemplo",
        "cantidad": 1,
        "uniMedida": 59,
        "precioUni": 100
      }
    ]
  }'
```

La respuesta incluye `dteJson` listo para pasar por validacion de schema y firma.

## Preview del JSON final del DTE

Endpoint:

```text
POST /api/facturacion/documents/preview
```

Este endpoint arma el DTE completo y devuelve como quedara el JSON final antes de validarlo, firmarlo o transmitirlo. Es la respuesta pensada para mostrar al cliente.

Ejemplo para CCF `03`:

```json
{
  "tipoDte": "03",
  "creditoFiscal": {
    "ambiente": "00",
    "correlativo": 2,
    "establecimientoTipo": "M",
    "establecimiento": "001",
    "puntoVenta": "001",
    "emisor": {},
    "receptor": {},
    "items": []
  }
}
```

Respuesta: devuelve metadatos (`tipoDte`, `version`, `codigoGeneracion`, `numeroControl`, totales y reglas del catalogo) mas `dteJson` completo con la estructura oficial del documento. No devuelve un template con objetos vacios.

Payload esperado por `tipoDte`:

```text
01 -> facturaConsumidorFinal
03 -> creditoFiscal
05 -> nota
06 -> nota
14 -> sujetoExcluido
```

## Paquete final firmado y recibido

Endpoint:

```text
POST /api/facturacion/deliveries/package
POST /api/facturacion/deliveries/download/json
```

Despues de firmar el DTE y recibir respuesta de Hacienda, este modulo arma el JSON final para el cliente con:

```text
dteJson
firma
selloRecepcion
haciendaResponse
links de descarga
```

Ejemplo:

```json
{
  "tipoDte": "03",
  "codigoGeneracion": "...",
  "numeroControl": "DTE-03-M001P001-000000000000002",
  "dteJson": {
    "identificacion": {
      "version": 3,
      "ambiente": "00",
      "tipoDte": "03",
      "numeroControl": "DTE-03-M001P001-000000000000002",
      "codigoGeneracion": "..."
    },
    "emisor": {
      "nit": "06141812151015"
    },
    "receptor": {
      "nit": "06141812151015"
    },
    "cuerpoDocumento": [
      {
        "numItem": 1
      }
    ],
    "resumen": {
      "totalPagar": 100
    }
  },
  "firma": "eyJhbGciOiJSUzUxMiJ9...",
  "selloRecepcion": "ABC123...",
  "haciendaResponse": {
    "estado": "PROCESADO",
    "selloRecibido": "ABC123..."
  }
}
```

`dteJson` debe ser el JSON completo generado por `/api/facturacion/documents/preview` o por el endpoint del tipo de documento. En el ejemplo se recortan campos por lectura, pero al cliente se le entrega el documento completo.

`/download/json` usa el mismo payload, pero responde como archivo descargable `.json`.

## Consultas con Hacienda

Modulo nuevo dentro de facturacion para no tocar el modulo historico `hacienda`.

Endpoints:

```text
POST /api/facturacion/queries/dte
GET /api/facturacion/queries/dte/:codigoGeneracion?nitEmisor=...&tipoDte=03&environment=test
POST /api/facturacion/queries/dte/batch
GET /api/facturacion/queries/lote/:codigoLote?environment=test
POST /api/facturacion/queries/lote
```

Todos usan el token de Hacienda en `Authorization`.

Consulta individual:

```json
{
  "environment": "test",
  "ambiente": "00",
  "codigoGeneracion": "00000000-0000-0000-0000-000000000000",
  "nitEmisor": "06141812151015",
  "tipoDte": "03"
}
```

Si Hacienda requiere una forma exacta distinta, puedes mandar el cuerpo crudo en `payload` y el modulo lo reenvia sin transformarlo:

```json
{
  "environment": "test",
  "payload": {
    "ambiente": "00",
    "codGen": "00000000-0000-0000-0000-000000000000",
    "nitEmisor": "06141812151015",
    "tdte": "03"
  }
}
```

Consulta por lote:

```json
{
  "environment": "test",
  "codigoLote": "ABC123..."
}
```

## Reportes y exportaciones

Endpoint:

```text
POST /api/facturacion/reports/export/csv
POST /api/facturacion/reports/export/xlsx
POST /api/facturacion/reports/export/pdf
```

Por ahora recibe filas ya normalizadas. Luego este mismo modulo puede leer desde Supabase por usuario, organizacion, fechas y tipo de DTE.

```json
{
  "title": "reporte-dte-junio",
  "rows": [
    {
      "fecha": "2026-06-07",
      "tipoDte": "03",
      "numeroControl": "DTE-03-M001P001-000000000000002",
      "codigoGeneracion": "...",
      "receptor": "CLIENTE S.A. DE C.V.",
      "selloRecepcion": "ABC123...",
      "estado": "PROCESADO",
      "total": 100
    }
  ]
}
```

Formatos soportados:

```text
csv
xlsx / excel
pdf
```

## Generacion de notas de credito y debito

Endpoints:

```text
POST /api/facturacion/documents/nota-credito
POST /api/facturacion/documents/nota-debito
```

Ambos usan el mismo payload base. `documentoRelacionado` es obligatorio y cada item toma `numeroDocumento` del primer documento relacionado si no se especifica en el item.

```bash
curl -X POST http://127.0.0.1:8081/api/facturacion/documents/nota-credito \
  -H "Content-Type: application/json" \
  -d '{
    "ambiente": "00",
    "correlativo": 3,
    "establecimientoTipo": "M",
    "establecimiento": "001",
    "puntoVenta": "001",
    "documentoRelacionado": [
      {
        "tipoDocumento": "03",
        "tipoGeneracion": 2,
        "numeroDocumento": "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
        "fechaEmision": "2026-06-07"
      }
    ],
    "emisor": {
      "nit": "06141812151015",
      "nrc": "1234567",
      "nombre": "MI EMPRESA S.A. DE C.V.",
      "codActividad": "62010",
      "descActividad": "Actividades de programacion informatica",
      "nombreComercial": "MI EMPRESA",
      "direccion": {
        "departamento": "06",
        "municipio": "14",
        "distrito": "01",
        "complemento": "San Salvador"
      },
      "telefono": "22222222",
      "correo": "facturacion@empresa.com",
      "codEstable": "0001",
      "codPuntoVenta": "1"
    },
    "receptor": {
      "tipoDocumento": "36",
      "numDocumento": "06140000000000",
      "nrc": "7654321",
      "nombre": "CLIENTE S.A. DE C.V.",
      "codActividad": "62010",
      "descActividad": "Actividades de programacion informatica",
      "direccion": {
        "departamento": "06",
        "municipio": "14",
        "distrito": "01",
        "complemento": "San Salvador"
      },
      "telefono": "22223333",
      "correo": "cliente@example.com"
    },
    "items": [
      {
        "codigo": "AJUSTE-001",
        "descripcion": "Ajuste sobre comprobante relacionado",
        "cantidad": 1,
        "uniMedida": 59,
        "precioUni": 100
      }
    ]
  }'
```

Para nota de debito se usa el mismo cuerpo contra `/api/facturacion/documents/nota-debito`.

## Generacion de factura de sujeto excluido

Endpoint:

```text
POST /api/facturacion/documents/sujeto-excluido
```

Genera el JSON base de una Factura de Sujeto Excluido `14` version `2`.

```bash
curl -X POST http://127.0.0.1:8081/api/facturacion/documents/sujeto-excluido \
  -H "Content-Type: application/json" \
  -d '{
    "ambiente": "00",
    "correlativo": 4,
    "establecimientoTipo": "M",
    "establecimiento": "001",
    "puntoVenta": "001",
    "emisor": {
      "nit": "06141812151015",
      "nrc": "1234567",
      "nombre": "MI EMPRESA S.A. DE C.V.",
      "codActividad": "62010",
      "descActividad": "Actividades de programacion informatica",
      "direccion": {
        "departamento": "06",
        "municipio": "14",
        "distrito": "01",
        "complemento": "San Salvador"
      },
      "telefono": "22222222",
      "correo": "facturacion@empresa.com",
      "codEstable": "0001",
      "codPuntoVenta": "1"
    },
    "receptor": {
      "tipoDocumento": "13",
      "numDocumento": "00000000-0",
      "nombre": "PERSONA SUJETO EXCLUIDO",
      "direccion": {
        "departamento": "06",
        "municipio": "14",
        "distrito": "01",
        "complemento": "San Salvador"
      },
      "telefono": "22223333",
      "correo": "sujeto@example.com"
    },
    "items": [
      {
        "codigo": "COMP-001",
        "descripcion": "Compra a sujeto excluido",
        "cantidad": 1,
        "uniMedida": 59,
        "precioUni": 100
      }
    ],
    "reteRenta": 10
  }'
```

La respuesta incluye `dteJson` listo para validacion de schema y firma.

## Constructor de receptor por tipo DTE

Endpoint:

```text
POST /api/facturacion/receptors/build
```

Construye el objeto `receptor` con la forma correcta para cada tipo de documento soportado:

```text
01 Factura consumidor final
03 Credito fiscal
05 Nota de credito
06 Nota de debito
14 Sujeto excluido
```

Ejemplo para CCF `03`:

```bash
curl -X POST http://127.0.0.1:8081/api/facturacion/receptors/build \
  -H "Content-Type: application/json" \
  -d '{
    "tipoDte": "03",
    "nit": "06140000000000",
    "nrc": "7654321",
    "nombre": "CLIENTE S.A. DE C.V.",
    "codActividad": "62010",
    "descActividad": "Actividades de programacion informatica",
    "nombreComercial": "CLIENTE",
    "direccion": {
      "departamento": "06",
      "municipio": "14",
      "distrito": "01",
      "complemento": "San Salvador"
    },
    "telefono": "22223333",
    "correo": "cliente@example.com"
  }'
```

Respuesta:

```json
{
  "success": true,
  "tipoDte": "03",
  "receptor": {
    "nit": "06140000000000",
    "nrc": "7654321",
    "nombre": "CLIENTE S.A. DE C.V."
  }
}
```

Para notas `05`/`06`, el endpoint devuelve receptor con `tipoDocumento` y `numDocumento`. Para sujeto excluido `14`, devuelve la forma especial de receptor usada por ese schema. Si falta `tipoDocumento`, intenta inferir `13` para DUI y `36` para NIT.

El modulo `receptors` consulta el catalogo interno de documentos para saber que tipo de receptor necesita cada `tipoDte`.

## Constructor de items por tipo DTE

Endpoint:

```text
POST /api/facturacion/items/build
```

Construye `cuerpoDocumento` con la forma correcta para cada tipo soportado. Reutiliza las mismas reglas de calculo que los generadores de documentos.

El modulo `items` consulta el catalogo interno de documentos para saber que tipo de items necesita cada `tipoDte`.

Ejemplo para factura `01` o CCF `03`:

```bash
curl -X POST http://127.0.0.1:8081/api/facturacion/items/build \
  -H "Content-Type: application/json" \
  -d '{
    "tipoDte": "03",
    "items": [
      {
        "codigo": "SERV-001",
        "descripcion": "Servicio de ejemplo",
        "cantidad": 2,
        "uniMedida": 59,
        "precioUni": 50
      }
    ]
  }'
```

Para notas `05`/`06`, enviar tambien `documentoRelacionado` para completar `numeroDocumento` en cada item:

```json
{
  "tipoDte": "05",
  "documentoRelacionado": [
    {
      "tipoDocumento": "03",
      "tipoGeneracion": 2,
      "numeroDocumento": "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
      "fechaEmision": "2026-06-07"
    }
  ],
  "items": []
}
```

Para sujeto excluido `14`, usar `sujetoExcluidoItems`:

```json
{
  "tipoDte": "14",
  "sujetoExcluidoItems": [
    {
      "codigo": "COMP-001",
      "descripcion": "Compra a sujeto excluido",
      "cantidad": 1,
      "uniMedida": 59,
      "precioUni": 100
    }
  ]
}
```

## Catalogo interno de documentos

Endpoints:

```text
GET /api/facturacion/catalogs/documents
GET /api/facturacion/catalogs/documents/:tipoDte
```

Este catalogo define por tipo de DTE:

```text
version
nombre
tipo de receptor requerido
tipo de items requerido
si requiere documentos relacionados
version del schema oficial
```

Los modulos `documents`, `receptors` e `items` consultan este catalogo para evitar repetir reglas estructurales por todos lados.

# Plan de Facturacion Electronica en Go

Este documento define una ruta para construir el modulo de facturacion electronica de forma escalable, bien estructurada y mantenible en Go, usando una arquitectura parecida a NestJS dentro de `go-dte-api`.

La meta principal es reemplazar dependencias Java del firmador oficial por un firmador nativo en Go, integrar validacion con schemas oficiales de Hacienda, transmitir DTEs y guardar certificados de forma segura usando Supabase.

## Decision Principal

Usar Supabase Postgres para produccion y dejar Postgres en Docker solo como opcion de desarrollo local.

Motivos:

- Supabase ya ofrece Postgres administrado, backups, roles, politicas RLS y acceso controlado.
- Evita mantener infraestructura propia para una parte sensible del sistema.
- Permite crecer hacia multiusuario, organizaciones, auditoria y almacenamiento seguro.
- Los certificados son archivos pequenos y criticos; conviene guardarlos cifrados en columnas de Postgres, no como archivos publicos.

Flujo recomendado para certificados:

```text
Usuario sube certificado .crt/.xml
        |
Backend Go recibe archivo + passwordPri
        |
Go valida estructura del certificado
        |
Go cifra el XML completo antes de guardar
        |
Supabase guarda solo XML cifrado + metadata segura
        |
Para firmar:
  Go lee el XML cifrado
  Go descifra en memoria
  Go valida passwordPri
  Go firma el DTE
  Go descarta datos sensibles
```

Nunca se debe guardar:

- XML plano del certificado.
- `passwordPri`.
- Llave privada descifrada.

Si alguien obtiene acceso a Supabase, no deberia poder leer certificados sin la llave maestra del backend.

## Arquitectura Go Tipo NestJS

El proyecto actual `go-dte-api` ya tiene una estructura modular parecida a NestJS. La facturacion debe agregarse como un modulo nuevo, sin romper los modulos actuales de consulta/procesamiento DTE.

Estructura propuesta:

```text
go-dte-api/
  cmd/
    api/
      main.go
    worker/
      main.go

  internal/
    app/
      app.module.go

    common/
      config/
        config.go
      crypto/
        aes_gcm.go
      errors/
        errors.go
      http/
        response.go

    modules/
      dte/
        ...

      hacienda/
        ...

      facturacion/
        facturacion.module.go

        signer/
          signer.module.go
          signer.controller.go
          signer.service.go
          dto/
            sign_request.go
            sign_response.go
          domain/
            certificate.go
            key.go
          repositories/
            certificate_repository.go

        certificates/
          certificates.module.go
          certificates.controller.go
          certificates.service.go
          dto/
            upload_certificate_request.go
          repositories/
            certificate_repository.go

        schema/
          schema.module.go
          schema.service.go
          schema.validator.go
          schemas/
            v1/
            v2/
            v3/
            v4/

        catalogs/
          catalogs.module.go
          catalogs.service.go
          data/
            ambientes.json
            tipos_dte.json
            tributos.json
            departamentos.json
            municipios.json

        documents/
          documents.module.go
          documents.service.go
          domain/
            identificacion.go
            emisor.go
            receptor.go
            resumen.go
            item.go

        transmission/
          transmission.module.go
          transmission.controller.go
          transmission.service.go
          hacienda_client.go
          dto/
            transmit_request.go
            transmit_response.go

        auth/
          hacienda_auth.module.go
          hacienda_auth.service.go
          hacienda_auth.client.go

        invalidation/
          invalidation.module.go

        contingency/
          contingency.module.go
```

Cada modulo debe tener:

- `*.module.go`: registra rutas/dependencias del modulo.
- `*.controller.go`: recibe HTTP y valida request basica.
- `*.service.go`: contiene logica de negocio.
- `dto/`: estructuras de entrada/salida.
- `domain/`: modelos puros del dominio.
- `repositories/`: acceso a base de datos.

## Modulos Principales

### 1. Modulo `certificates`

Responsable de recibir, validar, cifrar y guardar certificados.

Endpoints sugeridos:

```text
POST /api/facturacion/certificates/upload
GET  /api/facturacion/certificates
GET  /api/facturacion/certificates/active
POST /api/facturacion/certificates/:id/activate
DELETE /api/facturacion/certificates/:id
```

Responsabilidades:

- Recibir `.crt` o `.xml`.
- Validar que sea XML compatible con el firmador de Hacienda.
- Extraer metadata no sensible: NIT, activo, fechas si existen.
- Cifrar el XML completo con AES-256-GCM.
- Guardar el XML cifrado en Supabase.
- No guardar `passwordPri`.

### 2. Modulo `signer`

Responsable del firmador nativo Go.

Endpoint compatible con el firmador oficial:

```text
POST /api/facturacion/firmardocumento
```

Endpoint limpio interno:

```text
POST /api/facturacion/sign
```

Request:

```json
{
  "nit": "06142806231012",
  "passwordPri": "clave_privada",
  "dteJson": {}
}
```

Flujo:

```text
Validar NIT
Buscar certificado activo por NIT/usuario/organizacion
Descifrar XML en memoria
Validar SHA-512(passwordPri) contra privateKey.clave
Leer privateKey.encodied
Parsear RSA private key PKCS#8
Firmar JSON como JWS compacto con RS512
Retornar firma
```

Dependencia recomendada para JWS:

```bash
go get github.com/go-jose/go-jose/v4
```

### 3. Modulo `schema`

Responsable de validar DTEs contra los JSON Schemas oficiales.

Fuente:

```text
Documentacion de hacienda/svfe-json-schemas (3)/svfe-json-schemas
```

Endpoints:

```text
POST /api/facturacion/schema/validate
POST /api/facturacion/schema/validate/:tipoDte
```

Dependencia recomendada:

```bash
go get github.com/santhosh-tekuri/jsonschema/v6
```

Tipos prioritarios:

```text
01 Factura
03 Comprobante de Credito Fiscal
05 Nota de Credito
06 Nota de Debito
11 Factura de Exportacion
14 Sujeto Excluido
```

### 4. Modulo `auth`

Responsable de autenticarse con Hacienda.

Endpoints:

```text
POST /api/facturacion/hacienda/auth
POST /api/facturacion/hacienda/session
```

Variables:

```text
HACIENDA_ENV=test
HACIENDA_AUTH_URL_TEST=https://apitest.dtes.mh.gob.sv/seguridad/auth
HACIENDA_AUTH_URL_PROD=https://api.dtes.mh.gob.sv/seguridad/auth
HACIENDA_USER_AGENT=KaiserDTE
```

El token puede guardarse cifrado en Supabase o cachearse temporalmente en Redis, pero nunca debe quedar plano en base de datos.

### 5. Modulo `transmission`

Responsable de enviar DTEs firmados a Hacienda.

Endpoints:

```text
POST /api/facturacion/transmit
POST /api/facturacion/transmit-signed
GET  /api/facturacion/transmissions/:id
```

Flujo completo:

```text
Recibir DTE JSON
Validar schema
Firmar JWS
Autenticar con Hacienda
Transmitir DTE firmado
Guardar respuesta de Hacienda
Retornar resultado al frontend
```

Variables:

```text
HACIENDA_RECEPCION_DTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepciondte
HACIENDA_RECEPCION_DTE_URL_PROD=https://api.dtes.mh.gob.sv/fesv/recepciondte
```

### 6. Modulos `invalidation` y `contingency`

Despues de tener firma/transmision funcionando, implementar:

```text
POST /api/facturacion/invalidation
POST /api/facturacion/contingency
```

Estos deben usar los schemas:

```text
invalidacion-schema-v3.json
contingencia-schema-v4.json
```

## Base De Datos En Supabase

Tabla sugerida para certificados:

```sql
create table hacienda_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid,
  nit text not null,
  environment text not null default 'test',
  certificate_encrypted text not null,
  certificate_hash text not null,
  is_active boolean not null default true,
  uploaded_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index hacienda_certificates_user_id_idx
  on hacienda_certificates(user_id);

create index hacienda_certificates_organization_id_idx
  on hacienda_certificates(organization_id);

create index hacienda_certificates_nit_environment_idx
  on hacienda_certificates(nit, environment);
```

Tabla sugerida para documentos emitidos:

```sql
create table dte_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid,
  nit text not null,
  environment text not null default 'test',
  tipo_dte text not null,
  codigo_generacion text not null,
  numero_control text,
  dte_json jsonb not null,
  jws text,
  status text not null default 'draft',
  hacienda_response jsonb,
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  transmitted_at timestamptz
);

create unique index dte_documents_codigo_generacion_idx
  on dte_documents(codigo_generacion);
```

Tabla sugerida para transmisiones:

```sql
create table dte_transmissions (
  id uuid primary key default gen_random_uuid(),
  dte_document_id uuid not null references dte_documents(id),
  request_payload jsonb,
  response_payload jsonb,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
```

Tabla sugerida para correlativos:

```sql
create table dte_control_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  nit text not null,
  tipo_dte text not null,
  establecimiento text not null,
  punto_emision text not null,
  current_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id, nit, tipo_dte, establecimiento, punto_emision)
);
```

## Cifrado De Certificados

Usar AES-256-GCM desde Go.

Variable:

```text
HACIENDA_CERTIFICATES_ENCRYPTION_KEY=clave-larga-secreta
```

La llave debe vivir en variables de entorno o en un secret manager, no en Supabase.

Formato recomendado del valor cifrado:

```text
base64(iv + tag + ciphertext)
```

El modulo comun puede vivir en:

```text
internal/common/crypto/aes_gcm.go
```

Funciones:

```go
func EncryptSecret(plain []byte, key string) (string, error)
func DecryptSecret(payload string, key string) ([]byte, error)
```

## Variables De Entorno

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

HACIENDA_ENV=test
HACIENDA_USER_AGENT=KaiserDTE

HACIENDA_AUTH_URL_TEST=https://apitest.dtes.mh.gob.sv/seguridad/auth
HACIENDA_AUTH_URL_PROD=https://api.dtes.mh.gob.sv/seguridad/auth

HACIENDA_RECEPCION_DTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepciondte
HACIENDA_RECEPCION_DTE_URL_PROD=https://api.dtes.mh.gob.sv/fesv/recepciondte

HACIENDA_CONSULTA_DTE_LOTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadtelote
HACIENDA_CONSULTA_DTE_LOTE_URL_PROD=https://api.dtes.mh.gob.sv/fesv/recepcion/consultadtelote

HACIENDA_CERTIFICATES_ENCRYPTION_KEY=
```

## Orden De Implementacion

### Fase 1: Preparar arquitectura

- Crear rama `desarrollo-facturacion`.
- Crear modulo `internal/modules/facturacion`.
- Registrar `facturacion.module.go` en `internal/app/app.module.go`.
- Agregar configuracion nueva en `internal/common/config/config.go`.

### Fase 2: Certificados seguros

- Crear tabla `hacienda_certificates`.
- Implementar AES-256-GCM en Go.
- Implementar subida de certificado.
- Guardar XML cifrado.
- Listar certificado activo por usuario/organizacion/NIT.

### Fase 3: Firmador nativo Go

- Parsear XML `.crt`.
- Validar `passwordPri` con SHA-512.
- Parsear llave privada RSA PKCS#8.
- Firmar JWS compacto con `RS512`.
- Crear endpoint compatible con `/firmardocumento`.

### Fase 4: Validacion con schemas

- Copiar schemas oficiales al modulo `schema`.
- Cargar schemas por `tipoDte` y version.
- Validar DTE antes de firmar.

### Fase 5: Auth y transmision

- Implementar auth contra Hacienda.
- Implementar envio de DTE firmado.
- Guardar respuestas en `dte_documents` y `dte_transmissions`.

### Fase 6: Generacion de DTE

- Implementar generador de Factura `01`.
- Implementar CCF `03`.
- Implementar NC `05`, ND `06`, FEX `11`, FSE `14`.

### Fase 7: Eventos

- Implementar invalidacion.
- Implementar contingencia.
- Implementar auditoria y reintentos.

## Pruebas Necesarias

Prioridad alta:

- SHA-512 compatible con Java.
- Descifrado/cifrado AES-GCM.
- Parseo XML del certificado.
- Validacion de `privateKey.clave`.
- Parseo RSA PKCS#8.
- Firma JWS `RS512`.
- Validacion JSON Schema.
- Transmision a ambiente test de Hacienda.

Archivos sugeridos:

```text
internal/common/crypto/aes_gcm_test.go
internal/modules/facturacion/signer/signer.service_test.go
internal/modules/facturacion/signer/certificate_test.go
internal/modules/facturacion/schema/schema.validator_test.go
internal/modules/facturacion/transmission/transmission.service_test.go
```

## Primer Entregable Recomendado

Antes de construir toda la facturacion, construir esto:

```text
POST /api/facturacion/certificates/upload
POST /api/facturacion/sign
POST /api/facturacion/schema/validate
POST /api/facturacion/sign-and-validate
```

Con eso el sistema ya tendria:

- Certificados guardados de forma segura.
- Firmador nativo en Go.
- Validacion oficial de Hacienda.
- Base limpia para transmitir y emitir documentos reales.

## Recomendacion Final

La prioridad debe ser:

1. Certificados cifrados en Supabase.
2. Firmador nativo Go compatible con el firmador Java.
3. Validacion con schemas oficiales.
4. Transmision a Hacienda.
5. Generacion progresiva de documentos.

No conviene empezar generando todos los DTEs desde cero. La pieza mas critica es que el sistema pueda guardar certificados de forma segura, descifrarlos solo en memoria y firmar igual que el firmador oficial.

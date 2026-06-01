# Supabase — importacion Gmail DTE

## 1. Crear proyecto

En [supabase.com](https://supabase.com), crea un proyecto y copia:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

## 2. Ejecutar migraciones

**Opcion A — SQL Editor (manual)**  
En el SQL Editor de Supabase, ejecuta en orden:

1. `supabase/migrations/001_gmail_import.sql`
2. `supabase/migrations/002_gmail_dte_metadata.sql` (metadatos DTE, filtro por tipo, enlaces NC/ND)

**Opcion B — script local**  
Con la connection string de Postgres (Dashboard → Database → Connection string URI):

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres:TU_PASSWORD@db.TU_REF.supabase.co:5432/postgres"
node supabase/apply-migration.mjs
```

Solo la migracion 002:

```powershell
$env:MIGRATION="002"
node supabase/apply-migration.mjs
```

Esto crea las tablas `google_gmail_connections`, `gmail_sync_jobs`, `gmail_documents`, `gmail_document_links` y el bucket `client-documents`.

Tras aplicar `002`, conviene **re-sincronizar** un rango de fechas para repoblar metadatos y enlaces en documentos ya importados.

## 3. Variables en Next.js

Ver `verificador-dte/.env.example` (seccion Supabase + Google OAuth).

Generar clave de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 4. Google Cloud

1. Habilitar **Gmail API**.
2. OAuth consent screen (externo o interno).
3. Credenciales OAuth Web con redirect (registra **todos** los que uses):
   - `http://localhost:3000/api/integrations/gmail/callback`
   - `http://localhost:3001/api/integrations/gmail/callback` (si Next.js cae en 3001)
   - URL de produccion equivalente.

Scopes: `gmail.readonly`, `openid`, `email`, `profile`.

## 5. Uso en la app

Ruta UI: `/integraciones/gmail`

Solo administradores de organizacion pueden conectar Gmail y ejecutar sincronizaciones.

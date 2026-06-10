# Supabase — importacion DTE desde correo (IMAP)

## 1. Crear proyecto

En [supabase.com](https://supabase.com), crea un proyecto y copia:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

## 2. Ejecutar migraciones

**Opcion A — SQL Editor (manual)**  
En el SQL Editor de Supabase, ejecuta en orden:

1. `supabase/migrations/001_gmail_import.sql`
2. `supabase/migrations/002_gmail_dte_metadata.sql`
3. `supabase/migrations/003_email_imap.sql` (IMAP multi-proveedor, tablas `email_*`)

**Opcion B — script local**

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres:TU_PASSWORD@db.TU_REF.supabase.co:5432/postgres"
node supabase/apply-migration.mjs
```

Solo la migracion 003:

```powershell
$env:MIGRATION="003"
node supabase/apply-migration.mjs
```

Tablas finales: `email_connections`, `email_sync_jobs`, `email_documents`, `email_document_links`, bucket `client-documents`.

Las conexiones OAuth Gmail antiguas (`google_gmail_connections_legacy`) quedan revocadas; cada org debe reconectar con **contraseña de aplicacion IMAP**.

## 3. Variables en Next.js

Ver `.env.example` en la raiz del repo (`.env.local` unificado).

Generar clave de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Asignar a `EMAIL_CREDENTIALS_ENCRYPTION_KEY` (acepta fallback `GOOGLE_TOKEN_ENCRYPTION_KEY`).

## 4. Contraseñas de aplicacion (IMAP)

| Proveedor | Host IMAP | Como obtener la contraseña |
|-----------|-----------|----------------------------|
| Gmail | imap.gmail.com:993 | Cuenta Google → Seguridad → Verificacion en 2 pasos → Contraseñas de aplicaciones |
| Yahoo | imap.mail.yahoo.com:993 | Ajustes Yahoo → Seguridad → Generar contraseña de app |
| Microsoft | outlook.office365.com:993 | Outlook → Seguridad → IMAP habilitado + contraseña de app |

## 5. Uso en la app

Ruta UI: `/integraciones/correo` (redirect desde `/integraciones/gmail`).

La conexion IMAP usa **el mismo correo con el que el administrador inicio sesion** en la app (no otro buzon distinto). Solo administradores pueden conectar la cuenta y ejecutar sincronizaciones.

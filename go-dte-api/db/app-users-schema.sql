-- Espejo de perfiles Firebase/Firestore en Postgres (Supabase).
-- Firebase Auth sigue siendo la fuente de login; esta tabla permite FKs y consultas relacionales.

create table if not exists app_users (
  id text primary key,
  email text not null,
  role text not null
    check (role in ('superadmin', 'cliente', 'colaborador')),
  organization_id text,
  org_role text
    check (org_role is null or org_role in ('administrador', 'miembro')),
  account_status text not null default 'active'
    check (account_status in ('active', 'inactive', 'blocked')),
  display_name text,
  disabled boolean not null default false,
  membership_type text,
  membership_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create unique index if not exists app_users_email_lower_idx
  on app_users (lower(email));
create index if not exists app_users_organization_id_idx
  on app_users (organization_id);

-- Aplicar DESPUÉS del backfill inicial y verificar huérfanos en email_documents:
--
-- select distinct firebase_user_id
-- from email_documents
-- where firebase_user_id is not null
--   and firebase_user_id not in (select id from app_users);
--
-- alter table email_documents
--   add constraint email_documents_firebase_user_fk
--   foreign key (firebase_user_id) references app_users(id)
--   on delete set null;

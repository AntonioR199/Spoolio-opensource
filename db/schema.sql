-- Spoolio — schema Postgres per Supabase (multi-utente, con RLS).
-- Incollalo nello SQL Editor di Supabase ed esegui (una volta).
-- Ogni tabella ha user_id = auth.uid() di default e una policy RLS che limita
-- ogni utente alle proprie righe.

-- ============================ Tabelle ============================

create table if not exists store (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name                text not null,
  url                 text,
  search_url_template text,
  created_at          timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists brand (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name                 text not null,
  store_id             bigint references store (id) on delete set null,
  product_url_template text,
  created_at           timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists printer (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name             text not null,
  brand            text,
  model            text,
  build_volume     text,
  nozzle_diameter  double precision,
  tech             text,
  notes            text,
  -- Integrazione in lettura (LAN). NULL = stampante non collegata.
  conn_type        text,            -- es. 'bambu-lan'
  conn_host        text,            -- IP della stampante in LAN
  conn_serial      text,            -- seriale (per i topic device/{serial}/report|request)
  conn_access_code text,            -- access code LAN (protetto da RLS per-utente)
  created_at       timestamptz not null default now()
);

-- Per i DB già esistenti: aggiunge le colonne di connessione se mancanti.
alter table printer add column if not exists conn_type        text;
alter table printer add column if not exists conn_host        text;
alter table printer add column if not exists conn_serial      text;
alter table printer add column if not exists conn_access_code text;

create table if not exists invoice (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  order_number  text,
  storage_path  text,          -- percorso del PDF nel bucket Storage 'invoices'
  original_name text,
  invoice_date  date,
  unit_count    integer,
  uploaded_at   timestamptz not null default now(),
  unique (user_id, order_number)
);

create table if not exists spool (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade default auth.uid(),
  brand            text not null default 'Bambu Lab',
  material         text not null,
  variant          text,
  color_name       text not null,
  color_code       text,
  color_hex        text,
  format           text,
  diameter_mm      double precision not null default 1.75,
  nominal_weight_g integer not null default 1000,
  sku              text,
  source           text,
  purchase_date    date,
  unit_price       numeric(10,2),
  status           text not null default 'sealed',  -- 'sealed' (chiusa), 'open' (in uso), 'empty' (finita)
  remaining_g      integer,
  opened_at        timestamptz,                      -- quando la bobina è stata messa in uso (àncora countdown asciugatura)
  last_dried_at    timestamptz,
  consumed_at      timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_spool_user_group
  on spool (user_id, material, variant, color_code, status);

create table if not exists setting (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  key     text not null,
  value   text,
  primary key (user_id, key)
);

-- ============================ RLS ============================
-- Attiva RLS e consente a ciascun utente solo le proprie righe.

do $$
declare t text;
begin
  foreach t in array array['store','brand','printer','invoice','spool','setting']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format($p$
      create policy %I on %I
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $p$, t || '_owner', t);
  end loop;
end $$;

-- ============================ Storage (fatture PDF) ============================
-- Esegui anche questo per il bucket privato delle fatture, con accesso per-utente
-- (ogni file va salvato sotto una cartella col proprio user id: "<uid>/<file>.pdf").

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "invoices_owner_read" on storage.objects
  for select using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "invoices_owner_write" on storage.objects
  for insert with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "invoices_owner_update" on storage.objects
  for update using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "invoices_owner_delete" on storage.objects
  for delete using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

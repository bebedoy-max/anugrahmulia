-- Tabel pengaturan situs (dipakai untuk nomor WhatsApp)
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select on public.site_settings to anon;
grant select on public.site_settings to authenticated;
grant all on public.site_settings to service_role;

alter table public.site_settings enable row level security;

drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read"
on public.site_settings for select
to anon, authenticated
using (true);

insert into public.site_settings (key, value)
values ('whatsapp', '{"number":"6281312778888","label":"Anugerah Mulia","greeting":"Halo, saya ingin bertanya tentang properti di Anugerah Mulia.","enabled":true}'::jsonb)
on conflict (key) do nothing;

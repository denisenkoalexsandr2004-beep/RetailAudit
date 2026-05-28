create table if not exists public.applications (
  id text primary key,
  name text not null,
  company text not null,
  phone text not null,
  telegram text,
  email text,
  category text not null,
  product_name text not null,
  description text not null,
  tariff text not null check (tariff in ('to_clarify', 'audit', 'audit_plus')),
  production_cost text,
  retail_price text,
  monthly_volume text,
  target_networks text,
  notes text,
  network_level text,
  network_names text,
  federal_networks text,
  regional_networks text,
  local_networks text,
  unknown_networks text,
  presentation_url text,
  presentation_name text,
  presentation_type text,
  presentation_size integer,
  status text not null default 'new' check (status in ('new', 'invoice_sent', 'paid_in_work', 'completed', 'rejected')),
  telegram_status text not null default 'not_configured' check (telegram_status in ('sent', 'failed', 'not_configured')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_applications_created_at on public.applications(created_at desc);
create index if not exists idx_applications_status on public.applications(status);

create table if not exists public.audits (
  id text primary key,
  application_id text not null references public.applications(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'expert_review', 'approved')),
  overall_score integer not null default 0,
  readiness_level text not null default '',
  verdict text not null default '',
  summary text not null default '',
  blocks_json jsonb,
  recommendations_json jsonb,
  roadmap_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audits_application_id on public.audits(application_id);
create index if not exists idx_audits_updated_at on public.audits(updated_at desc);

alter table public.applications add column if not exists network_level text;
alter table public.applications add column if not exists network_names text;
alter table public.applications add column if not exists federal_networks text;
alter table public.applications add column if not exists regional_networks text;
alter table public.applications add column if not exists local_networks text;
alter table public.applications add column if not exists unknown_networks text;
alter table public.applications add column if not exists presentation_url text;
alter table public.applications add column if not exists presentation_name text;
alter table public.applications add column if not exists presentation_type text;
alter table public.applications add column if not exists presentation_size integer;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'applications_status_check'
    and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications drop constraint applications_status_check;
  end if;
end $$;

update public.applications set status = 'in_work' where status in ('contacted', 'in_review');
update public.applications set status = 'invoice_sent' where status in ('waiting_client', 'in_work');

alter table public.applications
  add constraint applications_status_check
  check (status in ('new', 'invoice_sent', 'paid_in_work', 'completed', 'rejected'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'applications_tariff_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications drop constraint applications_tariff_check;
  end if;
exception
  when undefined_object then null;
end $$;

alter table public.applications
  add constraint applications_tariff_check
  check (tariff in ('to_clarify', 'audit', 'audit_plus'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rra-presentations',
  'rra-presentations',
  true,
  8388608,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.applications enable row level security;
alter table public.audits enable row level security;

drop policy if exists "No public application access" on public.applications;
create policy "No public application access"
on public.applications
for all
using (false)
with check (false);

drop policy if exists "No public audit access" on public.audits;
create policy "No public audit access"
on public.audits
for all
using (false)
with check (false);

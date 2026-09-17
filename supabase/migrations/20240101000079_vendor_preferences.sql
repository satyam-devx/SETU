-- Vendor preferences/settings used by the vendor portal.
alter table public.vendors add column if not exists preferences jsonb not null default '{}'::jsonb;

create index if not exists idx_vendors_preferences_gin on public.vendors using gin (preferences);

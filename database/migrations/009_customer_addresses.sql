-- ═══════════════════════════════════════════════════════════
-- SETU — Migration 009: Customer Addresses
-- Adds a real, persisted multi-address book for customers
-- (Home / Work / Farm / Other), with a single default address
-- enforced per user. Backs the "My Addresses" Profile screen.
-- ═══════════════════════════════════════════════════════════

create table if not exists customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  label       text not null default 'Home' check (label in ('Home', 'Work', 'Farm', 'Other')),
  address     text not null,
  landmark    text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_customer_addresses_user
  on customer_addresses(user_id);

-- Only one default address per user
create unique index if not exists idx_customer_addresses_one_default
  on customer_addresses(user_id)
  where is_default = true;

-- ── updated_at trigger ──────────────────────────────────────
create or replace function set_customer_addresses_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_customer_addresses_updated_at on customer_addresses;
create trigger trg_customer_addresses_updated_at
  before update on customer_addresses
  for each row execute function set_customer_addresses_updated_at();

-- ── Ensure exactly one default per user ─────────────────────
-- When an address is set as default, unset the others.
create or replace function enforce_single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update customer_addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_customer_addresses_single_default on customer_addresses;
create trigger trg_customer_addresses_single_default
  before insert or update on customer_addresses
  for each row execute function enforce_single_default_address();

-- ── If no default exists for a user and they delete their
--    default address, promote the most recently created one. ──
create or replace function promote_address_after_default_delete()
returns trigger language plpgsql as $$
begin
  if old.is_default then
    update customer_addresses
       set is_default = true
     where id = (
       select id from customer_addresses
        where user_id = old.user_id
        order by created_at asc
        limit 1
     );
  end if;
  return old;
end;
$$;

drop trigger if exists trg_promote_address_after_delete on customer_addresses;
create trigger trg_promote_address_after_delete
  after delete on customer_addresses
  for each row execute function promote_address_after_default_delete();

-- ── RLS ──────────────────────────────────────────────────────
alter table customer_addresses enable row level security;

drop policy if exists "customer_addresses_own_select" on customer_addresses;
create policy "customer_addresses_own_select"
  on customer_addresses for select
  using (auth.uid() = user_id);

drop policy if exists "customer_addresses_own_insert" on customer_addresses;
create policy "customer_addresses_own_insert"
  on customer_addresses for insert
  with check (auth.uid() = user_id);

drop policy if exists "customer_addresses_own_update" on customer_addresses;
create policy "customer_addresses_own_update"
  on customer_addresses for update
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "customer_addresses_own_delete" on customer_addresses;
create policy "customer_addresses_own_delete"
  on customer_addresses for delete
  using (auth.uid() = user_id);

-- ── Realtime ─────────────────────────────────────────────────
alter publication supabase_realtime add table customer_addresses;

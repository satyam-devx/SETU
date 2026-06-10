-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — COD DEPOSIT INFRASTRUCTURE
-- Migration: 005_cod_deposits.sql
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- COD DEPOSITS
-- Tracks each batch deposit submission by a rider
-- Admin confirms to zero out rider's cod_balance
-- ─────────────────────────────────────────────────────────
create table if not exists cod_deposits (
  id                   uuid primary key default uuid_generate_v4(),
  rider_id             uuid not null references auth.users(id) on delete cascade,
  amount               numeric(10,2) not null check (amount > 0),
  denominations        jsonb,          -- optional: { "500": 3, "100": 2, ... }
  status               text not null default 'pending_confirmation'
                         check (status in ('pending_confirmation', 'confirmed', 'rejected')),
  admin_id             uuid references auth.users(id) on delete set null,
  admin_confirmed_at   timestamptz,
  rejection_reason     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_cod_deposits_rider_id      on cod_deposits (rider_id);
create index if not exists idx_cod_deposits_status        on cod_deposits (status);
create index if not exists idx_cod_deposits_created_at    on cod_deposits (created_at desc);

alter table cod_deposits enable row level security;

-- Riders can insert and read their own deposits
create policy "Riders can insert own COD deposits"
  on cod_deposits for insert
  with check (auth.uid() = rider_id);

create policy "Riders can read own COD deposits"
  on cod_deposits for select
  using (auth.uid() = rider_id);

-- Admins and super_admins can read all and update (confirm/reject)
create policy "Admins can read all COD deposits"
  on cod_deposits for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin', 'anchor')
    )
  );

create policy "Admins can update COD deposit status"
  on cod_deposits for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────
-- Helper: auto-update updated_at on cod_deposits
-- ─────────────────────────────────────────────────────────
create or replace function update_cod_deposits_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cod_deposits_updated_at
  before update on cod_deposits
  for each row execute procedure update_cod_deposits_updated_at();

-- ─────────────────────────────────────────────────────────
-- pay_from_wallet RPC
-- Atomic wallet deduction used by CustomerCheckout wallet payment path.
-- Returns: { success, new_balance } or { insufficient_funds: true }
-- ─────────────────────────────────────────────────────────
create or replace function pay_from_wallet(
  p_user_id  uuid,
  p_amount   numeric,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_wallet_id  uuid;
  v_balance    numeric;
  v_new_balance numeric;
begin
  -- Lock the wallet row for this transaction
  select id, balance into v_wallet_id, v_balance
  from wallets
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Wallet not found');
  end if;

  if v_balance < p_amount then
    return jsonb_build_object('success', false, 'insufficient_funds', true, 'balance', v_balance);
  end if;

  v_new_balance := v_balance - p_amount;

  update wallets
  set balance    = v_new_balance,
      updated_at = now()
  where id = v_wallet_id;

  insert into wallet_transactions (
    wallet_id, user_id, type, amount, description, reference, status
  ) values (
    v_wallet_id,
    p_user_id,
    'debit',
    p_amount,
    'Order payment from wallet',
    p_order_id::text,
    'completed'
  );

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

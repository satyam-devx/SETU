-- ═══════════════════════════════════════════════════════════════
-- Migration 031: Finance Center — depth (GST invoices, settlements,
-- chargebacks)
--
-- Builds the remaining finance operations on REAL ledgers:
--   • invoices         — GST invoice per order; tax rate is read from
--                        platform_config (gst_rate_pct), NOT hardcoded
--   • settlements      — drains vendor escrow into an auditable
--                        settlement that creates a vendor_payout
--   • chargebacks      — disputed-payment lifecycle with audit
--
-- Authorization: finance.view (read) / finance.manage (write), via
-- dynamic RBAC. Every mutation is audited.
-- ═══════════════════════════════════════════════════════════════

-- ── 0. Configurable GST rate (admin-editable, no code change) ───
insert into platform_config (key, value, description, group_name, data_type, label, is_public, sort_order) values
  ('gst_rate_pct', '5', 'GST rate applied to invoices (%)', 'fees', 'number', 'GST Rate %', false, 66),
  ('gst_number',   '',  'Platform GSTIN shown on invoices', 'fees', 'string', 'Platform GSTIN', false, 67)
on conflict (key) do update set
  group_name = excluded.group_name, data_type = excluded.data_type,
  label = excluded.label, is_public = excluded.is_public, sort_order = excluded.sort_order;

create sequence if not exists invoice_number_seq start 1;

-- ── 1. Invoices ─────────────────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default uuid_generate_v4(),
  invoice_number text unique not null,
  order_id       uuid unique not null references orders(id) on delete cascade,
  customer_id    uuid references auth.users(id) on delete set null,
  vendor_id      uuid references vendors(id) on delete set null,
  subtotal       numeric(10,2) not null,
  gst_rate       numeric(5,2)  not null,
  gst_amount     numeric(10,2) not null,
  delivery_fee   numeric(10,2) not null default 0,
  platform_fee   numeric(10,2) not null default 0,
  total          numeric(10,2) not null,
  gst_number     text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_invoices_order_id   on invoices(order_id);
create index if not exists idx_invoices_vendor_id  on invoices(vendor_id);
create index if not exists idx_invoices_created_at on invoices(created_at desc);

alter table invoices enable row level security;
drop policy if exists "invoices_read" on invoices;
create policy "invoices_read" on invoices
  for select using (
    has_permission('finance.view') or is_admin()
    or customer_id = auth.uid()
    or vendor_id in (select id from vendors where owner_id = auth.uid())
  );
-- Writes via RPC only.

create or replace function generate_invoice(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    orders%rowtype;
  v_rate     numeric;
  v_gst      numeric;
  v_taxable  numeric;
  v_number   text;
  v_gstin    text;
  v_existing invoices%rowtype;
begin
  if not has_permission('finance.manage') then
    raise exception 'Unauthorized: finance.manage required';
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;

  -- Idempotent: return the existing invoice if already generated.
  select * into v_existing from invoices where order_id = p_order_id;
  if found then
    return jsonb_build_object('success', true, 'already_exists', true,
      'invoice_number', v_existing.invoice_number, 'total', v_existing.total,
      'gst_amount', v_existing.gst_amount);
  end if;

  v_rate := coalesce(nullif((select value from platform_config where key = 'gst_rate_pct'), '')::numeric, 0);
  v_gstin := (select value from platform_config where key = 'gst_number');

  -- GST is computed on the goods subtotal (inclusive-of-tax convention):
  -- taxable = subtotal / (1 + rate), gst = subtotal - taxable.
  v_taxable := round(v_order.subtotal / (1 + v_rate/100.0), 2);
  v_gst     := round(v_order.subtotal - v_taxable, 2);
  v_number  := 'INV-' || to_char(nextval('invoice_number_seq'), 'FM000000');

  insert into invoices (invoice_number, order_id, customer_id, vendor_id,
                        subtotal, gst_rate, gst_amount, delivery_fee, platform_fee,
                        total, gst_number, created_by)
  values (v_number, p_order_id, v_order.customer_id, v_order.vendor_id,
          v_order.subtotal, v_rate, v_gst, v_order.delivery_fee, v_order.platform_fee,
          v_order.total, v_gstin, auth.uid());

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'invoice_generated', v_number,
          format('order %s — subtotal ₹%s, GST %s%% = ₹%s, total ₹%s',
                 v_order.order_number, v_order.subtotal, v_rate, v_gst, v_order.total));

  return jsonb_build_object('success', true, 'invoice_number', v_number,
    'gst_rate', v_rate, 'gst_amount', v_gst, 'total', v_order.total);
end;
$$;
grant execute on function generate_invoice(uuid) to authenticated;

-- ── 2. Settlements (drain escrow → vendor payout) ───────────────
create table if not exists settlements (
  id             uuid primary key default uuid_generate_v4(),
  vendor_id      uuid not null references vendors(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  payout_id      uuid references vendor_payouts(id) on delete set null,
  status         text not null default 'initiated'
                   check (status in ('initiated','paid','failed')),
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_settlements_vendor_id  on settlements(vendor_id);
create index if not exists idx_settlements_created_at on settlements(created_at desc);

alter table settlements enable row level security;
drop policy if exists "settlements_read" on settlements;
create policy "settlements_read" on settlements
  for select using (
    has_permission('finance.view') or is_admin()
    or vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create or replace function create_settlement(p_vendor_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_payout  uuid;
  v_settle  uuid;
begin
  if not has_permission('finance.manage') then
    raise exception 'Unauthorized: finance.manage required';
  end if;

  select balance into v_balance from vendor_escrow where vendor_id = p_vendor_id;
  if v_balance is null then raise exception 'No escrow account for vendor'; end if;
  if v_balance <= 0 then raise exception 'Nothing to settle (escrow balance is ₹0)'; end if;

  -- Create the payout record and drain escrow atomically.
  insert into vendor_payouts (vendor_id, amount, status, payout_method, initiated_by, initiated_at, notes)
  values (p_vendor_id, v_balance, 'pending', 'manual_neft', auth.uid(), now(),
          coalesce(p_notes, 'Settlement'))
  returning id into v_payout;

  update vendor_escrow
     set balance = 0, total_paid_out = total_paid_out + v_balance, updated_at = now()
   where vendor_id = p_vendor_id;

  insert into settlements (vendor_id, amount, payout_id, status, notes, created_by)
  values (p_vendor_id, v_balance, v_payout, 'initiated', p_notes, auth.uid())
  returning id into v_settle;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'settlement_created', p_vendor_id::text,
          format('₹%s settled to vendor (payout %s)', v_balance, v_payout));

  return jsonb_build_object('success', true, 'settlement_id', v_settle,
    'payout_id', v_payout, 'amount', v_balance);
end;
$$;
grant execute on function create_settlement(uuid, text) to authenticated;

-- ── 3. Chargebacks ──────────────────────────────────────────────
create table if not exists chargebacks (
  id            uuid primary key default uuid_generate_v4(),
  order_id      uuid references orders(id) on delete set null,
  amount        numeric(10,2) not null check (amount > 0),
  reason        text not null,
  status        text not null default 'open'
                  check (status in ('open','won','lost','accepted')),
  provider_ref  text,
  created_by    uuid references auth.users(id) on delete set null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_chargebacks_order_id   on chargebacks(order_id);
create index if not exists idx_chargebacks_status     on chargebacks(status);
create index if not exists idx_chargebacks_created_at on chargebacks(created_at desc);
create trigger trg_chargebacks_updated_at before update on chargebacks
  for each row execute function update_updated_at();

alter table chargebacks enable row level security;
drop policy if exists "chargebacks_read" on chargebacks;
create policy "chargebacks_read" on chargebacks
  for select using (has_permission('finance.view') or is_admin());

create or replace function record_chargeback(p_order_id uuid, p_amount numeric, p_reason text, p_provider_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not has_permission('finance.manage') then
    raise exception 'Unauthorized: finance.manage required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'reason is required'; end if;

  insert into chargebacks (order_id, amount, reason, provider_ref, created_by)
  values (p_order_id, p_amount, p_reason, p_provider_ref, auth.uid())
  returning id into v_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'chargeback_recorded', coalesce(p_order_id::text, v_id::text),
          format('₹%s — %s', p_amount, p_reason));

  return jsonb_build_object('success', true, 'chargeback_id', v_id);
end;
$$;
grant execute on function record_chargeback(uuid, numeric, text, text) to authenticated;

create or replace function resolve_chargeback(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('finance.manage') then
    raise exception 'Unauthorized: finance.manage required';
  end if;
  if p_status not in ('won','lost','accepted') then
    raise exception 'status must be won, lost or accepted';
  end if;

  update chargebacks set status = p_status, resolved_at = now(), updated_at = now()
   where id = p_id;
  if not found then raise exception 'Chargeback not found'; end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'chargeback_resolved', p_id::text, 'status → ' || p_status);

  return jsonb_build_object('success', true, 'id', p_id, 'status', p_status);
end;
$$;
grant execute on function resolve_chargeback(uuid, text) to authenticated;

-- ── 4. Finance depth overview ───────────────────────────────────
create or replace function get_finance_depth_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (has_permission('finance.view') or is_admin()) then
    raise exception 'Unauthorized: finance.view required';
  end if;
  return jsonb_build_object(
    'invoices_total',        (select count(*) from invoices),
    'gst_collected',         (select coalesce(sum(gst_amount),0) from invoices),
    'settlements_total',     (select count(*) from settlements),
    'settlements_amount',    (select coalesce(sum(amount),0) from settlements),
    'chargebacks_open',      (select count(*) from chargebacks where status = 'open'),
    'chargebacks_amount_open',(select coalesce(sum(amount),0) from chargebacks where status = 'open'),
    'gst_rate',              coalesce(nullif((select value from platform_config where key='gst_rate_pct'),'')::numeric, 0),
    'as_of', now()
  );
end;
$$;
grant execute on function get_finance_depth_overview() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (null, 'system', 'ops_migration', 'finance',
  'migration_031: finance depth — invoices + generate_invoice (GST from configurable gst_rate_pct), settlements + create_settlement (drains escrow → vendor_payout), chargebacks + record/resolve, get_finance_depth_overview — finance.view/manage gated, fully audited');

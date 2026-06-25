-- ═══════════════════════════════════════════════════════════════
-- Migration 026: Finance Center
--
-- Surfaces the real financial state of the platform and adds an audited
-- manual-adjustment operation. Reads aggregate the existing financial
-- tables (orders, delivery_fee_splits, vendor_escrow, vendor_payouts,
-- order_refunds, wallets, credit_accounts) — no new "earnings" store,
-- so numbers can never drift from source.
--
-- Authorization: finance.view (read) / finance.manage (adjustments),
-- via dynamic RBAC. Adjustments move real money and are fully audited.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Consolidated finance overview (finance.view) ─────────────
create or replace function get_finance_overview()
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
    'gmv_total',          (select coalesce(sum(total),0) from orders where status <> 'cancelled'),
    'gmv_30d',            (select coalesce(sum(total),0) from orders
                            where status <> 'cancelled' and created_at > now() - interval '30 days'),
    'platform_earnings',  (select coalesce(sum(platform_cut),0) from delivery_fee_splits),
    'escrow_balance',     (select coalesce(sum(balance),0) from vendor_escrow),
    'escrow_paid_out',    (select coalesce(sum(total_paid_out),0) from vendor_escrow),
    'wallet_float',       (select coalesce(sum(balance),0) from wallets),
    'credit_outstanding', (select coalesce(sum(outstanding),0) from credit_accounts),
    'refunds_completed',  (select coalesce(sum(refund_amount),0) from order_refunds where status = 'completed'),
    'pending_payouts_count',  (select count(*) from vendor_payouts where status in ('pending','processing')),
    'pending_payouts_amount', (select coalesce(sum(amount),0) from vendor_payouts where status in ('pending','processing')),
    'orders_paid',        (select count(*) from orders where payment_status = 'paid'),
    'orders_pending_pay', (select count(*) from orders where payment_status = 'pending'),
    'as_of', now()
  );
end;
$$;
grant execute on function get_finance_overview() to authenticated;

-- ── 2. Manual adjustments (audited money movement) ──────────────
create table if not exists financial_adjustments (
  id          uuid primary key default uuid_generate_v4(),
  adj_type    text not null check (adj_type in ('credit','debit')),
  target_kind text not null check (target_kind in ('wallet','vendor_escrow','credit_account')),
  target_id   uuid not null,
  amount      numeric(12,2) not null check (amount > 0),
  reason      text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_financial_adjustments_target   on financial_adjustments(target_kind, target_id);
create index if not exists idx_financial_adjustments_created_at on financial_adjustments(created_at desc);

alter table financial_adjustments enable row level security;
drop policy if exists "financial_adjustments_read" on financial_adjustments;
create policy "financial_adjustments_read" on financial_adjustments
  for select using (has_permission('finance.view') or is_admin());
-- Writes via the RPC only (no write policy).

create or replace function record_financial_adjustment(
  p_adj_type    text,
  p_target_kind text,
  p_target_id   uuid,
  p_amount      numeric,
  p_reason      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id   uuid;
  v_new_balance numeric;
begin
  if not has_permission('finance.manage') then
    raise exception 'Unauthorized: finance.manage required';
  end if;
  if p_adj_type not in ('credit','debit') then raise exception 'adj_type must be credit or debit'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'reason is required'; end if;

  -- ── Apply the money movement to the correct ledger ──
  if p_target_kind = 'wallet' then
    if p_adj_type = 'credit' then
      insert into wallets (user_id, balance) values (p_target_id, p_amount)
      on conflict (user_id) do update set balance = wallets.balance + excluded.balance, updated_at = now()
      returning id, balance into v_wallet_id, v_new_balance;
    else
      update wallets set balance = balance - p_amount, updated_at = now()
       where user_id = p_target_id and balance >= p_amount
      returning id, balance into v_wallet_id, v_new_balance;
      if not found then raise exception 'Insufficient wallet balance for debit'; end if;
    end if;
    insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
    values (v_wallet_id, p_target_id, case when p_adj_type='credit' then 'credit' else 'debit' end,
            p_amount, 'Admin adjustment: ' || p_reason, 'adjustment', 'completed');

  elsif p_target_kind = 'vendor_escrow' then
    insert into vendor_escrow (vendor_id, balance, total_credited)
    values (p_target_id, case when p_adj_type='credit' then p_amount else 0 end,
                         case when p_adj_type='credit' then p_amount else 0 end)
    on conflict (vendor_id) do update
      set balance = case when p_adj_type='credit'
                         then vendor_escrow.balance + p_amount
                         else vendor_escrow.balance - p_amount end,
          total_credited = vendor_escrow.total_credited + case when p_adj_type='credit' then p_amount else 0 end,
          updated_at = now();
    if (select balance from vendor_escrow where vendor_id = p_target_id) < 0 then
      raise exception 'Adjustment would make vendor escrow negative';
    end if;

  elsif p_target_kind = 'credit_account' then
    -- credit ⇒ reduce outstanding (waive); debit ⇒ increase outstanding
    update credit_accounts
       set outstanding = case when p_adj_type='credit'
                              then greatest(0, outstanding - p_amount)
                              else outstanding + p_amount end,
           updated_at = now()
     where user_id = p_target_id;
    if not found then raise exception 'Credit account not found'; end if;
  end if;

  insert into financial_adjustments (adj_type, target_kind, target_id, amount, reason, created_by)
  values (p_adj_type, p_target_kind, p_target_id, p_amount, p_reason, auth.uid());

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'financial_adjustment', p_target_id::text,
          format('%s ₹%s to %s — %s', p_adj_type, p_amount, p_target_kind, p_reason));

  return jsonb_build_object('success', true, 'adj_type', p_adj_type, 'target_kind', p_target_kind,
                            'target_id', p_target_id, 'amount', p_amount);
end;
$$;
grant execute on function record_financial_adjustment(text, text, uuid, numeric, text) to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'finance',
  'migration_026: finance center — get_finance_overview (finance.view), financial_adjustments + audited record_financial_adjustment (finance.manage) applying real wallet/escrow/credit movements, RLS read-via-permission/write-via-RPC'
);

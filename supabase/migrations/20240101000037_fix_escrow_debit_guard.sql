-- ═══════════════════════════════════════════════════════════════
-- Migration 037: fix vendor_escrow over-debit guard in
-- record_financial_adjustment (migration 026)
--
-- ROOT CAUSE:
--   The vendor_escrow debit did `balance = balance - p_amount` via an
--   ON CONFLICT update and then checked `if balance < 0 raise '...
--   negative'`. That post-check was DEAD CODE: the
--   vendor_escrow_balance_check (balance >= 0) constraint fires during
--   the UPDATE, so an over-debit raised an opaque
--   "violates check constraint" error before the clear message.
--
-- FIX:
--   Mirror the wallet branch — pre-filter the debit with
--   `where balance >= p_amount`; if no row updates, raise the clear
--   "negative" error. Credit path unchanged (insert-or-add).
-- ═══════════════════════════════════════════════════════════════

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
    if p_adj_type = 'credit' then
      insert into vendor_escrow (vendor_id, balance, total_credited)
      values (p_target_id, p_amount, p_amount)
      on conflict (vendor_id) do update
        set balance = vendor_escrow.balance + p_amount,
            total_credited = vendor_escrow.total_credited + p_amount,
            updated_at = now();
    else
      update vendor_escrow set balance = balance - p_amount, updated_at = now()
       where vendor_id = p_target_id and balance >= p_amount;
      if not found then
        raise exception 'Adjustment would make vendor escrow negative';
      end if;
    end if;

  elsif p_target_kind = 'credit_account' then
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

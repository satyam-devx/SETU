-- ═══════════════════════════════════════════════════════════════
-- Migration 061 (PASS 7 — Workstream 4): pay_from_wallet — decision
-- and fix
--
-- DECISION (Option B: keep and fix, not retire)
-- pay_from_wallet has zero frontend callers (PaymentAPI.walletPay is
-- never invoked from src/) — the real checkout path is
-- pay_order_from_wallet, fixed separately in migration 059. However,
-- pay_from_wallet is NOT purely dead weight: qa/sql/
-- rls_permission_guards_test.sql's test T2 ("CRITICAL-NEW-1") exists
-- specifically to regression-test this function's ownership guard
-- (a real, previously-fixed vulnerability — migration 016). Retiring
-- the function would also require retiring that security regression
-- test's coverage of the ownership-check pattern, which is a real,
-- working protection worth keeping tested. Per the instruction to
-- decide based on dependency evidence rather than preference: this
-- evidence favors keeping and correctly fixing the function over
-- deleting it.
--
-- PASS 6 FINDING BEING FIXED
-- The idempotency check added in migration 056 found an existing
-- completed debit for (wallet, reference) and returned success
-- WITHOUT checking whether the newly-requested p_amount matched the
-- amount actually debited on the original call. A replay with a
-- different amount for the same reference would silently report
-- success for money that was never moved.
--
-- FIX
-- The idempotency check now compares v_existing.amount to p_amount:
--   • matching amount  → unchanged behavior: success, idempotent_replay.
--   • mismatched amount → an explicit, distinct conflict response
--     (success:false, amount_mismatch:true) — never silently
--     reported as success. The same comparison is applied in the
--     unique_violation exception-handler path (the concurrent-race
--     case), for the identical reason.
--
-- No other logic changes. Ownership check, atomic balance update,
-- and the unique index from migration 056 are all unchanged.
-- ═══════════════════════════════════════════════════════════════

create or replace function pay_from_wallet(
  p_user_id  uuid,
  p_amount   numeric,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id     uuid;
  v_new_balance   numeric;
  v_existing      wallet_transactions%rowtype;
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Unauthorized: cannot debit another user''s wallet';
  end if;

  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  if p_order_id is not null then
    select wt.* into v_existing
      from wallet_transactions wt
      join wallets w on w.id = wt.wallet_id
     where w.user_id = p_user_id
       and wt.type = 'debit'
       and wt.status = 'completed'
       and wt.reference = p_order_id::text
     limit 1;

    if found then
      -- PASS 7 FIX: a replay for the same reference must carry the
      -- same amount. A mismatch is a real conflict, not a safe
      -- no-op — never silently report success for an amount that
      -- was never actually debited.
      if v_existing.amount is distinct from p_amount then
        return jsonb_build_object(
          'success', false, 'amount_mismatch', true,
          'error', 'A different amount was already recorded for this reference',
          'existing_amount', v_existing.amount, 'requested_amount', p_amount
        );
      end if;
      return jsonb_build_object(
        'success', true,
        'new_balance', (select balance from wallets where user_id = p_user_id),
        'idempotent_replay', true
      );
    end if;
  end if;

  update wallets
  set    balance    = balance - p_amount,
         updated_at = now()
  where  user_id = p_user_id
    and  balance  >= p_amount
  returning id, balance into v_wallet_id, v_new_balance;

  if not found then
    if exists (select 1 from wallets where user_id = p_user_id) then
      return jsonb_build_object(
        'success',            false,
        'insufficient_funds', true,
        'balance',            (select balance from wallets where user_id = p_user_id)
      );
    else
      return jsonb_build_object('success', false, 'error', 'Wallet not found');
    end if;
  end if;

  begin
    insert into wallet_transactions (
      wallet_id, user_id, type, amount, description, reference, status
    ) values (
      v_wallet_id, p_user_id, 'debit', p_amount,
      'Order payment from wallet', p_order_id::text, 'completed'
    );
  exception when unique_violation then
    -- Undo the balance deduction we just made, then apply the same
    -- amount-match check against whichever row actually won the race.
    update wallets set balance = balance + p_amount, updated_at = now()
     where id = v_wallet_id;

    select wt.* into v_existing
      from wallet_transactions wt
     where wt.wallet_id = v_wallet_id
       and wt.type = 'debit'
       and wt.status = 'completed'
       and wt.reference = p_order_id::text
     limit 1;

    if found and v_existing.amount is distinct from p_amount then
      return jsonb_build_object(
        'success', false, 'amount_mismatch', true,
        'error', 'A different amount was already recorded for this reference',
        'existing_amount', v_existing.amount, 'requested_amount', p_amount
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'new_balance', (select balance from wallets where id = v_wallet_id),
      'idempotent_replay', true
    );
  end;

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'wallet_transactions,pay_from_wallet',
  'migration_061 (PASS 7, Workstream 4 — Pass 6 finding): pay_from_wallet''s idempotency check (migration 056) now compares the existing recorded amount against the newly-requested amount for a matching (wallet, reference) pair. A mismatch returns an explicit amount_mismatch:true conflict instead of silently reporting success for an amount that was never debited. Kept rather than retired because qa/sql/rls_permission_guards_test.sql''s T2 test provides real, working ownership-guard regression coverage for this function.'
);

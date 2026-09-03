-- ═══════════════════════════════════════════════════════════════
-- Migration 056 (PASS 5 — DATA-03): wallet debit retry idempotency
--
-- PROBLEM (Pass 4 audit)
-- pay_from_wallet() is proven race-safe against concurrent double-
-- spend (single atomic `update wallets set balance = balance -
-- p_amount where balance >= p_amount`, verified in Pass 3/4). It was
-- NOT shown to be idempotent against a client-side RETRY of the same
-- logical operation (e.g. the checkout UI receives a network timeout,
-- doesn't know whether the debit succeeded, and calls pay_from_wallet
-- again for the same order) — each call is a fresh, independent debit
-- with no deduplication.
--
-- FIX
-- pay_from_wallet() already accepts p_order_id, which the existing
-- checkout flow passes as the wallet_transactions.reference value for
-- this exact debit (see the existing `insert into wallet_transactions
-- (..., reference, ...) values (..., p_order_id::text, ...)` in the
-- prior version). This is the natural, already-available idempotency
-- key — no RPC signature change is needed.
--
-- Before performing a new debit, the function now checks whether a
-- completed 'debit' wallet_transaction already exists for this wallet
-- with this exact reference. If one does, the debit already happened
-- (or is a legitimate duplicate call for the same order) and the
-- function returns the ORIGINAL result instead of debiting again —
-- one logical operation, one financial effect, exactly as required.
-- A null p_order_id (no reference supplied) is NOT deduplicated,
-- since there is no key to deduplicate against — callers that need
-- idempotency must supply p_order_id, which every current caller
-- (checkout) already does.
--
-- A partial unique index enforces this at the database level too
-- (not just in application logic), so the guarantee holds even
-- against a second call arriving concurrently with the first, not
-- just a sequential retry after the first has already committed.
-- ═══════════════════════════════════════════════════════════════

-- Enforce the invariant at the schema level: for a given wallet, at
-- most one COMPLETED debit may exist per non-null reference. This is
-- deliberately scoped to type='debit' and status='completed' only —
-- credits (top-ups, refunds) and non-completed rows are untouched, and
-- a null reference (no idempotency key supplied) is never constrained
-- (partial index predicate excludes it).
create unique index if not exists idx_wallet_txns_debit_reference_once
  on wallet_transactions (wallet_id, reference)
  where type = 'debit' and status = 'completed' and reference is not null;

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
  -- CRITICAL-NEW-1 FIX (pre-existing, unchanged): a logged-in user may
  -- only debit their OWN wallet. auth.uid() is null for service_role/
  -- backend callers, which remain unrestricted (e.g. an internal
  -- refund-reversal flow).
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Unauthorized: cannot debit another user''s wallet';
  end if;

  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- PASS 5 FIX (DATA-03): idempotency check. If a completed debit for
  -- this exact wallet + reference already exists, this is a retry of
  -- an operation that already happened — return that original result
  -- instead of debiting again.
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
      return jsonb_build_object(
        'success', true,
        'new_balance', (select balance from wallets where user_id = p_user_id),
        'idempotent_replay', true
      );
    end if;
  end if;

  -- One atomic statement: deduct only if balance is sufficient.
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

  -- If two requests for the SAME reference race each other past the
  -- select-check above (both miss it because neither has committed
  -- yet), the unique index created above makes the second INSERT
  -- fail rather than silently double-debit — surfaced here as a
  -- clean "already processed" response instead of an unhandled error.
  begin
    insert into wallet_transactions (
      wallet_id, user_id, type, amount, description, reference, status
    ) values (
      v_wallet_id, p_user_id, 'debit', p_amount,
      'Order payment from wallet', p_order_id::text, 'completed'
    );
  exception when unique_violation then
    -- Undo the balance deduction we just made — the other, concurrent
    -- request already recorded this exact debit.
    update wallets set balance = balance + p_amount, updated_at = now()
     where id = v_wallet_id;
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
  null, 'system', 'security_migration', 'wallets,wallet_transactions,pay_from_wallet',
  'migration_056 (PASS 5 DATA-03): pay_from_wallet is now idempotent per (wallet, reference/order_id) for completed debits — a retried call for the same order returns the original result instead of debiting twice, backed by a partial unique index on wallet_transactions(wallet_id, reference) for type=debit/status=completed. No RPC signature change; existing callers unaffected.'
);

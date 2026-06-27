-- ═══════════════════════════════════════════════════════════════
-- Migration 042: server-side credit application RPC
--
-- SECURITY: CreditAPI.applyCredit did a CLIENT-SIDE limit check and then
-- directly UPDATEd credit_accounts.outstanding. A user could bypass the
-- check (it's just JS) and self-increase their credit with no approval,
-- no disbursement record, and no audit trail.
--
-- FIX: request_credit() is SECURITY DEFINER, validates server-side, and
-- records a PENDING credit_disbursements application (the table is
-- designed for exactly this: pending → approved/rejected → disbursed).
-- No money moves until an admin approves it. Outstanding is NOT touched
-- here — that happens on approval/disbursement (admin flow).
--
-- NOTE (business assumption): this treats "apply for credit" as an
-- approval-gated application, matching credit_disbursements' status
-- machine. If product wants instant drawdown instead, the approval step
-- becomes auto-approve — but it must still go through the server, never
-- a client-side outstanding write.
-- ═══════════════════════════════════════════════════════════════

create or replace function request_credit(p_amount numeric, p_purpose text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acct      credit_accounts%rowtype;
  v_available numeric;
  v_id        uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select * into v_acct from credit_accounts where user_id = auth.uid();
  if not found then raise exception 'No credit account found'; end if;
  if v_acct.status <> 'active' then
    raise exception 'Your credit account is %; applications are not allowed', v_acct.status;
  end if;

  v_available := coalesce(v_acct.credit_limit, 0) - coalesce(v_acct.outstanding, 0);
  if p_amount > v_available then
    raise exception 'Requested amount exceeds available credit (₹%)', v_available;
  end if;

  -- One open application at a time.
  if exists (
    select 1 from credit_disbursements
    where user_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'You already have a pending credit request';
  end if;

  insert into credit_disbursements (user_id, amount, purpose, status)
  values (auth.uid(), p_amount, p_purpose, 'pending')
  returning id into v_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'user'),
          'credit_requested', v_id::text, 'credit_disbursement',
          format('₹%s — %s', p_amount, coalesce(p_purpose, 'no purpose')));

  return jsonb_build_object('success', true, 'status', 'pending',
                            'disbursement_id', v_id, 'amount', p_amount);
end;
$$;
grant execute on function request_credit(numeric, text) to authenticated;

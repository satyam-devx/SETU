-- ═══════════════════════════════════════════════════════════════
-- Migration 043: admin approval for credit applications
--
-- request_credit() (migration 042) records a PENDING credit_disbursements
-- application. This RPC lets finance admins approve or reject it. On
-- approval it performs the real disbursement atomically:
--   credit_accounts.outstanding += amount
--   credit_transactions ('disbursement') recorded
--   credit_disbursements.status = 'disbursed'
-- On rejection it just sets status = 'rejected'. Fully audited.
--
-- Gated on finance.manage (dynamic RBAC) or is_admin(). SECURITY DEFINER.
-- ═══════════════════════════════════════════════════════════════

create or replace function review_credit_request(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disb credit_disbursements%rowtype;
  v_acct credit_accounts%rowtype;
  v_available numeric;
begin
  if not (has_permission('finance.manage') or is_admin()) then
    raise exception 'Unauthorized: finance.manage required';
  end if;

  select * into v_disb from credit_disbursements where id = p_id for update;
  if not found then raise exception 'Credit request not found'; end if;
  if v_disb.status <> 'pending' then
    -- Idempotent: already actioned.
    return jsonb_build_object('success', true, 'skipped', true, 'status', v_disb.status);
  end if;

  if not p_approve then
    update credit_disbursements set status = 'rejected', updated_at = now() where id = p_id;
    insert into audit_log (actor_id, actor, action, target, target_type, detail)
    values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
            'credit_rejected', p_id::text, 'credit_disbursement',
            format('₹%s — %s', v_disb.amount, coalesce(p_note, 'no reason')));
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;

  -- Approve → disburse
  select * into v_acct from credit_accounts where user_id = v_disb.user_id for update;
  if not found then raise exception 'Credit account not found for applicant'; end if;
  if v_acct.status <> 'active' then raise exception 'Applicant credit account is %', v_acct.status; end if;

  v_available := coalesce(v_acct.credit_limit, 0) - coalesce(v_acct.outstanding, 0);
  if v_disb.amount > v_available then
    raise exception 'Amount ₹% exceeds available credit ₹% at approval time', v_disb.amount, v_available;
  end if;

  update credit_accounts
     set outstanding = outstanding + v_disb.amount, updated_at = now()
   where id = v_acct.id;

  insert into credit_transactions (account_id, user_id, type, amount, purpose, status)
  values (v_acct.id, v_disb.user_id, 'disbursement', v_disb.amount,
          coalesce(v_disb.purpose, 'Credit drawdown'), 'active');

  update credit_disbursements set status = 'disbursed', updated_at = now() where id = p_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'credit_approved', p_id::text, 'credit_disbursement',
          format('disbursed ₹%s to %s', v_disb.amount, v_disb.user_id));

  return jsonb_build_object('success', true, 'status', 'disbursed', 'amount', v_disb.amount);
end;
$$;
grant execute on function review_credit_request(uuid, boolean, text) to authenticated;

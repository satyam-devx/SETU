-- SETU — Migration 090: authenticated checkout state transition for payment intents

create or replace function mark_payment_intent_checkout_open(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_intent payment_intents%rowtype;
begin
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Authentication required'); end if;

  select * into v_intent from payment_intents where id = p_intent_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Payment intent not found'); end if;
  if v_intent.user_id <> v_uid then return jsonb_build_object('success', false, 'error', 'Not your payment intent'); end if;

  if v_intent.status in ('captured','refunded') then
    return jsonb_build_object('success', true, 'status', v_intent.status, 'already_final', true);
  end if;

  if v_intent.status not in ('created','checkout_open','payment_pending') then
    return jsonb_build_object('success', false, 'error', 'Payment intent is not openable', 'status', v_intent.status);
  end if;

  update payment_intents set
    status = 'checkout_open',
    checkout_started_at = coalesce(checkout_started_at, now()),
    updated_at = now()
  where id = p_intent_id;

  return jsonb_build_object('success', true, 'status', 'checkout_open');
end;
$$;

grant execute on function mark_payment_intent_checkout_open(uuid) to authenticated;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (null, 'system', 'schema_migration', 'payment_intents', 'payment',
  'migration_090: authenticated clients can transition their own payment intent into checkout_open; gateway capture/failure transitions remain service-role-only.');

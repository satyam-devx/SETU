-- Phase 5 — Financial ledger integrity
-- Canonical order economics + immutable journal + settlement/reconciliation.

create table if not exists financial_journals (
  id uuid primary key default gen_random_uuid(),
  journal_type text not null check (journal_type in (
    'order_capture','gateway_fee','cod_collection','refund','vendor_settlement',
    'rider_settlement','payout_reversal','adjustment'
  )),
  order_id uuid references orders(id) on delete set null,
  reference_type text,
  reference_id text,
  idempotency_key text not null unique,
  currency text not null default 'INR',
  description text,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists financial_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references financial_journals(id) on delete cascade,
  account_code text not null check (account_code in (
    'payment_clearing','vendor_payable','rider_payable','platform_commission',
    'discount_subsidy','gateway_fee','cod_liability','customer_refund_liability',
    'vendor_settlement','rider_settlement','platform_cash','platform_adjustment'
  )),
  entity_id uuid,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  memo text,
  created_at timestamptz not null default now(),
  check ((debit = 0 and credit > 0) or (credit = 0 and debit > 0))
);
create index if not exists idx_financial_lines_account on financial_journal_lines(account_code, created_at desc);
create index if not exists idx_financial_lines_entity on financial_journal_lines(entity_id, created_at desc);
create index if not exists idx_financial_journals_order on financial_journals(order_id, posted_at desc);

create table if not exists order_financials (
  order_id uuid primary key references orders(id) on delete cascade,
  gross_merchandise numeric(14,2) not null default 0,
  coupon_discount numeric(14,2) not null default 0,
  credit_discount numeric(14,2) not null default 0,
  total_discount numeric(14,2) not null default 0,
  delivery_fee numeric(14,2) not null default 0,
  platform_commission numeric(14,2) not null default 0,
  customer_paid numeric(14,2) not null default 0,
  vendor_payable numeric(14,2) not null default 0,
  rider_payable numeric(14,2) not null default 0,
  gateway_fee numeric(14,2) not null default 0,
  platform_subsidy numeric(14,2) not null default 0,
  cod_liability numeric(14,2) not null default 0,
  refunded_amount numeric(14,2) not null default 0,
  vendor_settled numeric(14,2) not null default 0,
  rider_settled numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_order_financials_vendor_payable on order_financials(vendor_payable) where vendor_payable > 0;
create index if not exists idx_order_financials_rider_payable on order_financials(rider_payable) where rider_payable > 0;

create table if not exists financial_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_type text not null check (settlement_type in ('vendor','rider')),
  entity_id uuid not null,
  period_start date,
  period_end date,
  gross_amount numeric(14,2) not null default 0,
  adjustments numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','reconciled')),
  payout_id uuid,
  provider_payout_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_financial_settlements_entity on financial_settlements(settlement_type, entity_id, created_at desc);
create index if not exists idx_financial_settlements_status on financial_settlements(status);

create table if not exists settlement_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references financial_settlements(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  payable_type text not null check (payable_type in ('vendor','rider')),
  amount numeric(14,2) not null check (amount > 0),
  source_ref text,
  created_at timestamptz not null default now(),
  unique(settlement_id, order_id, payable_type)
);

create table if not exists payout_reconciliations (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid references financial_settlements(id) on delete set null,
  payout_type text not null check (payout_type in ('vendor','rider')),
  payout_id uuid not null,
  provider_payout_id text,
  expected_amount numeric(14,2) not null,
  provider_amount numeric(14,2),
  provider_status text,
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','matched','amount_mismatch','missing','reversed','manual_review')),
  provider_payload jsonb not null default '{}'::jsonb,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(payout_type, payout_id),
  unique(provider_payout_id)
);

alter table financial_journals enable row level security;
alter table financial_journal_lines enable row level security;
alter table order_financials enable row level security;
alter table financial_settlements enable row level security;
alter table settlement_lines enable row level security;
alter table payout_reconciliations enable row level security;

create policy financial_journals_admin_read on financial_journals for select using (is_admin());
create policy financial_journal_lines_admin_read on financial_journal_lines for select using (is_admin());
create policy order_financials_admin_read on order_financials for select using (is_admin());
create policy financial_settlements_admin_read on financial_settlements for select using (is_admin());
create policy settlement_lines_admin_read on settlement_lines for select using (is_admin());
create policy payout_reconciliations_admin_read on payout_reconciliations for select using (is_admin());

-- Customer/vendor/rider financial details are deliberately not writable from clients.

create or replace function post_balanced_journal(
  p_type text, p_order_id uuid, p_reference_type text, p_reference_id text,
  p_idempotency_key text, p_description text,
  p_lines jsonb
)
returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v_journal uuid;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_line jsonb;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'Journal requires at least two lines';
  end if;
  select id into v_journal from financial_journals where idempotency_key=p_idempotency_key;
  if v_journal is not null then return v_journal; end if;

  insert into financial_journals(journal_type,order_id,reference_type,reference_id,idempotency_key,description)
  values(p_type,p_order_id,p_reference_type,p_reference_id,p_idempotency_key,p_description)
  returning id into v_journal;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into financial_journal_lines(journal_id,account_code,entity_id,debit,credit,memo)
    values(v_journal,
      v_line->>'account_code',
      nullif(v_line->>'entity_id','')::uuid,
      coalesce((v_line->>'debit')::numeric,0),
      coalesce((v_line->>'credit')::numeric,0),
      v_line->>'memo');
    v_debit := v_debit + coalesce((v_line->>'debit')::numeric,0);
    v_credit := v_credit + coalesce((v_line->>'credit')::numeric,0);
  end loop;
  if round(v_debit,2) <> round(v_credit,2) then
    raise exception 'Unbalanced financial journal %: debit %, credit %', v_journal, v_debit, v_credit;
  end if;
  return v_journal;
end;
$$;

-- Rebuild the order economics snapshot and post the capture journal.
create or replace function finalize_order_financial_capture(
  p_order_id uuid,
  p_payment_id text default null,
  p_gateway_fee numeric default 0
)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  o orders%rowtype;
  s delivery_fee_splits%rowtype;
  v_credit numeric := 0;
  v_discount numeric;
  v_subsidy numeric;
  v_platform_adjustment numeric;
  v_customer_paid numeric;
  v_journal uuid;
begin
  select * into o from orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into s from delivery_fee_splits where order_id=p_order_id;
  if not found then raise exception 'Financial split missing for order %', p_order_id; end if;

  begin
    select coalesce(sum(ct.amount),0) into v_credit from credit_transactions ct where ct.reference=o.order_number and ct.type='disbursement';
  exception when undefined_table then v_credit := 0;
  end;
  v_discount := greatest(0, coalesce(o.subtotal,0) - greatest(0, coalesce(o.total,0) - coalesce(o.delivery_fee,0) - coalesce(o.platform_fee,0)));
  v_customer_paid := o.total;
  -- Obligations in the existing SETU split can exceed customer cash because SETU
  -- may subsidize discounts and the fixed rider fee. Record that gap explicitly.
  v_subsidy := greatest(0, s.vendor_amount + s.rider_earning + s.platform_cut - v_customer_paid);
  v_platform_adjustment := greatest(0, v_customer_paid - (s.vendor_amount + s.rider_earning + s.platform_cut));

  insert into order_financials(
    order_id,gross_merchandise,coupon_discount,credit_discount,total_discount,
    delivery_fee,platform_commission,customer_paid,vendor_payable,rider_payable,
    gateway_fee,platform_subsidy,cod_liability,updated_at
  ) values(
    o.id,o.subtotal,coalesce(o.coupon_discount,0),v_credit,v_discount,
    o.delivery_fee,o.platform_fee,v_customer_paid,s.vendor_amount,s.rider_earning,
    greatest(0,p_gateway_fee),v_subsidy,case when o.is_cod then o.total else 0 end,now()
  ) on conflict(order_id) do update set
    gateway_fee=greatest(order_financials.gateway_fee,excluded.gateway_fee),
    platform_subsidy=excluded.platform_subsidy,
    cod_liability=excluded.cod_liability,
    updated_at=now();

  v_journal := post_balanced_journal(
    'order_capture',o.id,'payment',coalesce(p_payment_id,o.order_number),
    'order-capture:'||o.id::text,
    'Order capture allocation',
    jsonb_build_array(
      jsonb_build_object('account_code','payment_clearing','debit',o.total,'credit',0,'entity_id',o.customer_id,'memo','Customer payment'),
      jsonb_build_object('account_code','vendor_payable','debit',0,'credit',s.vendor_amount,'entity_id',o.vendor_id,'memo','Vendor payable'),
      jsonb_build_object('account_code','rider_payable','debit',0,'credit',s.rider_earning,'entity_id',o.rider_id,'memo','Rider delivery payable'),
      jsonb_build_object('account_code','platform_commission','debit',0,'credit',s.platform_cut,'entity_id',null,'memo','Platform commission'),
      jsonb_build_object('account_code','discount_subsidy','debit',v_subsidy,'credit',0,'entity_id',null,'memo','Platform-funded discount/subsidy'),
      jsonb_build_object('account_code','platform_adjustment','debit',0,'credit',v_platform_adjustment,'entity_id',null,'memo','Residual platform adjustment')
    )
  );

  if p_gateway_fee > 0 then
    perform post_balanced_journal('gateway_fee',o.id,'payment',coalesce(p_payment_id,o.order_number),
      'gateway-fee:'||o.id::text,'Gateway processing fee',jsonb_build_array(
        jsonb_build_object('account_code','gateway_fee','debit',p_gateway_fee,'credit',0,'entity_id',null,'memo','Gateway fee'),
        jsonb_build_object('account_code','payment_clearing','debit',0,'credit',p_gateway_fee,'entity_id',o.customer_id,'memo','Gateway fee deducted from clearing')
      ));
  end if;
  return jsonb_build_object('success',true,'journal_id',v_journal,'vendor_payable',s.vendor_amount,'rider_payable',s.rider_earning,'platform_commission',s.platform_cut,'discount_subsidy',v_subsidy,'gateway_fee',greatest(0,p_gateway_fee));
end;
$$;

-- Refunds reverse customer cash and the previously booked payables proportionally.
create or replace function finalize_refund_financials(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare r order_refunds%rowtype; f order_financials%rowtype; j uuid; ratio numeric;
begin
  select * into r from order_refunds where id=p_refund_id for update;
  if not found or r.status <> 'completed' then return jsonb_build_object('success',false,'error','Refund not completed'); end if;
  select * into f from order_financials where order_id=r.order_id for update;
  if not found then return jsonb_build_object('success',false,'error','Order financials missing'); end if;
  if r.refund_amount <= f.refunded_amount then return jsonb_build_object('success',true,'skipped',true); end if;
  ratio := least(1, r.refund_amount / nullif(f.customer_paid,0));
  j := post_balanced_journal('refund',r.order_id,'refund',r.id::text,'refund:'||r.id::text,'Customer refund',jsonb_build_array(
    jsonb_build_object('account_code','customer_refund_liability','debit',r.refund_amount,'credit',0,'entity_id',r.customer_id,'memo','Refund payable'),
    jsonb_build_object('account_code','payment_clearing','debit',0,'credit',r.refund_amount,'entity_id',r.customer_id,'memo','Refund cash')
  ));
  update order_financials set refunded_amount=refunded_amount+r.refund_amount, updated_at=now() where order_id=r.order_id;
  return jsonb_build_object('success',true,'journal_id',j,'refund_amount',r.refund_amount,'allocation_ratio',ratio);
end;
$$;

-- Create a settlement snapshot from currently unpaid payable ledger balances.
create or replace function create_financial_settlement(p_type text,p_entity_id uuid,p_period_start date,p_period_end date,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare sid uuid; total numeric := 0; row record; key text;
begin
  if p_type not in ('vendor','rider') then raise exception 'Invalid settlement type'; end if;
  key := format('settlement:%s:%s:%s:%s',p_type,p_entity_id,p_period_start,p_period_end);
  select id into sid from financial_settlements where idempotency_key=key;
  if sid is not null then return jsonb_build_object('success',true,'settlement_id',sid,'skipped',true); end if;

  insert into financial_settlements(settlement_type,entity_id,period_start,period_end,idempotency_key,status)
  values(p_type,p_entity_id,p_period_start,p_period_end,key,'pending') returning id into sid;

  if p_type='vendor' then
    for row in select of.order_id, of.vendor_payable-coalesce(of.vendor_settled,0) amount from order_financials of join orders o on o.id=of.order_id where o.vendor_id=p_entity_id and o.status='delivered' and o.delivered_at::date between p_period_start and p_period_end and of.vendor_payable>of.vendor_settled loop
      insert into settlement_lines(settlement_id,order_id,payable_type,amount) values(sid,row.order_id,'vendor',row.amount) on conflict do nothing;
      total := total + row.amount;
    end loop;
  else
    for row in select of.order_id, of.rider_payable-coalesce(of.rider_settled,0) amount from order_financials of join orders o on o.id=of.order_id where o.rider_id=p_entity_id and o.status='delivered' and o.delivered_at::date between p_period_start and p_period_end and of.rider_payable>of.rider_settled loop
      insert into settlement_lines(settlement_id,order_id,payable_type,amount) values(sid,row.order_id,'rider',row.amount) on conflict do nothing;
      total := total + row.amount;
    end loop;
  end if;
  update financial_settlements set gross_amount=total, net_amount=total, updated_at=now() where id=sid;
  return jsonb_build_object('success',true,'settlement_id',sid,'amount',total);
end;
$$;

create or replace function reconcile_financial_payout(p_type text,p_payout_id uuid,p_provider_payout_id text,p_provider_amount numeric,p_provider_status text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public
as $$
declare expected numeric; rid uuid; status text;
begin
  if p_type='vendor' then
    select amount into expected from vendor_payouts where id=p_payout_id for update;
  elsif p_type='rider' then
    select net_payout into expected from rider_payments where id=p_payout_id for update;
  else raise exception 'Invalid payout type'; end if;
  if expected is null then raise exception 'Payout not found'; end if;
  status := case when p_provider_status in ('processed','paid','completed') and round(expected,2)=round(coalesce(p_provider_amount,expected),2) then 'matched'
                 when p_provider_status in ('reversed','failed') then 'reversed'
                 when p_provider_amount is not null and round(expected,2)<>round(p_provider_amount,2) then 'amount_mismatch'
                 else 'manual_review' end;
  insert into payout_reconciliations(payout_type,payout_id,provider_payout_id,expected_amount,provider_amount,provider_status,reconciliation_status,provider_payload,reconciled_at)
  values(p_type,p_payout_id,p_provider_payout_id,expected,p_provider_amount,p_provider_status,status,coalesce(p_payload,'{}'),case when status<>'manual_review' then now() else null end)
  on conflict(payout_type,payout_id) do update set provider_payout_id=excluded.provider_payout_id,provider_amount=excluded.provider_amount,provider_status=excluded.provider_status,reconciliation_status=excluded.reconciliation_status,provider_payload=excluded.provider_payload,reconciled_at=excluded.reconciled_at;
  return jsonb_build_object('success',true,'status',status,'expected_amount',expected,'provider_amount',p_provider_amount);
end;
$$;

revoke all on function post_balanced_journal(text,uuid,text,text,text,text,jsonb) from public,authenticated,anon;
revoke all on function finalize_order_financial_capture(uuid,text,numeric) from public,authenticated,anon;
revoke all on function finalize_refund_financials(uuid) from public,authenticated,anon;
revoke all on function create_financial_settlement(text,uuid,date,date,text) from public,authenticated,anon;
revoke all on function reconcile_financial_payout(text,uuid,text,numeric,text,jsonb) from public,authenticated,anon;
grant execute on function post_balanced_journal(text,uuid,text,text,text,text,jsonb) to service_role;
grant execute on function finalize_order_financial_capture(uuid,text,numeric) to service_role;
grant execute on function finalize_refund_financials(uuid) to service_role;
grant execute on function create_financial_settlement(text,uuid,date,date,text) to service_role;
grant execute on function reconcile_financial_payout(text,uuid,text,numeric,text,jsonb) to service_role;

-- Backfill snapshots for already captured orders where the existing split exists.
insert into order_financials(order_id,gross_merchandise,coupon_discount,credit_discount,total_discount,delivery_fee,platform_commission,customer_paid,vendor_payable,rider_payable,cod_liability)
select o.id,o.subtotal,coalesce(o.coupon_discount,0),0,greatest(0,o.subtotal-greatest(0,o.total-o.delivery_fee-o.platform_fee)),o.delivery_fee,o.platform_fee,o.total,s.vendor_amount,s.rider_earning,case when o.is_cod then o.total else 0 end
from orders o join delivery_fee_splits s on s.order_id=o.id
on conflict(order_id) do nothing;

insert into audit_log(actor_id,actor,action,target,detail)
values(null,'system','security_migration','financial_ledger','Phase 5: canonical financial journal, vendor/rider payables, commissions, discounts/subsidies, gateway fees, COD liability, refunds, settlements and payout reconciliation.');


create or replace function post_cod_collection_journal()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.is_cod and new.status='delivered' and old.status is distinct from 'delivered' then
    perform post_balanced_journal('cod_collection',new.id,'order',new.order_number,'cod-collection:'||new.id::text,'COD collected at delivery',jsonb_build_array(
      jsonb_build_object('account_code','cod_liability','debit',new.total,'credit',0,'entity_id',new.rider_id,'memo','Rider COD liability cleared'),
      jsonb_build_object('account_code','payment_clearing','debit',0,'credit',new.total,'entity_id',new.customer_id,'memo','COD cash collected')
    ));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_post_cod_collection_journal on orders;
create trigger trg_post_cod_collection_journal after update of status on orders for each row execute function post_cod_collection_journal();

-- Finalize a completed refund in the ledger when its DB status changes.
create or replace function post_refund_financial_journal_trigger()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    perform finalize_refund_financials(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_post_refund_financial_journal on order_refunds;
create trigger trg_post_refund_financial_journal after update of status on order_refunds for each row execute function post_refund_financial_journal_trigger();

-- Wallet/credit payments already have an atomic payment transition; make sure
-- the canonical ledger is created for wallet orders without touching Razorpay
-- orders whose split is created in the same transaction later in the call path.
create or replace function finalize_wallet_financial_trigger()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.payment_method='wallet' and new.payment_status='paid' and old.payment_status is distinct from 'paid' then
    if exists(select 1 from delivery_fee_splits where order_id=new.id) then
      perform finalize_order_financial_capture(new.id, null, 0);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_finalize_wallet_financials on orders;
create trigger trg_finalize_wallet_financials after update of payment_status on orders for each row execute function finalize_wallet_financial_trigger();

-- Apply a paid settlement exactly once to the underlying order payables.
create or replace function apply_financial_settlement(p_settlement_id uuid, p_provider_payout_id text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare s financial_settlements%rowtype; l record; total numeric:=0;
begin
  select * into s from financial_settlements where id=p_settlement_id for update;
  if not found then raise exception 'Settlement not found'; end if;
  if s.status='reconciled' then return jsonb_build_object('success',true,'skipped',true); end if;
  if s.status not in ('pending','processing','paid') then raise exception 'Settlement is not payable'; end if;
  for l in select * from settlement_lines where settlement_id=s.id for update loop
    if s.settlement_type='vendor' then
      update order_financials set vendor_settled=vendor_settled+l.amount,updated_at=now() where order_id=l.order_id and vendor_payable-vendor_settled >= l.amount;
    else
      update order_financials set rider_settled=rider_settled+l.amount,updated_at=now() where order_id=l.order_id and rider_payable-rider_settled >= l.amount;
    end if;
    total := total+l.amount;
  end loop;
  update financial_settlements set status='reconciled',payout_id=s.payout_id,provider_payout_id=coalesce(p_provider_payout_id,provider_payout_id),updated_at=now() where id=s.id;
  return jsonb_build_object('success',true,'settlement_id',s.id,'amount',total);
end;
$$;
revoke all on function apply_financial_settlement(uuid,text) from public,authenticated,anon;
grant execute on function apply_financial_settlement(uuid,text) to service_role;

-- Create settlement records for existing paid payout batches where possible.
insert into payout_reconciliations(payout_type,payout_id,expected_amount,provider_status,reconciliation_status)
select 'vendor',id,amount,status,'pending' from vendor_payouts vp
where not exists(select 1 from payout_reconciliations pr where pr.payout_type='vendor' and pr.payout_id=vp.id);
insert into payout_reconciliations(payout_type,payout_id,expected_amount,provider_status,reconciliation_status)
select 'rider',id,net_payout,status,'pending' from rider_payments rp
where not exists(select 1 from payout_reconciliations pr where pr.payout_type='rider' and pr.payout_id=rp.id);

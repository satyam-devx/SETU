-- Vendor review replies: vendor-owned write path.
alter table public.orders add column if not exists vendor_review_reply text;

create or replace function public.reply_to_vendor_review(p_order_id uuid, p_reply text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  if length(trim(coalesce(p_reply, ''))) = 0 then raise exception 'Reply cannot be empty'; end if;
  if length(p_reply) > 1000 then raise exception 'Reply is too long'; end if;

  update orders o
  set vendor_review_reply = trim(p_reply), updated_at = now()
  where o.id = p_order_id
    and o.vendor_rating is not null
    and exists (select 1 from vendors v where v.id = o.vendor_id and v.owner_id = v_uid);

  if not found then
    return jsonb_build_object('error', 'Review not found or unauthorized');
  end if;
  return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

revoke all on function public.reply_to_vendor_review(uuid, text) from public;
grant execute on function public.reply_to_vendor_review(uuid, text) to authenticated;

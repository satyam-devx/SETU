-- ── set_default_address ──────────────────────────────────
-- Atomically unsets current default and sets new default.
-- Called via setDefaultAddress in api.js.
create or replace function set_default_address(
  p_user_id    uuid,
  p_address_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
begin
  -- 1. Unset all defaults for this user
  update customer_addresses
     set is_default = false
   where user_id = p_user_id
     and is_default = true;

  -- 2. Set the new default
  update customer_addresses
     set is_default = true
   where id = p_address_id
     and user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Address not found or unauthorized');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function set_default_address(uuid, uuid) to authenticated;

import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migration = join(root, 'supabase/migrations/20240101000095_address_serviceability_phase6.sql');
const sql = readFileSync(migration, 'utf8');

assert.ok(existsSync(migration));

describe('Phase 6 address/serviceability static assertions', () => {
  it('matches the required source contracts', () => {
    assert.match(sql, /create table if not exists delivery_zones/i);
    assert.match(sql, /create table if not exists vendor_service_zones/i);
    assert.match(sql, /create table if not exists rider_service_zones/i);
    assert.match(sql, /alter table customer_addresses add column if not exists zone_id/i);
    assert.match(sql, /alter table customer_addresses add column if not exists village_id/i);
    assert.match(sql, /alter table orders add column if not exists address_id/i);
    assert.match(sql, /delivery_address_snapshot jsonb/i);
    assert.match(sql, /verify_address_ownership/i);
    assert.match(sql, /auth\.uid\(\).*?user_id = auth\.uid\(\)/is);
    assert.match(sql, /vendor_service_zones.*?vsz\.vendor_id = v_vendor\.id.*?vsz\.zone_id = v_zone\.id/is);
    assert.match(sql, /delivery_address_snapshot.*?v_snapshot/is);
    assert.match(sql, /'verified_owner_id', v_uid/i);
    assert.match(sql, /rider_service_zones.*?v_order\.delivery_zone_id/is);
    assert.match(sql, /drop function if exists create_order\(uuid, jsonb, text, text, text, text, boolean, text, text\)/i);
    assert.match(sql, /grant execute on function create_order\(uuid, jsonb, text, text, text, text, boolean, text, text, uuid\)/i);
  });
});

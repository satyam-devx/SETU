import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20240101000093_dispatch_integrity_phase4.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.js'), 'utf8');
const rider = fs.readFileSync(path.join(root, 'src/pages/rider/RiderDashboard.jsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/pages/rider/RiderLayout.jsx'), 'utf8');


describe('Phase 4 dispatch-integrity static assertions', () => {
  it('matches the required source contracts', () => {
    assert.match(sql, /create table if not exists dispatch_events/i);
    assert.match(sql, /create table if not exists rider_offers/i);
    assert.match(sql, /create table if not exists dispatch_assignment_events/i);
    assert.match(sql, /expires_at timestamptz not null/i);
    assert.match(sql, /status='offered' and ro\.expires_at <= now\(\)/i);
    assert.match(sql, /for update of ro skip locked/i);
    assert.match(sql, /not exists \(\s*select 1 from rider_offers ro\s*where ro\.dispatch_event_id=v_event\.id and ro\.rider_id=r\.id/i);
    assert.match(sql, /v_order\.status <> 'ready' or v_order\.rider_id is not null/i);
    assert.match(sql, /update orders set rider_id=v_rider\.id,rider_name=v_rider\.name/i);
    assert.match(sql, /grant execute on function respond_to_rider_offer\(uuid,text\) to authenticated/i);
    assert.match(sql, /cron\.schedule\('process-rider-dispatch-timeouts','\* \* \* \* \*'/i);
    assert.match(sql, /alter publication supabase_realtime add table public\.rider_offers/i);
    assert.match(sql, /alter publication supabase_realtime add table public\.dispatch_assignment_events/i);
    assert.match(sql, /insert into notifications\(user_id,type,title,body,data\)/i);
    assert.match(sql, /event_type='ready_order'/i);
    assert.match(sql, /status='assigned'/i);
    assert.match(sql, /status='exhausted'/i);
    assert.match(sql, /create or replace function request_rider_dispatch\(\)/i);
    assert.match(api, /request_rider_dispatch/i);
    
    assert.match(api, /from\('rider_offers'\)/i);
    assert.match(api, /respond_to_rider_offer/i);
    assert.match(rider, /rider-dispatch-offers-/i);
    assert.match(rider, /table: 'rider_offers'/i);
    assert.match(layout, /rider-dispatch-badge-/i);
  });
});

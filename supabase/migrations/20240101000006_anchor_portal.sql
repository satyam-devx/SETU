-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — Phase 0: Anchor Portal Tables
-- Migration: 006_anchor_portal.sql
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- NOTICEBOARD
-- Village-scoped notices posted by the anchor.
-- ─────────────────────────────────────────────────────────
create table if not exists noticeboard (
  id          uuid        primary key default uuid_generate_v4(),
  village_id  text        not null references villages(id) on delete cascade,
  title       text        not null,
  body        text        not null,
  type        text        not null default 'general'
                check (type in ('general','scheme','event','alert')),
  is_pinned   boolean     not null default false,
  created_by  uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_noticeboard_village_id on noticeboard(village_id);
create index if not exists idx_noticeboard_created_at on noticeboard(created_at desc);
create index if not exists idx_noticeboard_is_pinned  on noticeboard(is_pinned) where is_pinned = true;

drop trigger if exists trg_noticeboard_updated_at on noticeboard;
create trigger trg_noticeboard_updated_at before update on noticeboard
  for each row execute function update_updated_at();

-- RLS
alter table noticeboard enable row level security;

-- Anchors can read/write notices for their own village
create policy "anchor_noticeboard_select" on noticeboard
  for select using (
    village_id = (
      select village_id from profiles where id = auth.uid() limit 1
    )
  );

create policy "anchor_noticeboard_insert" on noticeboard
  for insert with check (
    created_by = auth.uid()
    and village_id = (
      select village_id from profiles where id = auth.uid() limit 1
    )
    and exists (
      select 1 from profiles where id = auth.uid() and role = 'anchor'
    )
  );

create policy "anchor_noticeboard_delete" on noticeboard
  for delete using (
    created_by = auth.uid()
  );

-- Admins / super_admins can see all
create policy "admin_noticeboard_all" on noticeboard
  for all using (
    exists (
      select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')
    )
  );


-- ─────────────────────────────────────────────────────────
-- DISPUTES
-- Order-level disputes reported and mediated by the anchor.
-- ─────────────────────────────────────────────────────────
create table if not exists disputes (
  id          uuid        primary key default uuid_generate_v4(),
  order_id    uuid        references orders(id) on delete set null,
  reporter_id uuid        not null references auth.users(id) on delete cascade,
  village_id  text        not null references villages(id) on delete cascade,
  status      text        not null default 'open'
                check (status in ('open','under_review','resolved','escalated')),
  title       text        not null,
  description text        not null,
  amount      numeric(10,2),
  resolution  text,
  resolved_by uuid        references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_disputes_village_id  on disputes(village_id);
create index if not exists idx_disputes_status      on disputes(status);
create index if not exists idx_disputes_reporter_id on disputes(reporter_id);
create index if not exists idx_disputes_order_id    on disputes(order_id);

drop trigger if exists trg_disputes_updated_at on disputes;
create trigger trg_disputes_updated_at before update on disputes
  for each row execute function update_updated_at();

-- Dispute parties (links customers/vendors/riders to a dispute)
create table if not exists dispute_parties (
  id          uuid primary key default uuid_generate_v4(),
  dispute_id  uuid not null references disputes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('reporter','accused','witness')),
  statement   text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_dispute_parties_dispute_id on dispute_parties(dispute_id);
create index if not exists idx_dispute_parties_user_id    on dispute_parties(user_id);

-- RLS for disputes
alter table disputes enable row level security;
alter table dispute_parties enable row level security;

-- Anchors see disputes in their village
create policy "anchor_disputes_select" on disputes
  for select using (
    village_id = (
      select village_id from profiles where id = auth.uid() limit 1
    )
  );

-- Anchors can update disputes in their village (resolve etc.)
create policy "anchor_disputes_update" on disputes
  for update using (
    village_id = (
      select village_id from profiles where id = auth.uid() limit 1
    )
    and exists (
      select 1 from profiles where id = auth.uid() and role = 'anchor'
    )
  );

-- Any authenticated user can file a dispute in their village
create policy "user_disputes_insert" on disputes
  for insert with check (
    reporter_id = auth.uid()
    and village_id = (
      select village_id from profiles where id = auth.uid() limit 1
    )
  );

-- Admins see all
create policy "admin_disputes_all" on disputes
  for all using (
    exists (
      select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')
    )
  );

-- Dispute parties policies
create policy "anchor_dispute_parties_select" on dispute_parties
  for select using (
    exists (
      select 1 from disputes d
      where d.id = dispute_id
        and d.village_id = (
          select village_id from profiles where id = auth.uid() limit 1
        )
    )
  );

create policy "dispute_parties_insert" on dispute_parties
  for insert with check (
    exists (
      select 1 from disputes d
      where d.id = dispute_id
        and d.reporter_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────
-- ESCALATIONS
-- Disputes or issues escalated by the anchor to admin.
-- ─────────────────────────────────────────────────────────
create table if not exists escalations (
  id           uuid        primary key default uuid_generate_v4(),
  dispute_id   uuid        references disputes(id) on delete cascade,
  escalated_by uuid        not null references auth.users(id) on delete cascade,
  escalated_to uuid        references auth.users(id) on delete set null,
  village_id   text        not null references villages(id) on delete cascade,
  status       text        not null default 'open'
                 check (status in ('open','acknowledged','in_progress','resolved')),
  priority     text        not null default 'medium'
                 check (priority in ('low','medium','high','critical')),
  title        text        not null,
  description  text        not null,
  notes        text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_escalations_village_id   on escalations(village_id);
create index if not exists idx_escalations_dispute_id   on escalations(dispute_id);
create index if not exists idx_escalations_status       on escalations(status);
create index if not exists idx_escalations_escalated_by on escalations(escalated_by);

drop trigger if exists trg_escalations_updated_at on escalations;
create trigger trg_escalations_updated_at before update on escalations
  for each row execute function update_updated_at();

-- RLS for escalations
alter table escalations enable row level security;

-- Anchors see escalations they created
create policy "anchor_escalations_select" on escalations
  for select using (
    escalated_by = auth.uid()
    or village_id = (
      select village_id from profiles where id = auth.uid() limit 1
    )
  );

-- Anchors can create escalations
create policy "anchor_escalations_insert" on escalations
  for insert with check (
    escalated_by = auth.uid()
    and exists (
      select 1 from profiles where id = auth.uid() and role = 'anchor'
    )
  );

-- Anchors can update their own escalations (add notes)
create policy "anchor_escalations_update" on escalations
  for update using (
    escalated_by = auth.uid()
  );

-- Admins see all and can update
create policy "admin_escalations_all" on escalations
  for all using (
    exists (
      select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')
    )
  );

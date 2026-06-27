-- ═══════════════════════════════════════════════════════════════
-- Migration 040: seed the village catalog
--
-- The villages table had no seed in the migration tree, so after the
-- production reset it was empty — the onboarding village selector
-- (/onboarding/register) had no options and new users could not pick a
-- village or proceed. profiles.village_id is an FK to villages(id), so
-- the options must exist in the DB (the UI can't hardcode them).
--
-- Seed the Madhepur-block villages. Idempotent.
-- ═══════════════════════════════════════════════════════════════

insert into villages (id, name, block, district, state, is_active) values
  ('prasad',          'Prasad',          'Madhepur', 'Madhubani', 'Bihar', true),
  ('banki',           'Banki',           'Madhepur', 'Madhubani', 'Bihar', true),
  ('khajura',         'Khajura',         'Madhepur', 'Madhubani', 'Bihar', true),
  ('madhepur',        'Madhepur',        'Madhepur', 'Madhubani', 'Bihar', true),
  ('pachahi',         'Pachahi',         'Madhepur', 'Madhubani', 'Bihar', true),
  ('laufa',           'Laufa',           'Madhepur', 'Madhubani', 'Bihar', true),
  ('umri',            'Umri',            'Madhepur', 'Madhubani', 'Bihar', true),
  ('bhit_bhagwanpur', 'Bhit Bhagwanpur', 'Madhepur', 'Madhubani', 'Bihar', true)
on conflict (id) do nothing;

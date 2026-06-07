-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — SEED DATA (Madhepur, Madhubani)
-- Run after schema.sql and rls.sql
-- NOTE: Demo auth users must be created first via Supabase Auth
--       or via the Supabase dashboard before foreign key refs work.
--       This seed uses fixed UUIDs for demo accounts.
-- ═══════════════════════════════════════════════════════════

-- ── DEMO USER UUIDs (create these in Supabase Auth first) ─
-- customer : a0000000-0000-0000-0000-000000000001  +91 9876543200
-- vendor   : a0000000-0000-0000-0000-000000000002  +91 9876543201
-- rider    : a0000000-0000-0000-0000-000000000003  +91 9876543202
-- admin    : a0000000-0000-0000-0000-000000000004  +91 9876543203
-- superadmin:a0000000-0000-0000-0000-000000000005  +91 9876543204

-- ─────────────────────────────────────────────────────────
-- VILLAGES
-- ─────────────────────────────────────────────────────────
insert into villages (id, name, block, district, state, population, lat, lng, is_active)
values
  ('v1', 'Madhepur',    'Madhepur',    'Madhubani', 'Bihar', 12000, 26.350000, 86.070000, true),
  ('v2', 'Laxmipur',   'Madhepur',    'Madhubani', 'Bihar',  8000, 26.370000, 86.090000, true),
  ('v3', 'Parsad',     'Madhepur',    'Madhubani', 'Bihar',  5500, 26.330000, 86.050000, true),
  ('v4', 'Jhanjharpur','Jhanjharpur', 'Madhubani', 'Bihar', 25000, 26.260000, 86.280000, true),
  ('v5', 'Rajnagar',   'Rajnagar',    'Madhubani', 'Bihar',  9000, 26.420000, 86.150000, false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- DEMO PROFILES
-- ─────────────────────────────────────────────────────────
insert into profiles (id, phone, name, role, village_id, is_verified, setu_score)
values
  ('a0000000-0000-0000-0000-000000000001', '+91 9876543200', 'Anita Devi',     'customer',    'v1', true,  720),
  ('a0000000-0000-0000-0000-000000000002', '+91 9876543201', 'Ramesh Kumar',   'vendor',      'v1', true,  680),
  ('a0000000-0000-0000-0000-000000000003', '+91 9876543202', 'Suraj Kumar',    'rider',       'v1', true,  750),
  ('a0000000-0000-0000-0000-000000000004', '+91 9876543203', 'Admin User',     'admin',       'v1', true,  800),
  ('a0000000-0000-0000-0000-000000000005', '+91 9876543204', 'Super Admin',    'super_admin', 'v1', true,  900)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────────────────
insert into categories (id, name, icon, sort_order)
values
  ('c1',  'Grocery & Essentials', '🛒', 1),
  ('c2',  'Makhana & Dry Fruits', '🥜', 2),
  ('c3',  'Fresh Vegetables',     '🥬', 3),
  ('c4',  'Dairy & Milk',         '🥛', 4),
  ('c5',  'Fish & Meat',          '🐟', 5),
  ('c6',  'Sweets & Snacks',      '🍬', 6),
  ('c7',  'Clothing & Textiles',  '👕', 7),
  ('c8',  'Electronics',          '📱', 8),
  ('c9',  'Farm Supplies',        '🌾', 9),
  ('c10', 'Health & Medicine',    '💊', 10)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- VENDORS (owner_id references demo vendor user)
-- ─────────────────────────────────────────────────────────
insert into vendors (id, owner_id, name, category, village_id, village, rating, review_count,
                     is_open, is_verified, is_active, delivery_radius, subscription_tier, trust_score,
                     image_url, lat, lng)
values
  ('11000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000002',
   'Ramesh Kirana Store', 'Grocery & Essentials', 'v1', 'Madhepur',
   4.5, 128, true, true, true, 3.0, 'pro', 780,
   'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400',
   26.351, 86.071),

  ('11000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000002',
   'Lakshmi Makhana Traders', 'Makhana & Dry Fruits', 'v1', 'Madhepur',
   4.8, 256, true, true, true, 5.0, 'pro', 820,
   'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400',
   26.352, 86.072),

  ('11000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000002',
   'Sunita Fresh Vegetables', 'Fresh Vegetables', 'v2', 'Laxmipur',
   4.3, 89, true, true, true, 2.0, 'free', 620,
   'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400',
   26.371, 86.091),

  ('11000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000002',
   'Gopal Dairy Farm', 'Dairy & Milk', 'v3', 'Parsad',
   4.7, 175, false, true, true, 4.0, 'pro', 760,
   'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400',
   26.331, 86.051),

  ('11000000-0000-0000-0000-000000000005',
   'a0000000-0000-0000-0000-000000000002',
   'Bihar Fish Market', 'Fish & Meat', 'v1', 'Madhepur',
   4.1, 67, true, false, true, 3.0, 'free', 530,
   'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=400',
   26.353, 86.073),

  ('11000000-0000-0000-0000-000000000006',
   'a0000000-0000-0000-0000-000000000002',
   'Mithila Sweets', 'Sweets & Snacks', 'v1', 'Madhepur',
   4.9, 312, true, true, true, 5.0, 'pro', 870,
   'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400',
   26.354, 86.074)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────────────────
insert into products (id, vendor_id, name, name_hindi, price, mrp, unit, stock,
                      category, category_id, image_url, is_available)
values
  ('22000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'Basmati Rice (5kg)', 'बासमती चावल', 450, 520, 'bag', 25,
   'Grocery & Essentials', 'c1',
   'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300', true),

  ('22000000-0000-0000-0000-000000000002',
   '11000000-0000-0000-0000-000000000001',
   'Mustard Oil (1L)', 'सरसों का तेल', 180, 210, 'bottle', 40,
   'Grocery & Essentials', 'c1',
   'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300', true),

  ('22000000-0000-0000-0000-000000000003',
   '11000000-0000-0000-0000-000000000002',
   'Premium Makhana (1kg)', 'प्रीमियम मखाना', 650, 800, 'kg', 100,
   'Makhana & Dry Fruits', 'c2',
   'https://images.unsplash.com/photo-1599599810694-b5b37304c041?w=300', true),

  ('22000000-0000-0000-0000-000000000004',
   '11000000-0000-0000-0000-000000000002',
   'Cashew Nuts (500g)', 'काजू', 420, 500, 'pack', 30,
   'Makhana & Dry Fruits', 'c2',
   'https://images.unsplash.com/photo-1563292769-4e05b684851a?w=300', true),

  ('22000000-0000-0000-0000-000000000005',
   '11000000-0000-0000-0000-000000000003',
   'Fresh Tomatoes (1kg)', 'टमाटर', 40, 40, 'kg', 50,
   'Fresh Vegetables', 'c3',
   'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=300', true),

  ('22000000-0000-0000-0000-000000000006',
   '11000000-0000-0000-0000-000000000003',
   'Green Peas (500g)', 'मटर', 35, 35, 'kg', 20,
   'Fresh Vegetables', 'c3',
   'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=300', true),

  ('22000000-0000-0000-0000-000000000007',
   '11000000-0000-0000-0000-000000000004',
   'Fresh Cow Milk (1L)', 'गाय का दूध', 60, 60, 'litre', 80,
   'Dairy & Milk', 'c4',
   'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300', true),

  ('22000000-0000-0000-0000-000000000008',
   '11000000-0000-0000-0000-000000000006',
   'Thekua (12 pcs)', 'ठेकुआ', 120, 150, 'box', 15,
   'Sweets & Snacks', 'c6',
   'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300', true),

  ('22000000-0000-0000-0000-000000000009',
   '11000000-0000-0000-0000-000000000001',
   'Atta Flour (10kg)', 'आटा', 380, 420, 'bag', 35,
   'Grocery & Essentials', 'c1',
   'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300', true),

  ('22000000-0000-0000-0000-000000000010',
   '11000000-0000-0000-0000-000000000001',
   'Sugar (2kg)', 'चीनी', 90, 100, 'bag', 60,
   'Grocery & Essentials', 'c1',
   'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300', true)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- RIDERS
-- ─────────────────────────────────────────────────────────
insert into riders (id, user_id, name, phone, village_id, village, zone,
                    vehicle_type, is_online, is_active, is_verified,
                    rating, total_deliveries, today_deliveries, today_earnings,
                    total_earnings, cod_balance)
values
  ('33000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000003',
   'Suraj Kumar', '+91 98765 43210', 'v1', 'Madhepur', 'Madhepur Central',
   'Bike', true, true, true,
   4.6, 342, 8, 640, 28500, 1200),

  ('33000000-0000-0000-0000-000000000002',
   null,
   'Vikash Yadav', '+91 98765 43211', 'v2', 'Laxmipur', 'Laxmipur East',
   'Bike', true, true, true,
   4.8, 518, 12, 960, 42300, 800),

  ('33000000-0000-0000-0000-000000000003',
   null,
   'Amit Singh', '+91 98765 43212', 'v3', 'Parsad', 'Parsad South',
   'Bicycle', false, true, true,
   4.4, 189, 0, 0, 15600, 0)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- SEVA PROVIDERS
-- ─────────────────────────────────────────────────────────
insert into seva_providers (id, user_id, name, category, skills, village_id, village,
                             phone, rating, review_count, is_available, is_verified,
                             hourly_rate, experience, jobs_completed, image_url)
values
  ('44000000-0000-0000-0000-000000000001',
   null, 'Rajesh Electrician', 'Electrician',
   array['Wiring','MCB','Solar Installation'],
   'v1', 'Madhepur', '+91 98765 43220',
   4.7, 85, true, true, 300, '8 years', 156,
   'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300'),

  ('44000000-0000-0000-0000-000000000002',
   null, 'Sunita Tailor', 'Tailoring',
   array['Blouse','Suit','Alterations'],
   'v2', 'Laxmipur', '+91 98765 43221',
   4.9, 142, true, true, 250, '12 years', 298,
   'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300'),

  ('44000000-0000-0000-0000-000000000003',
   null, 'Mohan Plumber', 'Plumber',
   array['Pipe Fitting','Pump Installation','Drainage'],
   'v1', 'Madhepur', '+91 98765 43222',
   4.3, 45, false, true, 350, '5 years', 87,
   'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=300'),

  ('44000000-0000-0000-0000-000000000004',
   null, 'Rina Beauty Salon', 'Beauty',
   array['Bridal','Hair','Mehendi'],
   'v1', 'Madhepur', '+91 98765 43223',
   4.6, 210, true, true, 400, '6 years', 412,
   'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300'),

  ('44000000-0000-0000-0000-000000000005',
   null, 'Anil Kumar Tutor', 'Tutoring',
   array['Maths','Science','English'],
   'v3', 'Parsad', '+91 98765 43224',
   4.8, 95, true, true, 200, '10 years', 520,
   'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=300')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- DEMO ORDERS (uses demo customer UUID)
-- ─────────────────────────────────────────────────────────
insert into orders (id, order_number, customer_id, customer_name, vendor_id, vendor_name,
                    rider_id, rider_name, village_id, village, status,
                    payment_method, payment_status, subtotal, delivery_fee,
                    platform_fee, total, is_cod, created_at, delivered_at)
values
  ('55000000-0000-0000-0000-000000000001',
   'SETU-2025-0001',
   'a0000000-0000-0000-0000-000000000001', 'Anita Devi',
   '11000000-0000-0000-0000-000000000001', 'Ramesh Kirana Store',
   '33000000-0000-0000-0000-000000000001', 'Suraj Kumar',
   'v1', 'Madhepur', 'delivered',
   'COD', 'collected', 630, 20, 10, 660, true,
   '2025-05-30T10:30:00Z', '2025-05-30T11:15:00Z'),

  ('55000000-0000-0000-0000-000000000002',
   'SETU-2025-0002',
   'a0000000-0000-0000-0000-000000000001', 'Anita Devi',
   '11000000-0000-0000-0000-000000000002', 'Lakshmi Makhana Traders',
   '33000000-0000-0000-0000-000000000002', 'Vikash Yadav',
   'v2', 'Laxmipur', 'on_the_way',
   'UPI', 'paid', 1070, 30, 15, 1115, false,
   '2025-05-31T09:00:00Z', null),

  ('55000000-0000-0000-0000-000000000003',
   'SETU-2025-0003',
   'a0000000-0000-0000-0000-000000000001', 'Anita Devi',
   '11000000-0000-0000-0000-000000000001', 'Ramesh Kirana Store',
   null, null,
   'v1', 'Madhepur', 'pending',
   'COD', 'pending', 470, 20, 10, 500, true,
   '2025-05-31T10:00:00Z', null)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- ORDER ITEMS for demo orders
-- ─────────────────────────────────────────────────────────
insert into order_items (order_id, product_id, name, qty, price)
values
  ('55000000-0000-0000-0000-000000000001',
   '22000000-0000-0000-0000-000000000001', 'Basmati Rice (5kg)', 1, 450),
  ('55000000-0000-0000-0000-000000000001',
   '22000000-0000-0000-0000-000000000002', 'Mustard Oil (1L)', 1, 180),
  ('55000000-0000-0000-0000-000000000002',
   '22000000-0000-0000-0000-000000000003', 'Premium Makhana (1kg)', 1, 650),
  ('55000000-0000-0000-0000-000000000002',
   '22000000-0000-0000-0000-000000000004', 'Cashew Nuts (500g)', 1, 420),
  ('55000000-0000-0000-0000-000000000003',
   '22000000-0000-0000-0000-000000000009', 'Atta Flour (10kg)', 1, 380),
  ('55000000-0000-0000-0000-000000000003',
   '22000000-0000-0000-0000-000000000010', 'Sugar (2kg)', 1, 90)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────
-- WALLETS for demo users
-- ─────────────────────────────────────────────────────────
insert into wallets (user_id, balance)
values
  ('a0000000-0000-0000-0000-000000000001', 1250),
  ('a0000000-0000-0000-0000-000000000002', 3400),
  ('a0000000-0000-0000-0000-000000000003', 2100)
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────────────────────
-- CREDIT ACCOUNTS
-- ─────────────────────────────────────────────────────────
insert into credit_accounts (user_id, credit_limit, outstanding, repayment_rate, status, score)
values
  ('a0000000-0000-0000-0000-000000000001', 5000, 1200, 98, 'active', 720),
  ('a0000000-0000-0000-0000-000000000002', 25000, 8000, 96, 'active', 740)
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────────────────────
-- SCHEMES
-- ─────────────────────────────────────────────────────────
insert into schemes (id, name, description, category, benefit, how_to_apply, deadline)
values
  ('sch1', 'PM Kisan Samman Nidhi',
   'Annual ₹6,000 income support for small farmers',
   'Agriculture', '₹6,000/year',
   'Visit gram panchayat with Aadhaar and land records', 'Ongoing'),
  ('sch2', 'Ayushman Bharat',
   'Free health insurance up to ₹5 lakh per family',
   'Health', '₹5 lakh/year for family',
   'Check eligibility at Ayushman portal with Aadhaar', 'Ongoing'),
  ('sch3', 'PM Ujjwala Yojana',
   'Free LPG connection for BPL families',
   'Energy', 'Free LPG connection',
   'Apply at nearest gas agency with BPL card and Aadhaar', 'Jun 30, 2025')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- NOTIFICATIONS for demo customer
-- ─────────────────────────────────────────────────────────
insert into notifications (user_id, type, title, body, is_read, created_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'order',
   'Order Delivered!',
   'Your order SETU-2025-0001 has been delivered.',
   true, '2025-05-30T11:15:00Z'),
  ('a0000000-0000-0000-0000-000000000001', 'promo',
   'Festival Special! 🎉',
   'Get 20% off on all Makhana products this Chhath season.',
   false, '2025-05-31T08:00:00Z'),
  ('a0000000-0000-0000-0000-000000000001', 'credit',
   'SETU Credit Approved',
   'Your SETU Credit limit of ₹5,000 has been approved.',
   false, '2025-05-31T07:30:00Z'),
  ('a0000000-0000-0000-0000-000000000001', 'order',
   'Order On The Way',
   'Vikash Yadav is delivering your order SETU-2025-0002.',
   false, '2025-05-31T09:30:00Z')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────
-- AUDIT LOG seed entries
-- ─────────────────────────────────────────────────────────
insert into audit_log (actor_id, actor, action, target, detail, created_at)
values
  ('a0000000-0000-0000-0000-000000000004',
   'Admin User', 'vendor_approved', 'Ramesh Kirana Store', null, '2025-05-31T09:00:00Z'),
  (null,
   'System', 'fraud_alert', 'Order SETU-2025-0007', 'Velocity check triggered', '2025-05-29T14:10:00Z'),
  ('a0000000-0000-0000-0000-000000000005',
   'Super Admin', 'config_updated', 'Platform Fee', 'Changed 2% → 2.5%', '2025-05-30T16:00:00Z')
on conflict do nothing;

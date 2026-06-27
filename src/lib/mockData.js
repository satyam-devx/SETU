// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — COMPLETE MOCK DATA
// ═══════════════════════════════════════════════════════════

export const VILLAGES = [
  { id: 'prasad',          name: 'Prasad',          block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
  { id: 'banki',           name: 'Banki',           block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
  { id: 'khajura',         name: 'Khajura',         block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
  { id: 'madhepur',        name: 'Madhepur',        block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
  { id: 'pachahi',         name: 'Pachahi',         block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
  { id: 'laufa',           name: 'Laufa',           block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
  { id: 'umri',            name: 'Umri',            block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
  { id: 'bhit_bhagwanpur', name: 'Bhit Bhagwanpur', block: 'Madhepur', district: 'Madhubani', population: 0, isActive: true },
];

export const CATEGORIES = [
  { id: 'c1', name: 'Grocery & Essentials', icon: '🛒', count: 45 },
  { id: 'c2', name: 'Makhana & Dry Fruits', icon: '🥜', count: 18 },
  { id: 'c3', name: 'Fresh Vegetables', icon: '🥬', count: 32 },
  { id: 'c4', name: 'Dairy & Milk', icon: '🥛', count: 12 },
  { id: 'c5', name: 'Fish & Meat', icon: '🐟', count: 8 },
  { id: 'c6', name: 'Sweets & Snacks', icon: '🍬', count: 22 },
  { id: 'c7', name: 'Clothing & Textiles', icon: '👕', count: 15 },
  { id: 'c8', name: 'Electronics', icon: '📱', count: 10 },
  { id: 'c9', name: 'Farm Supplies', icon: '🌾', count: 20 },
  { id: 'c10', name: 'Health & Medicine', icon: '💊', count: 14 },
];

export const VENDORS = [
  { id: 'vn1', name: 'Ramesh Kirana Store', category: 'Grocery & Essentials', village: 'Madhepur', rating: 4.5, reviewCount: 128, isOpen: true, isVerified: true, image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400', deliveryRadius: 3, subscriptionTier: 'pro' },
  { id: 'vn2', name: 'Lakshmi Makhana Traders', category: 'Makhana & Dry Fruits', village: 'Madhepur', rating: 4.8, reviewCount: 256, isOpen: true, isVerified: true, image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400', deliveryRadius: 5, subscriptionTier: 'pro' },
  { id: 'vn3', name: 'Sunita Fresh Vegetables', category: 'Fresh Vegetables', village: 'Laxmipur', rating: 4.3, reviewCount: 89, isOpen: true, isVerified: true, image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400', deliveryRadius: 2, subscriptionTier: 'free' },
  { id: 'vn4', name: 'Gopal Dairy Farm', category: 'Dairy & Milk', village: 'Parsad', rating: 4.7, reviewCount: 175, isOpen: false, isVerified: true, image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', deliveryRadius: 4, subscriptionTier: 'pro' },
  { id: 'vn5', name: 'Bihar Fish Market', category: 'Fish & Meat', village: 'Madhepur', rating: 4.1, reviewCount: 67, isOpen: true, isVerified: false, image: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=400', deliveryRadius: 3, subscriptionTier: 'free' },
  { id: 'vn6', name: 'Mithila Sweets', category: 'Sweets & Snacks', village: 'Madhepur', rating: 4.9, reviewCount: 312, isOpen: true, isVerified: true, image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400', deliveryRadius: 5, subscriptionTier: 'pro' },
];

export const PRODUCTS = [
  { id: 'p1', vendorId: 'vn1', name: 'Basmati Rice (5kg)', nameHindi: 'बासमती चावल', price: 450, mrp: 520, unit: 'bag', stock: 25, category: 'Grocery & Essentials', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300', isAvailable: true },
  { id: 'p2', vendorId: 'vn1', name: 'Mustard Oil (1L)', nameHindi: 'सरसों का तेल', price: 180, mrp: 210, unit: 'bottle', stock: 40, category: 'Grocery & Essentials', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300', isAvailable: true },
  { id: 'p3', vendorId: 'vn2', name: 'Premium Makhana (1kg)', nameHindi: 'प्रीमियम मखाना', price: 650, mrp: 800, unit: 'kg', stock: 100, category: 'Makhana & Dry Fruits', image: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?w=300', isAvailable: true, isSeasonal: true },
  { id: 'p4', vendorId: 'vn2', name: 'Cashew Nuts (500g)', nameHindi: 'काजू', price: 420, mrp: 500, unit: 'pack', stock: 30, category: 'Makhana & Dry Fruits', image: 'https://images.unsplash.com/photo-1563292769-4e05b684851a?w=300', isAvailable: true },
  { id: 'p5', vendorId: 'vn3', name: 'Fresh Tomatoes (1kg)', nameHindi: 'टमाटर', price: 40, mrp: 40, unit: 'kg', stock: 50, category: 'Fresh Vegetables', image: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=300', isAvailable: true },
  { id: 'p6', vendorId: 'vn3', name: 'Green Peas (500g)', nameHindi: 'मटर', price: 35, mrp: 35, unit: 'kg', stock: 20, category: 'Fresh Vegetables', image: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=300', isAvailable: true },
  { id: 'p7', vendorId: 'vn4', name: 'Fresh Cow Milk (1L)', nameHindi: 'गाय का दूध', price: 60, mrp: 60, unit: 'litre', stock: 80, category: 'Dairy & Milk', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300', isAvailable: true },
  { id: 'p8', vendorId: 'vn6', name: 'Thekua (12 pcs)', nameHindi: 'ठेकुआ', price: 120, mrp: 150, unit: 'box', stock: 15, category: 'Sweets & Snacks', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300', isAvailable: true },
  { id: 'p9', vendorId: 'vn1', name: 'Atta Flour (10kg)', nameHindi: 'आटा', price: 380, mrp: 420, unit: 'bag', stock: 35, category: 'Grocery & Essentials', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300', isAvailable: true },
  { id: 'p10', vendorId: 'vn1', name: 'Sugar (2kg)', nameHindi: 'चीनी', price: 90, mrp: 100, unit: 'bag', stock: 60, category: 'Grocery & Essentials', image: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300', isAvailable: true },
];

export const ORDERS = [
  { id: 'o1', orderNumber: 'SETU-2025-0001', customerId: 'u1', customerName: 'Anita Devi', vendorId: 'vn1', vendorName: 'Ramesh Kirana Store', riderId: 'r1', riderName: 'Suraj Kumar', status: 'delivered', paymentMethod: 'COD', paymentStatus: 'collected', subtotal: 630, deliveryFee: 20, platformFee: 10, total: 660, items: [{name: 'Basmati Rice (5kg)', qty: 1, price: 450}, {name: 'Mustard Oil (1L)', qty: 1, price: 180}], createdAt: '2025-05-30T10:30:00', deliveredAt: '2025-05-30T11:15:00', village: 'Madhepur' },
  { id: 'o2', orderNumber: 'SETU-2025-0002', customerId: 'u2', customerName: 'Raj Kumar', vendorId: 'vn2', vendorName: 'Lakshmi Makhana Traders', riderId: 'r2', riderName: 'Vikash Yadav', status: 'on_the_way', paymentMethod: 'UPI', paymentStatus: 'paid', subtotal: 1070, deliveryFee: 30, platformFee: 15, total: 1115, items: [{name: 'Premium Makhana (1kg)', qty: 1, price: 650}, {name: 'Cashew Nuts (500g)', qty: 1, price: 420}], createdAt: '2025-05-31T09:00:00', village: 'Laxmipur' },
  { id: 'o3', orderNumber: 'SETU-2025-0003', customerId: 'u3', customerName: 'Priya Singh', vendorId: 'vn3', vendorName: 'Sunita Fresh Vegetables', riderId: null, riderName: null, status: 'preparing', paymentMethod: 'COD', paymentStatus: 'pending', subtotal: 115, deliveryFee: 15, platformFee: 5, total: 135, items: [{name: 'Fresh Tomatoes (1kg)', qty: 2, price: 80}, {name: 'Green Peas (500g)', qty: 1, price: 35}], createdAt: '2025-05-31T09:30:00', village: 'Madhepur' },
  { id: 'o4', orderNumber: 'SETU-2025-0004', customerId: 'u4', customerName: 'Mohan Lal', vendorId: 'vn6', vendorName: 'Mithila Sweets', riderId: 'r1', riderName: 'Suraj Kumar', status: 'picked_up', paymentMethod: 'UPI', paymentStatus: 'paid', subtotal: 360, deliveryFee: 20, platformFee: 10, total: 390, items: [{name: 'Thekua (12 pcs)', qty: 3, price: 360}], createdAt: '2025-05-31T08:45:00', village: 'Parsad' },
  { id: 'o5', orderNumber: 'SETU-2025-0005', customerId: 'u1', customerName: 'Anita Devi', vendorId: 'vn1', vendorName: 'Ramesh Kirana Store', riderId: null, riderName: null, status: 'pending', paymentMethod: 'COD', paymentStatus: 'pending', subtotal: 470, deliveryFee: 20, platformFee: 10, total: 500, items: [{name: 'Atta Flour (10kg)', qty: 1, price: 380}, {name: 'Sugar (2kg)', qty: 1, price: 90}], createdAt: '2025-05-31T10:00:00', village: 'Madhepur' },
  { id: 'o6', orderNumber: 'SETU-2025-0006', customerId: 'u5', customerName: 'Rekha Kumari', vendorId: 'vn4', vendorName: 'Gopal Dairy Farm', riderId: 'r2', riderName: 'Vikash Yadav', status: 'delivered', paymentMethod: 'UPI', paymentStatus: 'paid', subtotal: 180, deliveryFee: 15, platformFee: 5, total: 200, items: [{name: 'Fresh Cow Milk (1L)', qty: 3, price: 180}], createdAt: '2025-05-30T07:00:00', deliveredAt: '2025-05-30T07:30:00', village: 'Laxmipur' },
  { id: 'o7', orderNumber: 'SETU-2025-0007', customerId: 'u2', customerName: 'Raj Kumar', vendorId: 'vn1', vendorName: 'Ramesh Kirana Store', riderId: 'r1', riderName: 'Suraj Kumar', status: 'cancelled', paymentMethod: 'COD', paymentStatus: 'refunded', subtotal: 450, deliveryFee: 20, platformFee: 10, total: 480, items: [{name: 'Basmati Rice (5kg)', qty: 1, price: 450}], createdAt: '2025-05-29T14:00:00', cancelledAt: '2025-05-29T14:15:00', cancelReason: 'Customer requested cancellation', village: 'Madhepur' },
];

export const RIDERS = [
  { id: 'r1', name: 'Suraj Kumar', phone: '+91 98765 43210', village: 'Madhepur', zone: 'Madhepur Central', isOnline: true, isActive: true, rating: 4.6, totalDeliveries: 342, todayDeliveries: 8, todayEarnings: 640, totalEarnings: 28500, vehicleType: 'Bike', codBalance: 1200, lastLocation: { lat: 26.352, lng: 86.072 } },
  { id: 'r2', name: 'Vikash Yadav', phone: '+91 98765 43211', village: 'Laxmipur', zone: 'Laxmipur East', isOnline: true, isActive: true, rating: 4.8, totalDeliveries: 518, todayDeliveries: 12, todayEarnings: 960, totalEarnings: 42300, vehicleType: 'Bike', codBalance: 800, lastLocation: { lat: 26.371, lng: 86.091 } },
  { id: 'r3', name: 'Amit Singh', phone: '+91 98765 43212', village: 'Parsad', zone: 'Parsad South', isOnline: false, isActive: true, rating: 4.4, totalDeliveries: 189, todayDeliveries: 0, todayEarnings: 0, totalEarnings: 15600, vehicleType: 'Bicycle', codBalance: 0, lastLocation: { lat: 26.332, lng: 86.052 } },
];

export const SEVA_PROVIDERS = [
  { id: 'sp1', name: 'Rajesh Electrician', category: 'Electrician', village: 'Madhepur', rating: 4.7, reviewCount: 85, isAvailable: true, isVerified: true, hourlyRate: 300, experience: '8 years', phone: '+91 98765 43220', jobsCompleted: 156, image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300' },
  { id: 'sp2', name: 'Sunita Tailor', category: 'Tailoring', village: 'Laxmipur', rating: 4.9, reviewCount: 142, isAvailable: true, isVerified: true, hourlyRate: 250, experience: '12 years', phone: '+91 98765 43221', jobsCompleted: 298, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300' },
  { id: 'sp3', name: 'Mohan Plumber', category: 'Plumber', village: 'Madhepur', rating: 4.3, reviewCount: 45, isAvailable: false, isVerified: true, hourlyRate: 350, experience: '5 years', phone: '+91 98765 43222', jobsCompleted: 87, image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=300' },
  { id: 'sp4', name: 'Rina Beauty Salon', category: 'Beauty', village: 'Madhepur', rating: 4.6, reviewCount: 210, isAvailable: true, isVerified: true, hourlyRate: 400, experience: '6 years', phone: '+91 98765 43223', jobsCompleted: 412, image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300' },
  { id: 'sp5', name: 'Anil Kumar Tutor', category: 'Tutoring', village: 'Parsad', rating: 4.8, reviewCount: 95, isAvailable: true, isVerified: true, hourlyRate: 200, experience: '10 years', phone: '+91 98765 43224', jobsCompleted: 520, image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=300' },
];

export const NOTIFICATIONS = [
  { id: 'n1', type: 'order', title: 'Order Delivered!', body: 'Your order SETU-2025-0001 has been delivered.', isRead: true, createdAt: '2025-05-30T11:15:00' },
  { id: 'n2', type: 'promo', title: 'Festival Special! 🎉', body: 'Get 20% off on all Makhana products this Chhath season.', isRead: false, createdAt: '2025-05-31T08:00:00' },
  { id: 'n3', type: 'credit', title: 'SETU Credit Approved', body: 'Your SETU Credit limit of ₹5,000 has been approved.', isRead: false, createdAt: '2025-05-31T07:30:00' },
  { id: 'n4', type: 'order', title: 'Order On The Way', body: 'Vikash Yadav is delivering your order SETU-2025-0002.', isRead: false, createdAt: '2025-05-31T09:30:00' },
  { id: 'n5', type: 'system', title: 'Welcome to SETU!', body: 'Start exploring vendors near you in Madhepur.', isRead: true, createdAt: '2025-05-28T10:00:00' },
  { id: 'n6', type: 'scheme', title: 'PM Kisan Samman', body: 'Check if you are eligible for PM Kisan Samman Nidhi.', isRead: false, createdAt: '2025-05-31T06:00:00' },
];

export const WALLET = {
  balance: 1250,
  setuCredits: 350,
  creditLimit: 5000,
  creditUsed: 1200,
  creditScore: 720,
  transactions: [
    { id: 't1', type: 'credit', amount: 500, description: 'Wallet top-up via UPI', date: '2025-05-30', status: 'completed' },
    { id: 't2', type: 'debit', amount: 660, description: 'Order SETU-2025-0001 payment', date: '2025-05-30', status: 'completed' },
    { id: 't3', type: 'credit', amount: 200, description: 'Referral bonus — Raj Kumar', date: '2025-05-29', status: 'completed' },
    { id: 't4', type: 'debit', amount: 390, description: 'Order SETU-2025-0004 payment', date: '2025-05-31', status: 'pending' },
    { id: 't5', type: 'credit', amount: 1000, description: 'SETU Credit disbursement', date: '2025-05-28', status: 'completed' },
    { id: 't6', type: 'debit', amount: 200, description: 'Order SETU-2025-0006 payment', date: '2025-05-30', status: 'completed' },
  ],
};

export const SUPPORT_TICKETS = [
  { id: 'st1', subject: 'Wrong item delivered', orderId: 'SETU-2025-0001', status: 'resolved', priority: 'high', createdAt: '2025-05-30T12:00:00', messages: [{ from: 'customer', text: 'I ordered Basmati rice but received Sona Masoori.', time: '12:00' }, { from: 'support', text: 'We apologize. A replacement is being arranged.', time: '12:15' }] },
  { id: 'st2', subject: 'Delivery was late', orderId: 'SETU-2025-0006', status: 'open', priority: 'medium', createdAt: '2025-05-30T08:00:00', messages: [{ from: 'customer', text: 'My milk delivery was 30 minutes late.', time: '08:00' }] },
];

export const ANALYTICS_DATA = {
  daily: [
    { date: 'Mon', orders: 42, revenue: 18500, delivery: 38, cancelled: 4 },
    { date: 'Tue', orders: 55, revenue: 24200, delivery: 52, cancelled: 3 },
    { date: 'Wed', orders: 48, revenue: 21000, delivery: 45, cancelled: 3 },
    { date: 'Thu', orders: 62, revenue: 28400, delivery: 58, cancelled: 4 },
    { date: 'Fri', orders: 71, revenue: 32100, delivery: 68, cancelled: 3 },
    { date: 'Sat', orders: 88, revenue: 39600, delivery: 84, cancelled: 4 },
    { date: 'Sun', orders: 95, revenue: 42500, delivery: 90, cancelled: 5 },
  ],
  weekly: [
    { week: 'W1', orders: 320, revenue: 142000 },
    { week: 'W2', orders: 385, revenue: 171500 },
    { week: 'W3', orders: 410, revenue: 183000 },
    { week: 'W4', orders: 461, revenue: 206300 },
  ],
  categoryBreakdown: [
    { name: 'Grocery', value: 35, fill: 'hsl(24, 80%, 50%)' },
    { name: 'Makhana', value: 22, fill: 'hsl(150, 40%, 40%)' },
    { name: 'Vegetables', value: 18, fill: 'hsl(220, 60%, 50%)' },
    { name: 'Dairy', value: 12, fill: 'hsl(45, 80%, 55%)' },
    { name: 'Sweets', value: 8, fill: 'hsl(340, 65%, 50%)' },
    { name: 'Others', value: 5, fill: 'hsl(30, 10%, 60%)' },
  ],
  vendorPerformance: [
    { name: 'Ramesh Kirana', orders: 145, revenue: 65000, rating: 4.5 },
    { name: 'Lakshmi Makhana', orders: 120, revenue: 78000, rating: 4.8 },
    { name: 'Mithila Sweets', orders: 98, revenue: 42000, rating: 4.9 },
    { name: 'Sunita Vegetables', orders: 85, revenue: 28000, rating: 4.3 },
    { name: 'Gopal Dairy', orders: 72, revenue: 21600, rating: 4.7 },
  ],
  riderPerformance: [
    { name: 'Suraj Kumar', deliveries: 342, onTime: 95, rating: 4.6 },
    { name: 'Vikash Yadav', deliveries: 518, onTime: 97, rating: 4.8 },
    { name: 'Amit Singh', deliveries: 189, onTime: 88, rating: 4.4 },
  ],
};

export const ADMIN_STATS = {
  totalOrders: 461,
  todayOrders: 95,
  totalRevenue: 206300,
  todayRevenue: 42500,
  activeVendors: 48,
  totalVendors: 62,
  activeRiders: 12,
  totalRiders: 18,
  totalCustomers: 2450,
  newCustomersToday: 15,
  avgDeliveryTime: 28,
  deliverySuccessRate: 96.2,
  codCollected: 28500,
  codPending: 4200,
  pendingVendorApprovals: 5,
  openTickets: 8,
  criticalAlerts: 2,
  setuScore: 78,
};

export const SUPER_ADMIN_STATS = {
  ...ADMIN_STATS,
  totalBlocks: 5,
  activeBlocks: 3,
  totalDistricts: 1,
  totalGMV: 1850000,
  monthlyGMV: 825000,
  totalCreditDisbursed: 450000,
  creditOutstanding: 185000,
  defaultRate: 2.1,
  platformHealth: 94,
  apiUptime: 99.7,
  fraudAlerts: 3,
  complianceScore: 92,
};

export const SEVA_CATEGORIES = [
  { id: 'sc1', name: 'Electrician', icon: '⚡', providers: 8 },
  { id: 'sc2', name: 'Plumber', icon: '🔧', providers: 5 },
  { id: 'sc3', name: 'Tailoring', icon: '🧵', providers: 12 },
  { id: 'sc4', name: 'Beauty & Salon', icon: '💇', providers: 6 },
  { id: 'sc5', name: 'Tutoring', icon: '📚', providers: 15 },
  { id: 'sc6', name: 'Carpentry', icon: '🪚', providers: 4 },
  { id: 'sc7', name: 'Painting', icon: '🎨', providers: 3 },
  { id: 'sc8', name: 'Farming Help', icon: '🌾', providers: 10 },
];

export const SCHEMES = [
  { id: 'sch1', name: 'PM Kisan Samman Nidhi', description: 'Annual ₹6,000 income support for small farmers', eligible: true, status: 'active' },
  { id: 'sch2', name: 'Ayushman Bharat', description: 'Free health insurance up to ₹5 lakh per family', eligible: true, status: 'pending' },
  { id: 'sch3', name: 'PM Ujjwala Yojana', description: 'Free LPG connection for BPL families', eligible: false, status: 'not_applied' },
];

export const AUDIT_LOG = [
  { id: 'a1', actor: 'Admin User', action: 'Approved vendor', entity: 'Ramesh Kirana Store', timestamp: '2025-05-31T09:00:00' },
  { id: 'a2', actor: 'System', action: 'Fraud alert triggered', entity: 'Order SETU-2025-0007', timestamp: '2025-05-29T14:10:00' },
  { id: 'a3', actor: 'Super Admin', action: 'Updated platform fee', entity: 'Config', timestamp: '2025-05-30T16:00:00' },
  { id: 'a4', actor: 'Admin User', action: 'Assigned rider', entity: 'Order SETU-2025-0003', timestamp: '2025-05-31T09:35:00' },
  { id: 'a5', actor: 'System', action: 'Credit limit approved', entity: 'User Anita Devi', timestamp: '2025-05-31T07:30:00' },
];

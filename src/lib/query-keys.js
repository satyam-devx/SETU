// Canonical SETU server-state query keys — F1-A.
// Keep query identity here so cache invalidation and realtime integration
// never depend on ad-hoc strings scattered across pages.

export const queryKeys = {
  profile: {
    byUser: userId => ['profile', userId],
  },
  products: {
    all: ['products'],
    list: filters => ['products', filters ?? {}],
    detail: id => ['product', id],
    byVendor: vendorId => ['products', { vendorId }],
    byCategory: (categoryId, page = 0, limit = 20) => ['products', 'category', categoryId, page, limit],
    categories: productId => ['product-categories', productId],
  },
  categories: {
    all: ['categories'],
    previews: ['category-previews'],
    detail: id => ['category', id],
  },
  vendors: {
    all: ['vendors'],
    list: filters => ['vendors', filters ?? {}],
    byVillage: villageId => ['vendors', { villageId }],
    detail: id => ['vendor', id],
    byOwner: ownerId => ['vendor-owner', ownerId],
  },
  orders: {
    all: ['orders'],
    customer: userId => ['orders', 'customer', userId],
    vendor: vendorId => ['orders', 'vendor', vendorId],
    rider: riderId => ['orders', 'rider', riderId],
    detail: id => ['order', id],
  },
  kyc: {
    byUser: userId => ['kyc-records', userId],
  },
  rider: {
    byUser: userId => ['rider-user', userId],
    offers: riderId => ['rider-offers', riderId],
    earnings: (userId, period = 'month') => ['rider-earnings', userId, period],
    sos: riderId => ['rider-sos', riderId],
  },
  notifications: {
    list: userId => ['notifications', userId],
  },
  addresses: {
    customer: userId => ['addresses', userId],
  },
  wallet: {
    customer: userId => ['wallet', userId],
    transactions: (userId, page = 0, limit = 20) => ['wallet-transactions', userId, page, limit],
  },
  payments: {
    detail: orderId => ['payment', orderId],
  },
  settings: {
    public: ['settings', 'public'],
  },
  villages: {
    all: ['villages'],
    detail: id => ['village', id],
  },
  schemes: {
    all: ['schemes'],
  },
  sevaProviders: {
    byVillage: villageId => ['seva-providers', { villageId }],
  },
};

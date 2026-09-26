export const BUSINESS_FLOW_CONFIG = {
  productName: process.env.SETU_E2E_PRODUCT_NAME || 'SETU E2E Test Product',
  productPrice: Number(process.env.SETU_E2E_PRODUCT_PRICE || 100),
  timeoutMs: Number(process.env.SETU_E2E_TIMEOUT_MS || 30000),
  realtimeTimeoutMs: Number(process.env.SETU_E2E_REALTIME_TIMEOUT_MS || 15000),
};

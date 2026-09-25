// SETU — Product server-state invalidation map (F1-D).
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function invalidateProductQueries({ productId, vendorId, categoryId } = {}) {
  let count = queryClientInstance.invalidateQueries(queryKeys.products.all);
  if (productId) count += queryClientInstance.invalidateQueries(queryKeys.products.detail(productId));
  if (vendorId) count += queryClientInstance.invalidateQueries(queryKeys.products.byVendor(vendorId));
  if (categoryId) count += queryClientInstance.invalidateQueries(queryKeys.products.byCategory(categoryId));
  return count;
}

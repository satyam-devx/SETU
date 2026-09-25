import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function invalidateVendorQueries({ vendorId, ownerId } = {}) {
  queryClientInstance.invalidateQueries(queryKeys.vendors.all);
  if (vendorId) queryClientInstance.invalidateQueries(queryKeys.vendors.detail(vendorId));
  if (ownerId) queryClientInstance.invalidateQueries(queryKeys.vendors.byOwner(ownerId));
}

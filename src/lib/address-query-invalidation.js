import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function invalidateAddressQueries({ customerId } = {}) {
  if (customerId) queryClientInstance.invalidateQueries(queryKeys.addresses.customer(customerId));
}

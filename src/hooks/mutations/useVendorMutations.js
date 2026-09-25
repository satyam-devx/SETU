import { useCallback, useState } from 'react';
import { upsertVendorProfile, updateVendorSettings, saveVendorHours, setVendorCategories } from '@/lib/api';
import { invalidateVendorQueries } from '@/lib/vendor-query-invalidation';

export function useVendorMutations() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async fn => { if (isPending) throw new Error('Vendor operation already in progress.'); setIsPending(true); setError(null); try { const r = await fn(); if (r?.error) throw r.error; return r; } catch (e) { setError(e); throw e; } finally { setIsPending(false); } }, [isPending]);
  const saveProfile = useCallback((data, context={}) => run(async () => { const r=await upsertVendorProfile(data); invalidateVendorQueries({vendorId:r?.data?.id ?? context.vendorId, ownerId:context.ownerId ?? data?.owner_id}); return r; }), [run]);
  const updateSettings = useCallback((vendorId, updates, context={}) => run(async () => { const r=await updateVendorSettings(vendorId, updates); invalidateVendorQueries({vendorId, ownerId:context.ownerId}); return r; }), [run]);
  const saveHours = useCallback((vendorId, hours, context={}) => run(async () => { const r=await saveVendorHours(vendorId, hours); invalidateVendorQueries({vendorId, ownerId:context.ownerId}); return r; }), [run]);
  const updateCategories = useCallback((vendorId, categoryIds, context={}) => run(async () => { const r=await setVendorCategories(vendorId, categoryIds); invalidateVendorQueries({vendorId, ownerId:context.ownerId}); return r; }), [run]);
  return { saveProfile, updateSettings, saveHours, updateCategories, isPending, error };
}

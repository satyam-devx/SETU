import { useCallback, useState } from 'react';
import { updateRiderSettings, updateRiderStatus, createSOSAlert, cancelSOSAlert, submitCODDeposit } from '@/lib/api';
import { invalidateRiderQueries } from '@/lib/rider-query-invalidation';

export function useRiderMutations() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async fn => { if (isPending) throw new Error('Rider operation already in progress.'); setIsPending(true); setError(null); try { const r=await fn(); if (r?.error) throw r.error; return r; } catch(e){setError(e);throw e;} finally{setIsPending(false);} }, [isPending]);
  const updateSettings = useCallback((riderId, updates, context={}) => run(async()=>{const r=await updateRiderSettings(riderId,updates);invalidateRiderQueries({riderId,userId:context.userId});return r;}),[run]);
  const toggleOnline = useCallback((riderId,isOnline,context={}) => run(async()=>{const r=await updateRiderStatus(riderId,isOnline);invalidateRiderQueries({riderId,userId:context.userId});return r;}),[run]);
  const createSOS = useCallback((riderId,location,context={}) => run(async()=>{const r=await createSOSAlert(riderId,location);invalidateRiderQueries({riderId,userId:context.userId});return r;}),[run]);
  const cancelSOS = useCallback((alertId,context={}) => run(async()=>{const r=await cancelSOSAlert(alertId);invalidateRiderQueries({riderId:context.riderId,userId:context.userId});return r;}),[run]);
  const submitDeposit = useCallback((riderId,amount,breakdown,context={}) => run(async()=>{const r=await submitCODDeposit(riderId,amount,breakdown);invalidateRiderQueries({riderId,userId:context.userId});return r;}),[run]);
  return {updateSettings,toggleOnline,createSOS,cancelSOS,submitDeposit,isPending,error};
}

import { useCallback, useState } from 'react';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/api';
import { invalidateNotificationQueries } from '@/lib/notification-query-invalidation';

export function useNotificationMutations() {
  const [isPending,setIsPending]=useState(false); const [error,setError]=useState(null);
  const run=useCallback(async fn=>{if(isPending)throw new Error('Notification operation already in progress.');setIsPending(true);setError(null);try{const r=await fn();if(r?.error)throw r.error;return r;}catch(e){setError(e);throw e;}finally{setIsPending(false);}},[isPending]);
  const markRead=useCallback((id,userId)=>run(async()=>{const r=await markNotificationRead(id);invalidateNotificationQueries({userId});return r;}),[run]);
  const markAllRead=useCallback(userId=>run(async()=>{const r=await markAllNotificationsRead(userId);invalidateNotificationQueries({userId});return r;}),[run]);
  return {markRead,markAllRead,isPending,error};
}

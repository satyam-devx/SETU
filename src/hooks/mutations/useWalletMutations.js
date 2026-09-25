import { useCallback, useState } from 'react';
import { initiatePayment } from '@/lib/payments';
import { invalidateWalletQueries } from '@/lib/wallet-query-invalidation';
import { invalidatePaymentQueries } from '@/lib/payment-query-invalidation';

export function useWalletMutations() {
  const [isPending,setIsPending]=useState(false); const [error,setError]=useState(null);
  const topUp=useCallback(async(paymentContext)=>{if(isPending)throw new Error('Wallet top-up is already in progress.');setIsPending(true);setError(null);try{const result=await initiatePayment({...paymentContext,type:'wallet_topup'});if(result?.error)throw new Error(result.error);if(!result?.cancelled){invalidateWalletQueries({userId:paymentContext.userId ?? paymentContext.customerId});invalidatePaymentQueries({customerId:paymentContext.userId ?? paymentContext.customerId,orderId:paymentContext.orderId});}return result;}catch(e){setError(e);throw e;}finally{setIsPending(false);}},[isPending]);
  return {topUp,isPending,error};
}

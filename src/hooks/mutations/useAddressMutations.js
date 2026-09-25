import { useCallback, useState } from 'react';
import { createAddress, updateAddress, setDefaultAddress, deleteAddress } from '@/lib/api';
import { invalidateAddressQueries } from '@/lib/address-query-invalidation';

export function useAddressMutations() {
  const [isPending,setIsPending]=useState(false); const [error,setError]=useState(null);
  const run=useCallback(async fn=>{if(isPending)throw new Error('Address operation already in progress.');setIsPending(true);setError(null);try{const r=await fn();if(r?.error)throw r.error;return r;}catch(e){setError(e);throw e;}finally{setIsPending(false);}},[isPending]);
  const add=useCallback((userId,address)=>run(async()=>{const r=await createAddress(userId,address);invalidateAddressQueries({customerId:userId});return r;}),[run]);
  const update=useCallback((addressId,updates,context={})=>run(async()=>{const r=await updateAddress(addressId,updates);invalidateAddressQueries({customerId:context.customerId});return r;}),[run]);
  const setDefault=useCallback((addressId,userId)=>run(async()=>{const r=await setDefaultAddress(addressId,userId);invalidateAddressQueries({customerId:userId});return r;}),[run]);
  const remove=useCallback((addressId,userId)=>run(async()=>{const r=await deleteAddress(addressId);invalidateAddressQueries({customerId:userId});return r;}),[run]);
  return {add,update,setDefault,remove,isPending,error};
}

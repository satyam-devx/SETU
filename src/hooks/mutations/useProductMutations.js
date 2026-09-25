// SETU — Product mutation boundary (F1-D.1).
import { useCallback, useState } from 'react';
import { upsertProduct, deleteProduct, setProductCategories } from '@/lib/api';
import { invalidateProductQueries } from '@/lib/product-query-invalidation';

export function useProductMutations() {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const saveProduct = useCallback(async (productData, { categoryIds = [], previousProduct = null } = {}) => {
    setPending(true); setError(null);
    try {
      const result = await upsertProduct(productData);
      if (result.error) { setError(result.error); return result; }
      const saved = result.data;
      const productId = saved?.id ?? productData?.id;
      const vendorId = saved?.vendor_id ?? productData?.vendor_id;

      if (categoryIds.length > 0 && productId) {
        const categoryResult = await setProductCategories(productId, categoryIds);
        if (categoryResult.error) {
          invalidateProductQueries({ productId, vendorId, categoryId: productData?.category_id });
          setError(categoryResult.error);
          return categoryResult;
        }
      }

      invalidateProductQueries({ productId, vendorId, categoryId: productData?.category_id });
      if (previousProduct?.vendor_id && previousProduct.vendor_id !== vendorId) {
        invalidateProductQueries({ vendorId: previousProduct.vendor_id });
      }
      return result;
    } finally { setPending(false); }
  }, []);

  const removeProduct = useCallback(async (productId, context = {}) => {
    setPending(true); setError(null);
    try {
      const result = await deleteProduct(productId);
      if (result.error) { setError(result.error); return result; }
      invalidateProductQueries({ productId, vendorId: context.vendorId, categoryId: context.categoryId });
      return result;
    } finally { setPending(false); }
  }, []);

  return { saveProduct, removeProduct, isPending, error };
}

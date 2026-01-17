import { useCallback, useMemo } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { AttractionProduct, getAttractionPriceInPLN } from './useAttractionProducts';
import { Product } from '@/data/products';

export function useAttractionsSelection() {
  const { state, dispatch } = useConfigurator();
  
  const items = state.sections.atrakcje?.items || [];

  const addProduct = useCallback((product: AttractionProduct) => {
    const priceInPLN = getAttractionPriceInPLN(product);
    
    // Convert AttractionProduct to Product format for OfferItem
    const productForItem: Product = {
      id: product.id,
      symbol: product.symbol,
      name: product.name,
      price: priceInPLN,
      currency: 'PLN',
      description: product.description || undefined,
      category: 'atrakcje',
      subcategory: product.subcategory || undefined,
    };
    
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        section: 'atrakcje',
        item: {
          id: product.id,
          product: productForItem,
          quantity: 1,
        },
      },
    });
  }, [dispatch]);

  const removeProduct = useCallback((productId: string) => {
    dispatch({
      type: 'REMOVE_ITEM',
      payload: {
        section: 'atrakcje',
        itemId: productId,
      },
    });
  }, [dispatch]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeProduct(productId);
      return;
    }

    dispatch({
      type: 'UPDATE_ITEM_QUANTITY',
      payload: {
        section: 'atrakcje',
        itemId: productId,
        quantity,
      },
    });
  }, [dispatch, removeProduct]);

  const isProductSelected = useCallback((productId: string) => {
    return items.some(i => i.id === productId);
  }, [items]);

  const getProductQuantity = useCallback((productId: string) => {
    const item = items.find(i => i.id === productId);
    return item?.quantity || 0;
  }, [items]);

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = item.customPrice ?? item.product.price;
      return sum + (price * item.quantity);
    }, 0);
  }, [items]);

  const totalCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return {
    items,
    addProduct,
    removeProduct,
    updateQuantity,
    isProductSelected,
    getProductQuantity,
    totalPrice,
    totalCount,
  };
}

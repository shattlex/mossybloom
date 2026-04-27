import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { type Product } from '../data';
import { DEFAULT_ORDER_EXTRAS, normalizeOrderExtras, type OrderExtras } from '../types/orderExtras';

interface CartItem extends Product {
  quantity: number;
  selectedSize: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, size?: string) => void;
  removeFromCart: (productId: string, size?: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  orderExtras: OrderExtras;
  setOrderExtras: (extras: Partial<OrderExtras>) => void;
  clearOrderExtras: () => void;
  promo: PromoState;
  setPromo: (promo: PromoState) => void;
  clearPromo: () => void;
  total: number;
  totalAfterDiscount: number;
  itemCount: number;
}

export interface PromoState {
  code: string;
  isApplied: boolean;
  discountAmount: number;
  discountPercent: number;
  message?: string;
}

const CART_STORAGE_KEY = 'sf_cart_items_v2';
const EXTRAS_STORAGE_KEY = 'sf_order_extras_v1';
const PROMO_STORAGE_KEY = 'sf_promo_v1';
const DEFAULT_PROMO: PromoState = {
  code: '',
  isApplied: false,
  discountAmount: 0,
  discountPercent: 0,
  message: ''
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderExtras, setOrderExtrasState] = useState<OrderExtras>(DEFAULT_ORDER_EXTRAS);
  const [promo, setPromoState] = useState<PromoState>(DEFAULT_PROMO);

  useEffect(() => {
    try {
      const storedItems = localStorage.getItem(CART_STORAGE_KEY);
      if (storedItems) {
        const parsed = JSON.parse(storedItems);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.filter((item) =>
            item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.price === 'number' && typeof item.quantity === 'number' && typeof item.selectedSize === 'string'
          );
          setItems(sanitized);
        }
      }

      const storedExtras = localStorage.getItem(EXTRAS_STORAGE_KEY);
      if (storedExtras) {
        setOrderExtrasState(normalizeOrderExtras(JSON.parse(storedExtras)));
      }

      const storedPromo = localStorage.getItem(PROMO_STORAGE_KEY);
      if (storedPromo) {
        const parsedPromo = JSON.parse(storedPromo) as PromoState;
        if (parsedPromo && typeof parsedPromo.code === 'string') {
          setPromoState({
            ...DEFAULT_PROMO,
            ...parsedPromo,
            discountAmount: Number(parsedPromo.discountAmount || 0),
            discountPercent: Number(parsedPromo.discountPercent || 0)
          });
        }
      }
    } catch {
      setItems([]);
      setOrderExtrasState(DEFAULT_ORDER_EXTRAS);
      setPromoState(DEFAULT_PROMO);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(orderExtras));
  }, [orderExtras]);

  useEffect(() => {
    localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(promo));
  }, [promo]);

  const addToCart = (product: Product, size?: string) => {
    const firstAvailableSize = product.sizes.find((item) => !(Object.prototype.hasOwnProperty.call(item, 'available')) || (item as { available?: boolean }).available !== false)?.value
      || product.sizes[0]?.value
      || 'M';
    const resolvedSize = size || firstAvailableSize;
    const selectedSizeData = product.sizes.find((item) => item.value === resolvedSize);
    const priceForSize = selectedSizeData?.price ?? product.price;

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id && item.selectedSize === resolvedSize);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id && item.selectedSize === resolvedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, price: priceForSize, quantity: 1, selectedSize: resolvedSize }];
    });
  };

  const removeFromCart = (productId: string, size?: string) => {
    setItems((prev) =>
      prev.filter((item) => {
        if (item.id !== productId) return true;
        if (!size) return false;
        return item.selectedSize !== size;
      })
    );
  };

  const updateQuantity = (productId: string, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, size);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === productId && item.selectedSize === size ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const setOrderExtras = (extras: Partial<OrderExtras>) => {
    setOrderExtrasState((prev) => normalizeOrderExtras({ ...prev, ...extras }));
  };

  const clearOrderExtras = () => setOrderExtrasState(DEFAULT_ORDER_EXTRAS);
  const setPromo = (nextPromo: PromoState) => setPromoState({
    ...DEFAULT_PROMO,
    ...nextPromo,
    discountAmount: Math.max(0, Number(nextPromo.discountAmount || 0)),
    discountPercent: Math.max(0, Number(nextPromo.discountPercent || 0))
  });
  const clearPromo = () => setPromoState(DEFAULT_PROMO);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const totalAfterDiscount = useMemo(() => Math.max(0, total - promo.discountAmount), [promo.discountAmount, total]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        orderExtras,
        setOrderExtras,
        clearOrderExtras,
        promo,
        setPromo,
        clearPromo,
        total,
        totalAfterDiscount,
        itemCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

export type GiftWrapType = 'none' | 'kraft' | 'colored' | 'transparent';
export type GiftWrapColor = 'blush' | 'ivory' | 'mint' | 'lilac';
export type RibbonColor = 'none' | 'white' | 'pink' | 'red' | 'gold' | 'green';

export interface OrderExtras {
  giftWrap: boolean;
  ribbon: boolean;
  giftWrapType: GiftWrapType;
  giftWrapColor: GiftWrapColor;
  ribbonColor: RibbonColor;
  postcardText: string;
}

export const ORDER_POSTCARD_MAX_LENGTH = 500;

export const DEFAULT_ORDER_EXTRAS: OrderExtras = {
  giftWrap: false,
  ribbon: false,
  giftWrapType: 'none',
  giftWrapColor: 'blush',
  ribbonColor: 'none',
  postcardText: ''
};

function isGiftWrapType(value: unknown): value is GiftWrapType {
  return value === 'none' || value === 'kraft' || value === 'colored' || value === 'transparent';
}

function isGiftWrapColor(value: unknown): value is GiftWrapColor {
  return value === 'blush' || value === 'ivory' || value === 'mint' || value === 'lilac';
}

function isRibbonColor(value: unknown): value is RibbonColor {
  return value === 'none' || value === 'white' || value === 'pink' || value === 'red' || value === 'gold' || value === 'green';
}

export function normalizeOrderExtras(value: Partial<OrderExtras> | null | undefined): OrderExtras {
  const giftWrapType = isGiftWrapType(value?.giftWrapType)
    ? value.giftWrapType
    : value?.giftWrap
      ? 'kraft'
      : 'none';

  const giftWrapColor = isGiftWrapColor(value?.giftWrapColor) ? value.giftWrapColor : 'blush';

  const ribbonColor = isRibbonColor(value?.ribbonColor)
    ? value.ribbonColor
    : value?.ribbon
      ? 'white'
      : 'none';

  const giftWrap = giftWrapType !== 'none';
  const ribbon = ribbonColor !== 'none';

  return {
    giftWrap,
    ribbon,
    giftWrapType,
    giftWrapColor,
    ribbonColor,
    postcardText: typeof value?.postcardText === 'string' ? value.postcardText.slice(0, ORDER_POSTCARD_MAX_LENGTH) : ''
  };
}

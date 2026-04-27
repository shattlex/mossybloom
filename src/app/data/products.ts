import { CmsContent } from '../cms/content';
import { products as legacyCatalogProducts } from '../data';
import { generatedProductMedia } from './generatedContentMedia';

export interface ProductSize {
  value: string;
  label: string;
  price: number;
  available?: boolean;
  image?: string;
  images?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  thumbnail?: string;
  images?: string[];
  category: string;
  color?: string[];
  rating: number;
  reviewsCount: number;
  deliveryTime: string;
  description: string;
  composition: string[];
  sizes: ProductSize[];
}

const RU = {
  small: '\u041c\u0430\u043b\u044b\u0439',
  medium: '\u0421\u0440\u0435\u0434\u043d\u0438\u0439',
  large: '\u0411\u043e\u043b\u044c\u0448\u043e\u0439',
  pink: '\u0420\u043e\u0437\u043e\u0432\u044b\u0439',
  mixedBouquet: '\u0421\u0431\u043e\u0440\u043d\u044b\u0439 \u0431\u0443\u043a\u0435\u0442',
  delivery60: '60 \u043c\u0438\u043d\u0443\u0442',
  compositionRoses: '21 \u0448\u0442 \u0440\u043e\u0437',
  fallbackDescription:
    '\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u043a \u0437\u0430\u043a\u0430\u0437\u0443 \u0441 \u0431\u044b\u0441\u0442\u0440\u043e\u0439 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u043e\u0439 \u0438 \u0444\u043e\u0442\u043e \u043f\u0435\u0440\u0435\u0434 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u043e\u0439.'
} as const;

const FIXED_SIZE_PRICES = {
  S: 5000,
  M: 8500,
  L: 13500
} as const;

type SizeValue = keyof typeof FIXED_SIZE_PRICES;

function normalizeSizeValue(value: string, index: number): SizeValue {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'S' || normalized === 'M' || normalized === 'L') {
    return normalized;
  }
  if (index === 0) return 'S';
  if (index === 1) return 'M';
  return 'L';
}

function resolveProductThumbnail(productId: string, fallbackImage: string): string {
  const normalizedId = String(productId || '').trim().toLowerCase();
  if (!normalizedId) return fallbackImage;

  if (/^rose-\d+$/.test(normalizedId)) {
    return `/products/previews/${normalizedId}.webp`;
  }

  return fallbackImage;
}

function normalizeSizeAvailability(
  sizes: Array<{ value: string; label: string; price: number }> | undefined
): ProductSize[] {
  const normalized = (Array.isArray(sizes) && sizes.length > 0
    ? sizes
    : [
        { value: 'S', label: RU.small, price: Math.max(500, Math.round((fallbackPrice || 1000) * 0.75)) },
        { value: 'M', label: RU.medium, price: fallbackPrice || 1000 },
        { value: 'L', label: RU.large, price: Math.max(1500, Math.round((fallbackPrice || 1000) * 1.45)) }
      ]
  ).map((size, index) => {
    const normalizedValue = normalizeSizeValue(String(size.value || 'S'), index);
    return {
      value: normalizedValue,
      label: String(size.label || RU.small),
      price: FIXED_SIZE_PRICES[normalizedValue]
    };
  });

  if (normalized.length > 0) return normalized;

  return [
    { value: 'S', label: RU.small, price: FIXED_SIZE_PRICES.S },
    { value: 'M', label: RU.medium, price: FIXED_SIZE_PRICES.M },
    { value: 'L', label: RU.large, price: FIXED_SIZE_PRICES.L }
  ];
}

function applyMediaToSizes(productId: string, sizes: ProductSize[]): ProductSize[] {
  const media = generatedProductMedia[productId]?.sizes;
  const merged = sizes.map((size) => {
    const sizeKey = String(size.value || '').toUpperCase() as 'S' | 'M' | 'L';
    const images = media?.[sizeKey] ?? [];
    const hasEnoughImages = images.length >= 3;

    return {
      ...size,
      value: sizeKey || size.value,
      available: hasEnoughImages,
      image: hasEnoughImages ? images[0] : undefined,
      images: hasEnoughImages ? images : []
    };
  });

  if (!merged.some((size) => size.available !== false) && merged.length > 0) {
    merged[0] = { ...merged[0], available: true };
  }

  return merged;
}

export function getProducts(content?: CmsContent): Product[] {
  void content;

  return legacyCatalogProducts.map((product, index) => {
    const id = String(product.id);
    const normalizedSizes = normalizeSizeAvailability(
      Array.isArray(product.sizes)
        ? product.sizes.map((size) => ({
            value: String(size.value || 'M'),
            label: String(size.label || RU.medium),
            price: Number(size.price) || FIXED_SIZE_PRICES.S
          }))
        : undefined
    );

    const sizes = applyMediaToSizes(id, normalizedSizes);
    const firstAvailableSize = sizes.find((size) => size.available !== false);
    const fallbackMedia = generatedProductMedia[id]?.sizes?.S ?? [];
    const image = firstAvailableSize?.image || fallbackMedia[0] || String(product.image || '');
    const images = firstAvailableSize?.images?.length ? firstAvailableSize.images : (fallbackMedia.length ? fallbackMedia : [image]);
    const thumbnail = resolveProductThumbnail(id, image);
    const title = String(product.title || '').trim();

    return {
      id,
      name: title || `\u0411\u0443\u043a\u0435\u0442 ${index + 1}`,
      price: firstAvailableSize?.price ?? FIXED_SIZE_PRICES.S,
      image,
      thumbnail,
      images,
      category: String(product.category || RU.mixedBouquet),
      color: [RU.pink],
      rating: 4.9,
      reviewsCount: 24 + index * 3,
      deliveryTime: RU.delivery60,
      description: String(product.description || '').trim() || `${title || '\u0422\u043e\u0432\u0430\u0440'} ${RU.fallbackDescription}`,
      composition: [RU.compositionRoses],
      sizes
    };
  });
}

export const products: Product[] = getProducts();

export const categories = [
  {
    id: 'roses',
    name: '\u0420\u043e\u0437\u044b',
    image: 'https://images.unsplash.com/photo-1758827644723-f0acdb36bd85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
  },
  {
    id: 'peonies',
    name: '\u041f\u0438\u043e\u043d\u044b',
    image: 'https://images.unsplash.com/photo-1773169206110-103f891dda08?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
  },
  {
    id: 'tulips',
    name: '\u0422\u044e\u043b\u044c\u043f\u0430\u043d\u044b',
    image: 'https://images.unsplash.com/photo-1580403071102-c23c5267d060?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
  },
  {
    id: 'orchids',
    name: '\u041e\u0440\u0445\u0438\u0434\u0435\u0438',
    image: 'https://images.unsplash.com/photo-1768368052646-a6185df478c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
  },
  {
    id: 'mixed',
    name: '\u0421\u0431\u043e\u0440\u043d\u044b\u0435 \u0431\u0443\u043a\u0435\u0442\u044b',
    image: 'https://images.unsplash.com/photo-1708604378427-a06673e5cc0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
  },
  {
    id: 'sunflowers',
    name: '\u041f\u043e\u0434\u0441\u043e\u043b\u043d\u0443\u0445\u0438',
    image: 'https://images.unsplash.com/photo-1752765579971-b9949096c5d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
  }
];

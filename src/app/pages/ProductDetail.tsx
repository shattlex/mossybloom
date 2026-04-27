import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Heart, ArrowLeft, Star, Clock, Check, ShieldCheck, Camera } from 'lucide-react';
import { getProducts } from '../data/products';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { ProductCard } from '../components/ProductCard';
import { DEFAULT_ORDER_EXTRAS } from '../types/orderExtras';
import { OrderExtrasFields } from '../components/OrderExtrasFields';

const RUB = '\u20BD';

export function ProductDetail() {
  const products = useMemo(() => getProducts(), []);
  const { id } = useParams();
  const product = products.find((p) => p.id === id);
  const { addToCart, orderExtras, setOrderExtras } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [selectedSize, setSelectedSize] = useState(product?.sizes.find((size) => size.available !== false)?.value || product?.sizes[0]?.value || 'M');
  const [added, setAdded] = useState(false);
  const [localExtras, setLocalExtras] = useState(orderExtras || DEFAULT_ORDER_EXTRAS);

  const favorite = product ? isFavorite(product.id) : false;

  const selectedSizeData = useMemo(
    () => product?.sizes.find((size) => size.value === selectedSize),
    [product, selectedSize]
  );
  const activeImages = useMemo(() => {
    if (!product) return [];
    if (selectedSizeData?.images && selectedSizeData.images.length > 0) {
      return selectedSizeData.images;
    }
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    return [product.image];
  }, [product, selectedSizeData]);
  const [selectedImage, setSelectedImage] = useState<string>(activeImages[0] || product?.image || '');
  const currentPrice = selectedSizeData?.price || product?.price || 0;
  const composition = useMemo(() => {
    if (!product) return [];

    const defaultComposition = Array.isArray(product.composition) && product.composition.length > 0
      ? product.composition
      : ['21 шт роз'];

    const roseCountBySize: Record<string, string> = {
      S: '21 шт роз',
      M: '51 шт роз',
      L: '101 шт роз'
    };

    const replacement = roseCountBySize[selectedSize] ?? roseCountBySize.S;
    return [replacement, ...defaultComposition.slice(1)];
  }, [product, selectedSize]);

  const preloadedProductImages = useMemo(() => {
    if (!product) return [];
    const urls = new Set<string>();
    urls.add(product.image);
    if (product.images && product.images.length > 0) {
      urls.add(product.images[0]);
    }
    product.sizes.forEach((size) => {
      if (size.image) {
        urls.add(size.image);
      } else if (size.images && size.images.length > 0) {
        urls.add(size.images[0]);
      }
    });
    return [...urls].filter(Boolean);
  }, [product]);

  useEffect(() => {
    setSelectedImage(activeImages[0] || product?.image || '');
  }, [activeImages, product]);

  useEffect(() => {
    activeImages.forEach((url) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
    });
  }, [activeImages]);

  useEffect(() => {
    preloadedProductImages.forEach((url) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
    });
  }, [preloadedProductImages]);

  useEffect(() => {
    if (!product) return;
    const selected = product.sizes.find((size) => size.value === selectedSize);
    if (!selected || selected.available === false) {
      const fallback = product.sizes.find((size) => size.available !== false)?.value || product.sizes[0]?.value || 'M';
      setSelectedSize(fallback);
    }
  }, [product, selectedSize]);

  const relatedProducts = products
    .filter((item) => item.category === product?.category && item.id !== product?.id)
    .slice(0, 4);

  if (!product) {
    return (
      <div className="mx-auto min-h-screen max-w-[1400px] px-6 py-24 md:px-12">
        <h1 className="mb-4 text-4xl text-stone-900" style={{ fontFamily: 'var(--font-script)' }}>Товар не найден</h1>
        <Link to="/catalog" className="text-[#C2958B] hover:underline">Вернуться в каталог</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    setOrderExtras(localExtras);
    addToCart(product, selectedSize);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1700);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-16 md:px-12 md:pb-24">
      <div className="mb-8 flex items-center gap-4 text-[11px] uppercase tracking-[0.16em] text-stone-500">
        <Link to="/" className="transition-colors hover:text-stone-900">Главная</Link>
        <span className="h-1 w-1 rounded-full bg-stone-300" />
        <Link to="/catalog" className="transition-colors hover:text-stone-900">Каталог</Link>
        <span className="h-1 w-1 rounded-full bg-stone-300" />
        <span className="text-stone-900">{product.name}</span>
      </div>

      <Link to="/catalog" className="mb-8 inline-flex items-center gap-2 text-sm text-stone-600 transition-colors hover:text-stone-900">
        <ArrowLeft size={16} />
        Назад в каталог
      </Link>

      <div className="grid grid-cols-1 gap-12 pb-16 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
            <img
              src={selectedImage || product.image}
              alt={product.name}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/5] h-full w-full object-cover"
            />
            {product.oldPrice && (
              <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs uppercase tracking-[0.14em] text-stone-900">
                -{Math.round((1 - product.price / product.oldPrice) * 100)}%
              </span>
            )}
          </div>
          {activeImages.length > 1 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {activeImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  className={`overflow-hidden rounded-xl border ${selectedImage === image ? 'border-stone-900' : 'border-stone-200'}`}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/5] w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6">
          <div className="lg:sticky lg:top-32">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="text-4xl leading-[1.02] text-stone-900 md:text-5xl" style={{ fontFamily: 'var(--font-script)' }}>
                {product.name}
              </h1>
              <button
                onClick={() => toggleFavorite(product.id)}
                className={`rounded-full border p-3 transition-colors ${favorite ? 'border-[#C2958B] bg-[#C2958B] text-white' : 'border-stone-200 bg-white text-stone-600 hover:text-[#C2958B]'}`}
                aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Heart className={`h-5 w-5 ${favorite ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="mb-5 flex items-center gap-3 text-sm text-stone-500">
              <span className="inline-flex items-center gap-1"><Star size={14} className="fill-[#C2958B] text-[#C2958B]" />{product.rating}</span>
              <span>•</span>
              <span>{product.reviewsCount} отзывов</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1"><Clock size={14} />{product.deliveryTime}</span>
            </div>

            <p className="mb-6 text-base leading-relaxed text-stone-600">{product.description}</p>

            <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.16em] text-stone-700">Размер</h2>
              <div className="grid grid-cols-3 gap-3">
                {product.sizes.map((size) => {
                  const active = size.value === selectedSize;
                  const isAvailable = size.available !== false;
                  return (
                    <button
                      key={size.value}
                      type="button"
                      disabled={!isAvailable}
                      title={isAvailable ? '' : 'Нет в наличии'}
                      onClick={() => {
                        if (!isAvailable) return;
                        setSelectedSize(size.value);
                        if (size.images && size.images.length > 0) {
                          setSelectedImage(size.images[0]);
                        } else if (size.image) {
                          setSelectedImage(size.image);
                        }
                      }}
                      className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                        !isAvailable
                          ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                          : active
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <div className="text-sm">{size.label}</div>
                      <div className="mt-1 text-xs">{size.price.toLocaleString('ru-RU')} {RUB}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.16em] text-stone-700">Состав</h2>
              <ul className="space-y-2">
                {composition.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-stone-600">
                    <Check size={15} className="mt-0.5 text-[#C2958B]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
              <OrderExtrasFields extras={localExtras} onChange={setLocalExtras} title="Дополнительно к заказу" />
            </div>

            <div className="mb-7 flex items-baseline justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Стоимость</p>
                <p className="text-3xl text-stone-900" style={{ fontFamily: 'var(--font-script)' }}>{currentPrice.toLocaleString('ru-RU')} {RUB}</p>
              </div>
              {product.oldPrice && selectedSize === 'M' && (
                <p className="text-sm text-stone-400 line-through">{product.oldPrice.toLocaleString('ru-RU')} {RUB}</p>
              )}
            </div>

            <button
              onClick={handleAddToCart}
              className="mb-7 w-full rounded-xl bg-stone-900 px-6 py-4 text-[13px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#C2958B]"
            >
              {added ? 'Добавлено в корзину' : 'Добавить в корзину'}
            </button>

            <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
              <p className="inline-flex items-start gap-2"><Camera size={15} className="mt-0.5 text-[#C2958B]" />Фото перед отправкой</p>
              <p className="inline-flex items-start gap-2"><ShieldCheck size={15} className="mt-0.5 text-[#C2958B]" />Гарантия свежести</p>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section>
          <h2 className="mb-6 text-4xl text-stone-900" style={{ fontFamily: 'var(--font-script)' }}>Похожие товары</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}



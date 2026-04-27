import { Link } from 'react-router';
import { Heart, ShoppingBag, Star, Clock } from 'lucide-react';
import { Product } from '../data/products';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';

const RUB = '\u20BD';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(product.id);

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    const firstAvailableSize = product.sizes.find((size) => size.available !== false)?.value ?? product.sizes[0]?.value;
    if (!firstAvailableSize) return;
    addToCart(product, firstAvailableSize);
  };

  const handleToggleFavorite = (event: React.MouseEvent) => {
    event.preventDefault();
    toggleFavorite(product.id);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group rounded-2xl border border-transparent bg-transparent p-3 transition-all duration-300 hover:border-stone-100 hover:bg-white hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]"
    >
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative mb-5 aspect-[3/4] overflow-hidden rounded-xl bg-stone-100">
          <img
            src={product.thumbnail || product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          {product.oldPrice && (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-900">
              -{Math.round((1 - product.price / product.oldPrice) * 100)}%
            </span>
          )}

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered || favorite ? 1 : 0 }}
            onClick={handleToggleFavorite}
            className={`absolute right-3 top-3 rounded-full p-2 shadow-sm transition-colors ${favorite ? 'bg-[#C2958B] text-white' : 'bg-white/90 text-stone-700 hover:bg-white'}`}
            aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          >
            <Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
            onClick={handleAddToCart}
            className="absolute bottom-3 left-3 right-3 inline-flex items-center justify-center gap-2 rounded-lg bg-stone-900 py-2.5 text-[11px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#C2958B]"
          >
            <ShoppingBag size={14} />
            В корзину
          </motion.button>
        </div>

        <div style={{ fontFamily: 'var(--font-sans)' }}>
          <div className="mb-2 flex items-center gap-2 text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-[#C2958B] text-[#C2958B]" />
              {product.rating}
            </span>
            <span>•</span>
            <span>{product.reviewsCount} отзывов</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{product.deliveryTime}</span>
          </div>

          <h3 className="text-[19px] text-stone-900 transition-colors group-hover:text-[#C2958B]" style={{ fontFamily: 'var(--font-script)' }}>
            {product.name}
          </h3>

          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="text-stone-900">{product.price.toLocaleString('ru-RU')} {RUB}</span>
            {product.oldPrice && <span className="text-stone-400 line-through">{product.oldPrice.toLocaleString('ru-RU')} {RUB}</span>}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

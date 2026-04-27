import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { getProducts } from '../data/products';
import { ProductCard } from '../components/ProductCard';
import { useCmsContent } from '../cms/useCmsContent';
import { useFavorites } from '../context/FavoritesContext';

export function Favorites() {
  const cmsContent = useCmsContent();
  const products = getProducts(cmsContent);
  const { favoriteIds, clearFavorites } = useFavorites();

  const favoriteProducts = products.filter((product) => favoriteIds.includes(product.id));

  return (
    <div className="min-h-screen pb-16 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-5xl sm:text-6xl font-light italic mb-4" style={{ fontFamily: 'var(--font-script)' }}>
            Избранное
          </h1>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Сохранено {favoriteProducts.length} товаров
            </p>
            {favoriteProducts.length > 0 && (
              <button
                onClick={clearFavorites}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Очистить избранное
              </button>
            )}
          </div>
        </motion.div>

        {favoriteProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {favoriteProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 border border-gray-200 max-w-xl mx-auto">
              <Heart className="w-10 h-10 mx-auto mb-4 text-gray-400" />
              <p className="text-xl text-gray-600 mb-4" style={{ fontFamily: 'var(--font-sans)' }}>
                В избранном пока пусто
              </p>
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white rounded-full hover:bg-opacity-90 transition-colors"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Перейти в каталог
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



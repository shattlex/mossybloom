import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { Link } from 'react-router';
import { products } from '../data';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return products.filter((product) => {
      return (
        product.title.toLowerCase().includes(normalized) ||
        product.category.toLowerCase().includes(normalized) ||
        product.description.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  const popularQueries = ['пионы', 'розы', 'авторский букет', 'сухоцветы', 'доставка'];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
            aria-label="Закрыть поиск"
          />

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed left-1/2 top-20 z-[71] w-full max-w-3xl -translate-x-1/2 px-4"
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-2xl">
              <div className="border-b border-stone-200 p-5">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-stone-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Найти букет, категорию или стиль"
                    className="w-full bg-transparent text-[16px] text-stone-900 outline-none placeholder:text-stone-400"
                    autoFocus
                  />
                  <button onClick={onClose} className="rounded-full p-2 hover:bg-stone-100" aria-label="Закрыть">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {query.trim() === '' ? (
                <div className="p-6">
                  <p className="mb-3 text-[12px] uppercase tracking-[0.18em] text-stone-500">Популярные запросы</p>
                  <div className="flex flex-wrap gap-2">
                    {popularQueries.map((item) => (
                      <button
                        key={item}
                        onClick={() => setQuery(item)}
                        className="rounded-full border border-stone-200 bg-[#f8f6f4] px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-100"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto p-4">
                  {filteredProducts.length === 0 ? (
                    <p className="p-6 text-center text-stone-500">Ничего не найдено.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredProducts.slice(0, 10).map((product) => (
                        <Link
                          key={product.id}
                          to={`/product/${product.id}`}
                          onClick={onClose}
                          className="flex items-center gap-3 rounded-xl p-3 hover:bg-stone-50"
                        >
                          <img src={product.image} alt={product.title} className="h-14 w-14 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] text-stone-900">{product.title}</p>
                            <p className="truncate text-xs text-stone-500">{product.category}</p>
                          </div>
                          <span className="text-sm text-stone-800">{product.price.toLocaleString('ru-RU')} ₽</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

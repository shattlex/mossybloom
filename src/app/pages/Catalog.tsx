import { Heart, SlidersHorizontal } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useMemo } from "react";
import { categories, type Product as LegacyProduct } from "../data";
import { getProducts } from "../data/products";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") || "all";
  const products = useMemo(() => getProducts(), []);
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const toLegacyProduct = (product: (typeof products)[number]): LegacyProduct => ({
    id: product.id,
    title: product.name,
    price: product.price,
    image: product.image,
    images: [product.image],
    category: String(product.category || "all").toLowerCase(),
    description: product.description,
    sizes: product.sizes.map((size) => ({ value: size.value, label: size.label, price: size.price })),
  });

  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((product) => String(product.category || "").toLowerCase() === selectedCategory);

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 w-full flex-1 min-h-screen">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-16 flex items-center gap-4">
        <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <span className="text-stone-900 font-medium">Каталог</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 pb-12 border-b border-stone-200 gap-8">
        <h1 className="text-6xl font-serif text-stone-900 tracking-tight leading-none">Каталог</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-16 xl:gap-24 items-start">
        <aside className="w-full lg:w-[240px] flex-shrink-0 flex flex-col gap-8 lg:sticky top-32">
          <div className="lg:hidden flex items-center gap-3 bg-white border border-stone-200 p-4 rounded-xl justify-center mb-4 shadow-sm">
            <SlidersHorizontal size={18} className="text-stone-600" />
            <span className="text-[13px] font-medium tracking-widest uppercase text-stone-800">Фильтры</span>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-[#C2958B] mb-2">Коллекции</h3>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSearchParams(category.id === "all" ? {} : { category: category.id })}
                className={`text-left rounded-lg px-4 py-3 transition-colors ${
                  selectedCategory === category.id
                    ? "text-stone-900 font-medium bg-white shadow-sm border border-stone-100"
                    : "text-stone-500 hover:text-stone-900 hover:bg-white"
                }`}
              >
                {category.title}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-12">
            {filteredProducts.map((product, index) => {
              const favorite = isFavorite(product.id);

              return (
                <div
                  key={product.id}
                  className="group relative block rounded-2xl p-4 md:p-5 bg-transparent hover:bg-white hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all duration-500 border border-transparent hover:border-stone-100"
                >
                  <Link to={`/product/${product.id}`} className="block relative aspect-[3/4] bg-stone-100 rounded-xl mb-6 overflow-hidden">
                    <img
                      src={product.thumbnail || product.image}
                      alt={product.name}
                      loading={index < 6 ? "eager" : "lazy"}
                      fetchPriority={index < 3 ? "high" : "auto"}
                      decoding="async"
                      className="object-cover w-full h-full mix-blend-multiply group-hover:scale-105 transition-transform duration-[1.5s] ease-[cubic-bezier(0.25,1,0.5,1)]"
                    />
                  </Link>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(product.id)}
                    className={`absolute right-8 top-8 p-2 rounded-full border transition-colors ${
                      favorite
                        ? "bg-[#C2958B] border-[#C2958B] text-white"
                        : "bg-white/90 border-stone-200 text-stone-700 hover:text-[#C2958B]"
                    }`}
                    aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}
                  >
                    <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
                  </button>

                  <div className="px-2 flex flex-col gap-4">
                    <Link to={`/product/${product.id}`}>
                      <h3 className="text-lg text-stone-900 font-serif mb-1 group-hover:text-[#C2958B] transition-colors">{product.name}</h3>
                      <p className="text-[15px] text-stone-500 font-light">{product.price.toLocaleString("ru-RU")} ₽</p>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        const firstAvailableSize = product.sizes.find((size) => size.available !== false)?.value ?? product.sizes[0]?.value;
                        if (!firstAvailableSize) return;
                        addToCart(toLegacyProduct(product), firstAvailableSize);
                      }}
                      className="bg-stone-900 text-white py-3 rounded-xl text-[13px] font-medium tracking-widest uppercase hover:bg-[#C2958B] transition-all duration-300 shadow-md"
                    >
                      В корзину
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center text-stone-500 mt-16">
              По выбранной категории товары пока не найдены.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

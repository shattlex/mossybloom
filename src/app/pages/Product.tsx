import { Check, Heart } from "lucide-react";
import { Link, useParams } from "react-router";
import { getProductById, products } from "../data";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { useEffect, useMemo, useState } from "react";

export function Product() {
  const { id } = useParams();
  const product = getProductById(id) || products[0];
  const [selectedSize, setSelectedSize] = useState(product.sizes.find((size) => String(size.value).toUpperCase() === "S")?.value || product.sizes[0]?.value || "M");
  const [activeImage, setActiveImage] = useState(product.images?.[0] || product.image);
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const galleryImages = product.images?.length ? product.images : [product.image];

  useEffect(() => {
    setSelectedSize(product.sizes.find((size) => String(size.value).toUpperCase() === "S")?.value || product.sizes[0]?.value || "M");
    setActiveImage(product.images?.[0] || product.image);
  }, [product]);

  const selectedSizeData = product.sizes.find((item) => item.value === selectedSize) || product.sizes[0];
  const currentPrice = selectedSizeData?.price ?? product.price;
  const favorite = isFavorite(product.id);

  const relatedProducts = useMemo(
    () => products.filter((item) => item.id !== product.id).slice(0, 3),
    [product.id]
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 w-full flex-1">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-12 flex flex-wrap items-center gap-4">
        <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <Link to="/catalog" className="hover:text-stone-900 transition-colors">Каталог</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <span className="text-stone-900 font-medium">{product.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 xl:gap-32 items-start relative pb-20">
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="aspect-[4/5] bg-[#F7F7F7] rounded-[2rem] overflow-hidden relative shadow-[0_20px_40px_rgba(0,0,0,0.03)] border border-stone-100">
            <img
              src={activeImage}
              alt={product.title}
              className="object-cover w-full h-full mix-blend-multiply hover:scale-105 transition-transform duration-[2s]"
            />
            {product.isNew && (
              <span className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm text-stone-900 text-[10px] font-medium px-4 py-2 rounded-full tracking-widest uppercase shadow-sm">
                Новинка
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {galleryImages.map((image, index) => {
              const isActive = image === activeImage;
              return (
                <button
                  key={`${product.id}-preview-${index}`}
                  type="button"
                  onClick={() => setActiveImage(image)}
                  className={`overflow-hidden rounded-2xl border bg-white transition-all ${
                    isActive
                      ? "border-[#C2958B] shadow-[0_8px_24px_rgba(194,149,139,0.28)]"
                      : "border-stone-200 hover:border-stone-400"
                  }`}
                  aria-label={`Фото ${index + 1}`}
                >
                  <img src={image} alt={`${product.title} фото ${index + 1}`} className="aspect-square h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col pt-4 lg:sticky lg:top-32">
          <div className="flex justify-between items-start mb-8 gap-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-stone-900 tracking-tight leading-none">{product.title}</h1>
            <button
              onClick={() => toggleFavorite(product.id)}
              className={`transition-all duration-300 bg-white p-4 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-stone-100 flex-shrink-0 ${favorite ? "text-[#C2958B]" : "text-stone-400 hover:text-[#C2958B]"}`}
              aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}
            >
              <Heart strokeWidth={1.5} size={22} className={favorite ? "fill-current" : ""} />
            </button>
          </div>

          <div className="text-3xl font-serif text-stone-900 mb-8 tracking-tight">
            {currentPrice.toLocaleString("ru-RU")} ₽
          </div>

          <p className="text-stone-500 leading-relaxed mb-6">{product.description}</p>
          <p className="text-[13px] leading-relaxed text-stone-500 mb-10">
            Внешний вид букета может незначительно отличаться от фото на сайте из-за сезонности и наличия сортов, при сохранении стиля, гаммы и ценовой категории.
          </p>

          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[13px] uppercase tracking-widest font-medium text-stone-800">Размер букета</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {product.sizes.map((size) => {
                const isAvailable = String(size.value).toUpperCase() === "S";
                return (
                  <button
                    key={size.value}
                    type="button"
                    disabled={!isAvailable}
                    title={isAvailable ? "" : "Нет в наличии"}
                    onClick={() => {
                      if (!isAvailable) return;
                      setSelectedSize(size.value);
                    }}
                    className={`rounded-xl py-5 flex flex-col items-center justify-center gap-2 transition-all duration-300 ${
                      !isAvailable
                        ? "cursor-not-allowed bg-stone-100 border border-stone-200 text-stone-400"
                        : selectedSize === size.value
                          ? "bg-stone-900 border border-stone-900 text-white shadow-lg"
                          : "bg-white border border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    <span className="font-serif text-lg tracking-wide">{size.label}</span>
                    <span className="text-[11px] tracking-widest">{size.price.toLocaleString("ru-RU")} ₽</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => addToCart(product, selectedSize)}
            className="bg-[#C2958B] text-white w-full py-5 rounded-xl text-[14px] uppercase tracking-widest font-medium hover:bg-stone-900 transition-all duration-500 mb-14"
          >
            Добавить в корзину
          </button>

          <div className="bg-[#FDFBF7] border border-stone-100 rounded-2xl p-8 flex flex-col gap-6 mb-16 shadow-sm">
            <div className="flex items-start gap-6">
              <div className="bg-white p-2 rounded-full shadow-sm text-stone-800 mt-1 border border-stone-100">
                <Check size={16} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-medium tracking-wide text-stone-900 mb-1.5">Доставка за 2 часа</span>
                <span className="text-[14px] text-stone-500 font-light leading-relaxed">В пределах МКАД от 390 ₽. Фото композиции перед отправкой.</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-serif text-stone-900 mb-8">С этим товаром выбирают</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedProducts.map((item) => (
                <Link key={item.id} to={`/product/${item.id}`} className="bg-white border border-stone-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                  <img src={item.image} alt={item.title} className="w-full aspect-square object-cover rounded-xl mb-3" />
                  <p className="text-sm font-medium text-stone-800">{item.title}</p>
                  <p className="text-xs text-stone-500">{item.price.toLocaleString("ru-RU")} ₽</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

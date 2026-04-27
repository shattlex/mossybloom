import { ArrowRight, Minus, Plus, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { validatePromoCode } from "../api/client";
import { useCart } from "../context/CartContext";

export function Cart() {
  const {
    items,
    updateQuantity,
    removeFromCart,
    total,
    totalAfterDiscount,
    itemCount,
    promo,
    setPromo,
    clearPromo
  } = useCart();

  const [promoInput, setPromoInput] = useState(promo.code || "");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  const delivery = 0;
  const discount = Math.max(0, total - totalAfterDiscount);
  const grandTotal = totalAfterDiscount + delivery;

  useEffect(() => {
    if (items.length === 0) {
      clearPromo();
      setPromoInput("");
      setPromoError("");
    }
  }, [clearPromo, items.length]);

  useEffect(() => {
    if (!promo.isApplied || !promo.code || total <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const validated = await validatePromoCode({
          code: promo.code,
          subtotal: total
        });
        if (cancelled) return;
        if (!validated.valid) {
          clearPromo();
          setPromoError(validated.message || "Промокод больше не действует.");
          return;
        }
        setPromo({
          code: validated.code,
          isApplied: true,
          discountAmount: validated.discountAmount,
          discountPercent: validated.discountPercent,
          message: validated.message || "Промокод применён."
        });
      } catch {
        if (!cancelled) setPromoError("Не удалось обновить промокод. Попробуйте ещё раз.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearPromo, promo.code, promo.isApplied, setPromo, total]);

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoError("Введите промокод.");
      return;
    }
    if (total <= 0) {
      setPromoError("Промокод можно применить только к товарам в корзине.");
      return;
    }

    try {
      setPromoLoading(true);
      setPromoError("");
      const result = await validatePromoCode({
        code,
        subtotal: total
      });
      if (!result.valid) {
        clearPromo();
        setPromoError(result.message || "Промокод недействителен.");
        return;
      }
      setPromo({
        code: result.code,
        isApplied: true,
        discountAmount: result.discountAmount,
        discountPercent: result.discountPercent,
        message: result.message || "Промокод применён."
      });
      setPromoInput(result.code);
    } catch (error) {
      setPromoError(error instanceof Error ? error.message : "Не удалось проверить промокод.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleClearPromo = () => {
    clearPromo();
    setPromoInput("");
    setPromoError("");
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-24 w-full flex-1">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-12 flex flex-wrap items-center gap-4">
        <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <Link to="/catalog" className="hover:text-stone-900 transition-colors">Каталог</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <span className="text-stone-900 font-medium">Корзина</span>
      </div>

      <h1 className="text-5xl md:text-6xl font-serif text-stone-900 tracking-tight mb-16 leading-none">Корзина</h1>

      {items.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-10 text-center max-w-xl">
          <p className="text-stone-500 mb-6">В корзине пока нет товаров.</p>
          <Link to="/catalog" className="inline-flex items-center justify-center bg-stone-900 text-white rounded-xl px-8 py-4 text-[12px] tracking-[0.2em] uppercase font-medium hover:bg-[#C2958B] transition-colors">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-16 xl:gap-24 relative">
          <div className="flex-1 w-full">
            <div className="flex flex-col gap-10 border-t border-stone-200 pt-10">
              {items.map((item) => (
                <div key={`${item.id}-${item.selectedSize}`} className="flex flex-col sm:flex-row gap-8 lg:gap-12 border-b border-stone-200 pb-10">
                  <Link to={`/product/${item.id}`} className="w-full sm:w-[180px] aspect-[4/5] bg-stone-100 rounded-[1.5rem] flex-shrink-0 overflow-hidden border border-stone-100">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </Link>

                  <div className="flex flex-col flex-1 justify-between py-2 gap-6">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                      <div>
                        <h3 className="text-2xl font-serif text-stone-900 mb-3">
                          <Link to={`/product/${item.id}`} className="hover:text-[#C2958B] transition-colors">{item.title}</Link>
                        </h3>
                        <p className="text-[13px] tracking-widest uppercase text-stone-500 font-medium mb-6">
                          Размер: <span className="text-stone-900 font-serif lowercase tracking-normal text-lg ml-1">{item.selectedSize}</span>
                        </p>

                        <div className="flex items-center gap-6 border border-stone-200 rounded-full w-fit px-5 py-3 bg-white shadow-sm">
                          <button onClick={() => updateQuantity(item.id, item.selectedSize, item.quantity - 1)} className="text-stone-400 hover:text-stone-900 transition-colors" aria-label="Уменьшить">
                            <Minus size={16} strokeWidth={1.5} />
                          </button>
                          <span className="text-[15px] font-medium w-8 text-center text-stone-900">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.selectedSize, item.quantity + 1)} className="text-stone-400 hover:text-stone-900 transition-colors" aria-label="Увеличить">
                            <Plus size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end justify-between gap-6">
                        <span className="text-2xl font-serif text-stone-900 tracking-tight whitespace-nowrap">{(item.price * item.quantity).toLocaleString("ru-RU")} ₽</span>

                        <button onClick={() => removeFromCart(item.id, item.selectedSize)} className="text-[11px] tracking-widest uppercase font-medium text-stone-400 hover:text-[#C2958B] flex items-center gap-2 transition-colors">
                          <Trash2 size={14} strokeWidth={1.5} />
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full xl:w-[440px] flex-shrink-0">
            <div className="bg-white p-10 md:p-12 rounded-[2rem] flex flex-col gap-10 xl:sticky xl:top-32 shadow-[0_20px_60px_rgba(0,0,0,0.04)] border border-stone-100">
              <h2 className="text-2xl font-serif text-stone-900">Итог заказа</h2>

              <div className="flex flex-col gap-5 text-[15px] font-light">
                <div className="flex justify-between tracking-wide">
                  <span className="text-stone-500">Товары ({itemCount})</span>
                  <span className="text-stone-900 font-medium">{total.toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-stone-700">
                    <Tag size={14} />
                    Промокод
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Введите код"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-stone-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleApplyPromo()}
                      disabled={promoLoading}
                      className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium uppercase tracking-widest text-white transition-colors hover:bg-[#C2958B] disabled:opacity-70"
                    >
                      {promoLoading ? "..." : "Применить"}
                    </button>
                  </div>
                  {promo.isApplied && (
                    <div className="mt-2 flex items-center justify-between text-sm text-emerald-700">
                      <span>{promo.message || `Промокод ${promo.code} применён`}</span>
                      <button type="button" onClick={handleClearPromo} className="text-stone-500 hover:text-stone-900">
                        Убрать
                      </button>
                    </div>
                  )}
                  {!promo.isApplied && promoError && <p className="mt-2 text-sm text-red-600">{promoError}</p>}
                </div>
                {discount > 0 && (
                  <div className="flex justify-between tracking-wide">
                    <span className="text-stone-500">Скидка ({promo.discountPercent}%)</span>
                    <span className="font-medium text-emerald-700">−{discount.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
                <div className="flex justify-between tracking-wide pb-10 border-b border-stone-200">
                  <span className="text-stone-500">Доставка</span>
                  <span className="text-stone-900 font-medium">Бесплатно (в пределах МКАД)</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <span className="text-lg font-medium text-stone-900 tracking-widest uppercase text-[11px]">К оплате</span>
                <span className="text-4xl font-serif tracking-tight text-stone-900">{grandTotal.toLocaleString("ru-RU")} ₽</span>
              </div>

              <Link
                to="/checkout"
                className="w-full bg-stone-900 text-white rounded-xl py-6 flex items-center justify-center gap-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-[#C2958B] transition-all duration-500 group mt-4"
              >
                Перейти к оформлению
                <ArrowRight size={18} strokeWidth={1.5} className="group-hover:translate-x-2 transition-transform duration-300" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


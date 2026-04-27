import { CheckCircle2, Circle, CreditCard, Lock, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { calculateDelivery, createCashOrder, createPayment, type DeliveryCalculation } from "../api/client";
import { AddressAutocompleteInput } from "../components/AddressAutocompleteInput";
import { useCart } from "../context/CartContext";

export function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, total, clearCart, orderExtras, clearOrderExtras, promo, clearPromo } = useCart();

  const [recipientMode, setRecipientMode] = useState<"self" | "other">("self");
  const [payer, setPayer] = useState({ name: "", phone: "", email: "" });
  const [recipient, setRecipient] = useState({ name: "", phone: "", email: "" });
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryCalculation | null>(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [orderComment, setOrderComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const [consents, setConsents] = useState({ offerAccepted: false, personalDataAccepted: false, marketingAccepted: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState("");
  const paymentResult = searchParams.get("payment");
  const returnOrderId = searchParams.get("orderId") || "";
  const safeItems = useMemo(() => items.filter((item) => Boolean(item && item.id)), [items]);

  useEffect(() => {
    if (safeItems.length === 0) {
      setSuccessOrderId("");
    }
  }, [safeItems.length]);

  useEffect(() => {
    const address = deliveryAddress.trim();
    if (address.length < 5) {
      setDeliveryInfo(null);
      setDeliveryError("");
      setDeliveryLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setDeliveryLoading(true);
        setDeliveryError("");
        const info = await calculateDelivery(address);
        if (!cancelled) {
          setDeliveryInfo(info);
        }
      } catch (requestError) {
        if (!cancelled) {
          setDeliveryInfo(null);
          setDeliveryError(requestError instanceof Error ? requestError.message : "Не удалось рассчитать доставку.");
        }
      } finally {
        if (!cancelled) {
          setDeliveryLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [deliveryAddress]);

  const deliveryCost = deliveryInfo?.deliveryPrice ?? 0;
  const discountAmount = Math.min(promo.isApplied ? promo.discountAmount : 0, total);
  const discountedSubtotal = Math.max(0, total - discountAmount);
  const grandTotal = discountedSubtotal + deliveryCost;

  const checkoutItems = useMemo(
    () =>
      safeItems.map((item) => ({
        id: item.id,
        name: `${item.title || item.name || "Букет"} (${item.selectedSize || "M"})`,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      })),
    [safeItems]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (safeItems.length === 0) {
      setError("Корзина пуста.");
      return;
    }

    if (!payer.name.trim() || !payer.phone.trim()) {
      setError("Заполните имя и телефон плательщика.");
      return;
    }

    if (recipientMode === "other" && (!recipient.name.trim() || !recipient.phone.trim())) {
      setError("Заполните имя и телефон получателя.");
      return;
    }

    if (!deliveryAddress.trim()) {
      setError("Укажите адрес доставки.");
      return;
    }

    if (!consents.offerAccepted || !consents.personalDataAccepted) {
      setError("Подтвердите обязательные согласия для оформления заказа.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const recipientPayload = recipientMode === "self" ? payer : recipient;
      const payload = {
        payer,
        recipient: recipientPayload,
        recipientMode,
        items: checkoutItems,
        total: grandTotal,
        deliveryAmount: deliveryCost,
        promoCode: promo.isApplied ? promo.code : undefined,
        deliveryAddress,
        orderComment,
        extras: orderExtras,
        consents: {
          offerAccepted: consents.offerAccepted,
          personalDataAccepted: consents.personalDataAccepted,
          marketingAccepted: consents.marketingAccepted,
          acceptedAt: new Date().toISOString()
        }
      };

      if (paymentMethod === "card") {
        const result = await createPayment(payload);
        clearCart();
        clearOrderExtras();
        clearPromo();
        if (result.confirmationUrl) {
          window.location.href = result.confirmationUrl;
          return;
        }
        setSuccessOrderId(result.orderId);
      } else {
        const result = await createCashOrder(payload);
        clearCart();
        clearOrderExtras();
        clearPromo();
        setSuccessOrderId(result.orderId);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось оформить заказ.");
    } finally {
      setSubmitting(false);
    }
  }

  if (successOrderId) {
    return <Navigate to={`/order-success?orderId=${encodeURIComponent(successOrderId)}&payment=cash`} replace />;
  }

  if (paymentResult === "failed") {
    return (
      <div className="max-w-[900px] mx-auto px-6 md:px-12 py-24 w-full">
        <div className="bg-white border border-stone-200 rounded-3xl p-10 md:p-14 text-center">
          <h1 className="text-4xl font-serif mb-4">Оплата отменена</h1>
          <p className="text-stone-600 mb-2">Вы отменили оплату на стороне платёжного сервиса.</p>
          {returnOrderId ? <p className="text-stone-500 mb-8">Номер заказа: <strong>{returnOrderId}</strong></p> : null}
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/cart" className="bg-stone-900 text-white rounded-xl px-8 py-4 text-[12px] tracking-[0.2em] uppercase font-medium hover:bg-[#C2958B] transition-colors">
              Вернуться в корзину
            </Link>
            <button onClick={() => navigate("/checkout")} className="border border-stone-300 rounded-xl px-8 py-4 text-[12px] tracking-[0.2em] uppercase font-medium hover:border-stone-900 transition-colors">
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentResult === "success") {
    return <Navigate to={`/order-success${returnOrderId ? `?orderId=${encodeURIComponent(returnOrderId)}&payment=card` : "?payment=card"}`} replace />;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-24 w-full flex-1">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-12 flex flex-wrap items-center gap-4">
        <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <span className="text-stone-900 font-medium">Оформление</span>
      </div>

      <h1 className="text-5xl md:text-6xl font-serif text-stone-900 tracking-tight mb-16 leading-none">Оформление</h1>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
        <div className="flex-1 w-full lg:max-w-[780px] flex flex-col gap-12 lg:gap-16">
          <section className="bg-white p-8 md:p-14 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.03)] border border-stone-100">
            <div className="flex items-center gap-6 mb-12 pb-8 border-b border-stone-100">
              <span className="bg-[#FAFAFA] text-[#C2958B] w-12 h-12 rounded-full flex items-center justify-center text-xl font-serif border border-stone-200">1</span>
              <h2 className="text-3xl font-serif text-stone-900">Получатель</h2>
            </div>

            <div className="flex gap-4 mb-10">
              <button type="button" onClick={() => setRecipientMode("self")} className={`flex-1 py-5 rounded-xl border font-medium tracking-widest uppercase text-[11px] transition-all ${recipientMode === "self" ? "border-[#C2958B] text-[#C2958B]" : "border-stone-200 text-stone-500"}`}>
                Я сам(а)
              </button>
              <button type="button" onClick={() => setRecipientMode("other")} className={`flex-1 py-5 rounded-xl border font-medium tracking-widest uppercase text-[11px] transition-all ${recipientMode === "other" ? "border-[#C2958B] text-[#C2958B]" : "border-stone-200 text-stone-500"}`}>
                Другой человек
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <input value={payer.name} onChange={(e) => setPayer((prev) => ({ ...prev, name: e.target.value }))} placeholder="Имя плательщика" className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl p-5" required />
              <input value={payer.phone} onChange={(e) => setPayer((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон плательщика" className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl p-5" required />
              <input value={payer.email} onChange={(e) => setPayer((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email плательщика" className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl p-5 md:col-span-2" />
            </div>

            {recipientMode === "other" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input value={recipient.name} onChange={(e) => setRecipient((prev) => ({ ...prev, name: e.target.value }))} placeholder="Имя получателя" className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl p-5" required />
                <input value={recipient.phone} onChange={(e) => setRecipient((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон получателя" className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl p-5" required />
                <input value={recipient.email} onChange={(e) => setRecipient((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email получателя" className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl p-5 md:col-span-2" />
              </div>
            )}
          </section>

          <section className="bg-white p-8 md:p-14 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.03)] border border-stone-100">
            <div className="flex items-center gap-6 mb-12 pb-8 border-b border-stone-100">
              <span className="bg-[#FAFAFA] text-[#C2958B] w-12 h-12 rounded-full flex items-center justify-center text-xl font-serif border border-stone-200">2</span>
              <h2 className="text-3xl font-serif text-stone-900">Доставка</h2>
            </div>

            <div className="flex items-center gap-4 mb-8 p-6 border border-[#E6EDE8]/60 rounded-2xl bg-[#FAFAFA] text-[15px]">
              <div className="bg-white p-3 rounded-full text-[#7A8B7D] border border-stone-100">
                <MapPin size={18} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] tracking-[0.2em] uppercase font-medium text-stone-400 mb-1">Регион</span>
                <span className="text-stone-900 font-medium tracking-wide">Москва и МО</span>
              </div>
            </div>

            <div className="mb-6">
              <AddressAutocompleteInput
                value={deliveryAddress}
                onChange={setDeliveryAddress}
                rows={3}
                required
                placeholder="Введите полный адрес доставки"
                className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl"
              />
            </div>

            <textarea
              value={orderComment}
              onChange={(e) => setOrderComment(e.target.value)}
              placeholder="Комментарий к заказу (необязательно)"
              className="w-full bg-[#FDFDFD] border border-stone-200 rounded-xl p-5 resize-none"
              rows={3}
              maxLength={500}
            />

            <div className="mt-6 text-sm text-stone-600 space-y-1">
              {deliveryLoading && <p>Рассчитываем стоимость доставки...</p>}
              {deliveryError && <p className="text-red-600">{deliveryError}</p>}
              {deliveryInfo && !deliveryLoading && (
                <p>
                  Расчёт доставки: {deliveryInfo.deliveryPrice.toLocaleString("ru-RU")} ₽
                  {deliveryInfo.beltwayDistanceKm !== null ? `, расстояние от МКАД: ${deliveryInfo.beltwayDistanceKm.toFixed(1)} км` : ""}
                </p>
              )}
            </div>
          </section>


          <section className="bg-white p-8 md:p-14 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.03)] border border-stone-100">
            <div className="flex items-center gap-6 mb-12 pb-8 border-b border-stone-100">
              <span className="bg-[#FAFAFA] text-[#C2958B] w-12 h-12 rounded-full flex items-center justify-center text-xl font-serif border border-stone-200">3</span>
              <h2 className="text-3xl font-serif text-stone-900">Оплата</h2>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              <button type="button" onClick={() => setPaymentMethod("card")} className={`flex items-center gap-5 border rounded-2xl p-6 cursor-pointer transition-all ${paymentMethod === "card" ? "border-[#C2958B] bg-white" : "border-stone-200"}`}>
                {paymentMethod === "card" ? <CheckCircle2 size={24} className="text-[#C2958B]" /> : <Circle size={24} className="text-stone-300" />}
                <CreditCard size={20} className="text-stone-600" />
                <span className="text-[15px] tracking-wide font-medium text-stone-900">Картой на сайте</span>
              </button>

              <button type="button" onClick={() => setPaymentMethod("cash")} className={`flex items-center gap-5 border rounded-2xl p-6 cursor-pointer transition-all ${paymentMethod === "cash" ? "border-[#C2958B] bg-white" : "border-stone-200"}`}>
                {paymentMethod === "cash" ? <CheckCircle2 size={24} className="text-[#C2958B]" /> : <Circle size={24} className="text-stone-300" />}
                <span className="text-[15px] tracking-wide font-medium text-stone-900">Наличными курьеру</span>
              </button>
            </div>

            <div className="space-y-3 text-sm text-stone-600">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={consents.offerAccepted} onChange={(e) => setConsents((prev) => ({ ...prev, offerAccepted: e.target.checked }))} className="mt-1" />
                <span>Принимаю условия <Link to="/oferta" className="text-[#C2958B] hover:underline">оферты</Link> и <Link to="/terms" className="text-[#C2958B] hover:underline">пользовательского соглашения</Link>, включая уведомление о возможном отличии букета от фото на сайте.</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={consents.personalDataAccepted} onChange={(e) => setConsents((prev) => ({ ...prev, personalDataAccepted: e.target.checked }))} className="mt-1" />
                <span>Даю согласие на обработку персональных данных согласно <Link to="/privacy" className="text-[#C2958B] hover:underline">политике конфиденциальности</Link> и <Link to="/consent" className="text-[#C2958B] hover:underline">согласию на обработку ПДн</Link>.</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={consents.marketingAccepted} onChange={(e) => setConsents((prev) => ({ ...prev, marketingAccepted: e.target.checked }))} className="mt-1" />
                <span>Согласен(а) на получение информационных сообщений и специальных предложений (необязательно).</span>
              </label>
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">{error}</div>}
        </div>

        <div className="w-full lg:w-[440px] flex-shrink-0">
          <div className="bg-stone-900 p-10 md:p-12 rounded-[2.5rem] flex flex-col gap-10 lg:sticky lg:top-32 shadow-[0_30px_80px_rgba(0,0,0,0.15)] text-white">
            <h2 className="text-3xl font-serif tracking-tight">Ваш заказ</h2>

            <div className="flex flex-col gap-4 border-b border-white/10 pb-8 max-h-64 overflow-auto pr-2">
              {safeItems.map((item) => (
                <div key={`${item.id}-${item.selectedSize}`} className="flex justify-between items-start gap-4">
                  <span className="text-white/70 text-[14px]">{item.title || item.name || "Букет"} ({item.selectedSize || "M"}) × {item.quantity}</span>
                  <span className="text-white text-[14px]">{(item.price * item.quantity).toLocaleString("ru-RU")} ₽</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between font-light tracking-wide text-[15px]">
                <span className="text-white/60">Товары ({safeItems.length})</span>
                <span className="text-white">{total.toLocaleString("ru-RU")} ₽</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between font-light tracking-wide text-[15px]">
                  <span className="text-white/60">Скидка ({promo.discountPercent}%)</span>
                  <span className="text-emerald-300">−{discountAmount.toLocaleString("ru-RU")} ₽</span>
                </div>
              )}
              <div className="flex justify-between font-light tracking-wide text-[15px] pb-10 border-b border-white/10">
                <span className="text-white/60">Доставка</span>
                <span className="text-white">{deliveryCost.toLocaleString("ru-RU")} ₽</span>
              </div>
            </div>

            <div className="flex justify-between items-end mb-4 mt-2">
              <span className="text-[11px] uppercase tracking-widest font-medium text-white/50">Итого к оплате</span>
              <span className="text-4xl font-serif tracking-tight text-white">{grandTotal.toLocaleString("ru-RU")} ₽</span>
            </div>

            <button type="submit" disabled={submitting || safeItems.length === 0} className="w-full bg-[#C2958B] text-white rounded-xl py-6 flex items-center justify-center gap-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-white hover:text-stone-900 transition-all duration-500 group shadow-lg mt-2 disabled:opacity-70 disabled:cursor-not-allowed">
              <Lock size={16} strokeWidth={1.5} className="group-hover:text-stone-900 transition-colors" />
              {submitting ? "Оформляем..." : paymentMethod === "card" ? "Оплатить заказ" : "Подтвердить заказ"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}



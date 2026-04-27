import { CheckCircle2 } from "lucide-react";
import { Link, useSearchParams } from "react-router";

export function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const payment = searchParams.get("payment");

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-12 py-24 w-full">
      <div className="bg-white border border-stone-200 rounded-3xl p-10 md:p-14 text-center">
        <CheckCircle2 className="mx-auto mb-6 text-emerald-600" size={48} />
        <h1 className="text-4xl font-serif mb-4">Спасибо за заказ!</h1>
        {orderId ? (
          <p className="text-stone-600 mb-4">
            Номер заказа: <strong>{orderId}</strong>
          </p>
        ) : null}
        <p className="text-stone-500 mb-10">
          {payment === "card"
            ? "Оплата прошла успешно. Мы отправили подтверждение на указанную почту."
            : "Заказ успешно оформлен. Мы отправили подтверждение на указанную почту."}
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to="/account?tab=orders"
            className="bg-stone-900 text-white rounded-xl px-8 py-4 text-[12px] tracking-[0.2em] uppercase font-medium hover:bg-[#C2958B] transition-colors"
          >
            Мои заказы
          </Link>
          <Link
            to="/catalog"
            className="border border-stone-300 rounded-xl px-8 py-4 text-[12px] tracking-[0.2em] uppercase font-medium hover:border-stone-900 transition-colors"
          >
            В каталог
          </Link>
        </div>
      </div>
    </div>
  );
}


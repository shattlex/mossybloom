import { useState } from "react";
import { Link, useLocation } from "react-router";
import { submitContact } from "../api/client";

interface InfoContent {
  title: string;
  subtitle: string;
  content: string | string[];
}

const contentMap: Record<string, InfoContent> = {
  "/delivery": {
    title: "Доставка и оплата",
    subtitle: "Бережный сервис для особых моментов",
    content: [
      "Доставка по Москве и МО.",
      "стоимость доставки будет известна при оформлении заказа."
    ]
  },
  "/about": {
    title: "О студии",
    subtitle: "Искусство высокой флористики",
    content: "Mossy Bloom создает авторские композиции из свежих сезонных цветов. Мы тщательно подбираем фактуры, палитру и форму каждого букета."
  },
  "/faq": {
    title: "Вопросы и ответы",
    subtitle: "Частые вопросы",
    content: "Вы можете указать получателя, комментарий, пожелания к открытке и оформить оплату картой на сайте или наличными курьеру."
  },
  "/guarantee": {
    title: "Гарантии",
    subtitle: "Качество и свежесть",
    content: "Если букет потерял товарный вид в течение гарантийного периода, мы предложим замену. Перед отправкой фиксируем результат на фото."
  },
  "/bouquet-builder": {
    title: "Собрать букет",
    subtitle: "Индивидуальный заказ",
    content: "Опишите желаемый стиль, бюджет и дату доставки. Менеджер свяжется с вами и поможет собрать индивидуальную композицию."
  },
  "/contacts": {
    title: "Контакты",
    subtitle: "Свяжитесь с нами",
    content: "Оставьте сообщение, и менеджер свяжется с вами для консультации по заказу и доставке."
  }
};

export function InfoPage() {
  const { pathname } = useLocation();

  const [formData, setFormData] = useState({ name: "", phone: "", email: "", message: "" });
  const [consents, setConsents] = useState({ personalData: false, terms: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const info = contentMap[pathname] || {
    title: "Информация",
    subtitle: "Страница в разработке",
    content: "Контент будет добавлен в ближайшее время."
  };

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consents.personalData || !consents.terms) {
      setError("Для отправки формы нужно подтвердить обязательные согласия.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccessMessage("");
      await submitContact({
        ...formData,
        consentPersonalData: consents.personalData,
        consentTerms: consents.terms
      });
      setFormData({ name: "", phone: "", email: "", message: "" });
      setConsents({ personalData: false, terms: false });
      setSuccessMessage("Сообщение отправлено. Мы свяжемся с вами в ближайшее время.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось отправить форму.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pathname === "/contacts") {
    return (
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-24 w-full flex-1">
        <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-12 flex flex-wrap items-center gap-4">
          <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
          <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
          <span className="text-stone-900 font-medium">Контакты</span>
        </div>

        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-serif text-stone-900 tracking-tight mb-8 leading-[1.05]">Контакты</h1>
          <p className="text-lg md:text-xl text-stone-500 font-light leading-[1.8] mb-12">
            Оставьте сообщение, и менеджер свяжется с вами для консультации по заказу и доставке.
          </p>

          <div className="bg-[#FAFAFA] border border-stone-100 rounded-[2.5rem] p-8 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.02)]">
            <h2 className="text-3xl font-serif text-stone-900 mb-8">Напишите нам</h2>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Ваше имя"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
                required
              />
              <input
                type="tel"
                placeholder="Телефон"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
                required
              />
              <textarea
                placeholder="Сообщение"
                value={formData.message}
                onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                className="w-full min-h-[140px] rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
                required
              />

              <label className="flex items-start gap-3 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={consents.personalData}
                  onChange={(e) => setConsents((prev) => ({ ...prev, personalData: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  Даю согласие на обработку персональных данных по{" "}
                  <Link to="/privacy" className="text-[#C2958B] hover:text-stone-900 transition-colors">
                    политике конфиденциальности
                  </Link>.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={consents.terms}
                  onChange={(e) => setConsents((prev) => ({ ...prev, terms: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  Принимаю условия{" "}
                  <Link to="/terms" className="text-[#C2958B] hover:text-stone-900 transition-colors">
                    пользовательского соглашения
                  </Link>.
                </span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-stone-900 px-6 py-4 text-[12px] tracking-[0.2em] uppercase font-medium text-white hover:bg-[#C2958B] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Отправка..." : "Отправить сообщение"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-24 w-full flex-1">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-12 flex flex-wrap items-center gap-4">
        <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <span className="text-stone-900 font-medium">{info.title}</span>
      </div>

      <div className="max-w-3xl">
        <span className="text-[#C2958B] font-medium tracking-[0.2em] uppercase text-xs mb-6 block">{info.subtitle}</span>
        <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-serif text-stone-900 tracking-tight mb-12 leading-[1.05]">{info.title}</h1>
        {Array.isArray(info.content) ? (
          <div className="mb-16 space-y-2">
            <p className="text-lg md:text-xl text-stone-500 font-light leading-[1.8] text-balance">{info.content[0]}</p>
            <p className="text-lg md:text-xl text-stone-900 font-medium leading-[1.8] text-balance">{info.content[1]}</p>
          </div>
        ) : (
          <p className="text-lg md:text-xl text-stone-500 font-light leading-[1.8] text-balance mb-16 whitespace-pre-line">{info.content}</p>
        )}

        <div className="w-full h-px bg-stone-200/60 mb-16" />

        <div className="bg-[#FAFAFA] border border-stone-100 rounded-[2.5rem] p-10 md:p-14 flex flex-col gap-6 shadow-[0_20px_60px_rgba(0,0,0,0.02)]">
          <h2 className="text-2xl font-serif text-stone-900 mb-2">Нужна консультация?</h2>
          <p className="text-stone-500 font-light leading-relaxed max-w-md">Напишите нам в удобный мессенджер или выберите букет в каталоге.</p>
          <div className="flex gap-4 mt-2">
            <Link to="/catalog" className="bg-stone-900 text-white rounded-xl px-8 py-4 text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-[#C2958B] transition-colors shadow-sm">Каталог</Link>
            <Link to="/about" className="bg-white border border-stone-200 text-stone-900 rounded-xl px-8 py-4 text-[11px] tracking-[0.2em] uppercase font-medium hover:border-stone-400 transition-colors shadow-sm">О нас</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

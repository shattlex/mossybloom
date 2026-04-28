import { useState } from "react";
import { Link, useLocation } from "react-router";
import { submitContact } from "../api/client";

interface InfoContent {
  title: string;
  subtitle: string;
  content: string;
}

const contentMap: Record<string, InfoContent> = {
  "/delivery": {
    title: "Доставка и оплата",
    subtitle: "Бережный сервис для особых моментов",
    content: "Доставка по Москве и МО.\n*стоимость доставки будет известна при оформлении заказа."
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
        <p className="text-lg md:text-xl text-stone-500 font-light leading-[1.8] text-balance mb-16 whitespace-pre-line">{info.content}</p>

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

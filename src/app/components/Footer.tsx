import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="bg-[#141414] text-[#F5F5F5] mt-24 md:mt-40 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 pt-24 md:pt-32 pb-16 grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8">
        <div className="md:col-span-4 flex flex-col gap-8 pr-0 lg:pr-12">
          <span className="text-4xl font-serif tracking-tight text-white">Mossy Bloom</span>
          <p className="text-[15px] text-stone-400 leading-relaxed font-light max-w-sm">
            Премиальная флористика и бережная доставка по Москве.
            Создаём композиции для важных моментов и отправляем фото перед доставкой.
          </p>
        </div>

        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-12">
          <div className="flex flex-col gap-6 text-[14px] font-light tracking-wide">
            <span className="font-medium text-white tracking-widest uppercase text-xs mb-2">Каталог</span>
            <Link to="/catalog" className="text-stone-400 hover:text-white transition-colors">Все букеты</Link>
            <Link to="/catalog?category=author" className="text-stone-400 hover:text-white transition-colors">Авторские</Link>
            <Link to="/catalog?category=peonies" className="text-stone-400 hover:text-white transition-colors">Пионы</Link>
            <Link to="/catalog?category=roses" className="text-stone-400 hover:text-white transition-colors">Розы</Link>
          </div>

          <div className="flex flex-col gap-6 text-[14px] font-light tracking-wide">
            <span className="font-medium text-white tracking-widest uppercase text-xs mb-2">Сервис</span>
            <Link to="/delivery" className="text-stone-400 hover:text-white transition-colors">Доставка и оплата</Link>
            <Link to="/faq" className="text-stone-400 hover:text-white transition-colors">Вопросы и ответы</Link>
            <Link to="/contacts" className="text-stone-400 hover:text-white transition-colors">Контакты</Link>
            <Link to="/account" className="text-stone-400 hover:text-white transition-colors">Личный кабинет</Link>
          </div>

          <div className="flex flex-col gap-6 text-[14px] font-light tracking-wide">
            <span className="font-medium text-white tracking-widest uppercase text-xs mb-2">Документы</span>
            <a href="tel:+79990000000" className="text-stone-300 text-lg hover:text-white transition-colors">+7 (999) 000-00-00</a>
            <a href="mailto:hello@mossybloom.ru" className="text-[#C2958B] hover:text-white transition-colors">hello@mossybloom.ru</a>
            <span className="text-stone-500 mt-2">Ежедневно 09:00 - 21:00</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-[13px] text-stone-500 font-light tracking-wide gap-3">
        <span>© 2026 Mossy Bloom. Все права защищены.</span>
        <div className="flex gap-8 mt-1 md:mt-0">
          <Link to="/privacy" className="hover:text-stone-300 transition-colors">Конфиденциальность</Link>
          <Link to="/oferta" className="hover:text-stone-300 transition-colors">Оферта</Link>
          <Link to="/terms" className="hover:text-stone-300 transition-colors">Пользовательское соглашение</Link>
        </div>
      </div>
    </footer>
  );
}

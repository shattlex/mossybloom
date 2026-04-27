import { ArrowRight, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router';
import { categories, products as legacyProducts } from '../data';
import { getProducts } from '../data/products';

export function Home() {
  const products = getProducts();
  const hitProducts = products.length > 0 ? products : [];

  return (
    <div className="flex flex-col w-full overflow-hidden">
      <section className="relative w-full h-[82vh] lg:h-[90vh] flex items-center justify-center mb-24 md:mb-36">
        <div className="absolute inset-2 md:inset-4 rounded-[2rem] md:rounded-[3rem] overflow-hidden bg-stone-200">
          <img
            src="https://images.unsplash.com/photo-1656846226062-344f1f179dbc?auto=format&fit=crop&q=80&w=2400"
            alt="Премиальная флористика"
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        </div>

        <div className="relative z-10 text-center max-w-4xl px-6 md:px-12 flex flex-col items-center mt-16">
          <span className="text-white/85 font-medium tracking-[0.2em] uppercase text-xs mb-8">Студия высокой флористики</span>
          <h1 className="text-5xl sm:text-7xl lg:text-[6.4rem] font-serif tracking-tight text-white mb-10 leading-[1.04]">
            Искусство дарить
            <br />
            <span className="italic font-light">чувства</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-12 font-light max-w-2xl">
            Премиальные букеты, стильная упаковка и бережная доставка по Москве.
          </p>
          <Link
            to="/catalog"
            className="group inline-flex items-center justify-center gap-4 bg-white/90 text-stone-900 px-10 py-5 rounded-full text-[14px] font-medium tracking-widest uppercase hover:bg-white transition-all duration-500"
          >
            Смотреть каталог
            <ArrowRight size={18} strokeWidth={1.5} className="group-hover:translate-x-1 transition-transform duration-300" />
          </Link>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-6 md:px-12 w-full mb-28 md:mb-40">
        <div className="flex flex-col md:flex-row justify-between items-end mb-14 gap-6">
          <h2 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-tight">Коллекции</h2>
          <p className="text-stone-500 font-light max-w-md md:text-right">Выберите стиль букета или соберите индивидуальную композицию в конструкторе.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {categories.slice(0, 4).map((category, index) => (
            <Link key={category.id} to={`/catalog?category=${category.id}`} className="group relative aspect-[3/4] bg-stone-100 rounded-2xl overflow-hidden flex flex-col justify-end p-8">
              <img
                src={legacyProducts[index % legacyProducts.length].image}
                alt={category.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />
              <span className="relative z-10 text-2xl font-serif text-white tracking-wide">{category.title}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-24 md:py-36 border-y border-stone-200/60 mb-24 md:mb-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 w-full">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <h2 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-tight">Хиты студии</h2>
            <Link to="/catalog" className="text-stone-500 hover:text-stone-900 text-[13px] font-medium tracking-widest uppercase border-b border-transparent hover:border-stone-900 pb-1">
              Смотреть все
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {hitProducts.slice(0, 4).map((product) => (
              <div key={product.id} className="group rounded-2xl p-4 md:p-5 bg-[#FAFAFA] hover:bg-white hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all border border-transparent hover:border-stone-100">
                <Link to={`/product/${product.id}`} className="block relative aspect-[3/4] bg-stone-100 rounded-xl mb-6 overflow-hidden">
                  <img src={product.image} alt={product.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700" />
                </Link>
                <Link to={`/product/${product.id}`}>
                  <h3 className="text-lg text-stone-900 font-serif mb-1 group-hover:text-[#C2958B] transition-colors">{product.name}</h3>
                  <p className="text-[15px] text-stone-500 font-light">{product.price.toLocaleString('ru-RU')} ₽</p>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-6 md:px-12 w-full mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-stone-100 p-8">
            <Truck className="text-[#C2958B] mb-4" />
            <h3 className="text-xl font-serif text-stone-900 mb-2">Доставка в день заказа</h3>
            <p className="text-stone-500">Быстрая доставка по Москве и области с предварительным фото.</p>
          </div>
          <div className="bg-white rounded-3xl border border-stone-100 p-8">
            <ShieldCheck className="text-[#C2958B] mb-4" />
            <h3 className="text-xl font-serif text-stone-900 mb-2">Гарантия свежести</h3>
            <p className="text-stone-500">Работаем только со свежими цветами от проверенных поставщиков.</p>
          </div>
          <div className="bg-white rounded-3xl border border-stone-100 p-8">
            <CheckCircle2 className="text-[#C2958B] mb-4" />
            <h3 className="text-xl font-serif text-stone-900 mb-2">Индивидуальный подход</h3>
            <p className="text-stone-500">Соберём авторскую композицию под ваш бюджет и повод.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

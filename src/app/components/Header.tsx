import { useState } from "react";
import { Heart, MapPin, Menu, Search, ShoppingBag, User } from "lucide-react";
import { Link } from "react-router";
import { getAuthToken } from "../api/client";
import { SearchModal } from "./SearchModal";
import { MobileMenu } from "./MobileMenu";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";

export function Header() {
  const { itemCount } = useCart();
  const { favoritesCount } = useFavorites();
  const isAuth = Boolean(getAuthToken());
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuItems = [
    { to: "/catalog", label: "Каталог" },
    { to: "/bouquet-builder", label: "Конструктор" },
    { to: "/delivery", label: "Доставка" },
    { to: "/about", label: "О нас" },
    { to: "/account", label: "Личный кабинет" }
  ];

  return (
    <>
      <header className="border-b border-stone-200/50 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 sticky top-0 z-50 transition-all duration-500">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 h-[80px] md:h-[96px] flex items-center justify-between">
          <div className="flex items-center gap-10 flex-1">
            <button className="hidden md:flex items-center gap-2 text-[13px] tracking-wide text-stone-500 hover:text-stone-900 transition-colors group">
              <MapPin size={16} className="text-[#C2958B] group-hover:scale-110 transition-transform duration-300" />
              <span className="font-medium uppercase tracking-widest">Москва</span>
            </button>
            <button
              className="md:hidden p-2 -ml-2 text-stone-800 hover:bg-stone-100 rounded-full transition-colors"
              aria-label="Меню"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} strokeWidth={1.5} />
            </button>

            <nav className="hidden lg:flex items-center gap-8 lg:mr-8 xl:mr-12 text-[14px] font-medium text-stone-600">
              <Link to="/catalog" className="whitespace-nowrap hover:text-[#C2958B] transition-colors">Каталог</Link>
              <Link to="/bouquet-builder" className="whitespace-nowrap hover:text-[#C2958B] transition-colors">Конструктор</Link>
              <Link to="/delivery" className="whitespace-nowrap hover:text-[#C2958B] transition-colors">Доставка</Link>
              <Link to="/about" className="whitespace-nowrap hover:text-[#C2958B] transition-colors">О нас</Link>
            </nav>
          </div>

          <Link to="/" className="text-3xl md:text-4xl font-serif tracking-tight text-stone-900 flex-shrink-0 flex items-center justify-center hover:opacity-80 transition-opacity">
            Mossy Bloom
          </Link>

          <div className="flex items-center gap-3 md:gap-4 flex-1 justify-end text-stone-800">
            <button
              className="p-2 rounded-full hover:bg-stone-100 transition-colors"
              aria-label="Поиск"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={22} strokeWidth={1.2} />
            </button>

            <Link to="/favorites" className="p-2 rounded-full hover:bg-stone-100 transition-colors flex items-center gap-1 group relative" aria-label="Избранное">
              <div className="relative">
                <Heart size={22} strokeWidth={1.2} className="group-hover:scale-105 transition-transform duration-300" />
                {favoritesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-stone-900 text-white text-[10px] font-medium min-w-4 h-4 px-1 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white">
                    {favoritesCount}
                  </span>
                )}
              </div>
            </Link>

            <Link to="/account" className="p-2 rounded-full hover:bg-stone-100 transition-colors hidden sm:block relative" aria-label="Профиль">
              <User size={22} strokeWidth={1.2} className={isAuth ? "text-[#C2958B]" : ""} />
            </Link>

            <Link to="/cart" className="p-2 rounded-full hover:bg-stone-100 transition-colors flex items-center gap-1 group relative" aria-label="Корзина">
              <div className="relative">
                <ShoppingBag size={22} strokeWidth={1.2} className="group-hover:scale-105 transition-transform duration-300" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#C2958B] text-white text-[10px] font-medium min-w-4 h-4 px-1 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white">
                    {itemCount}
                  </span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} items={mobileMenuItems} />
    </>
  );
}

import { motion, AnimatePresence } from 'motion/react';
import { X, Home, Grid, Package, Palette, Info, UserRound, Heart } from 'lucide-react';
import { Link } from 'react-router';

interface MobileMenuItem {
  to: string;
  label: string;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: MobileMenuItem[];
}

function iconFor(path: string) {
  if (path === '/') return <Home className="h-5 w-5" />;
  if (path === '/about') return <Info className="h-5 w-5" />;
  if (path === '/catalog') return <Grid className="h-5 w-5" />;
  if (path === '/bouquet-builder') return <Palette className="h-5 w-5" />;
  if (path === '/delivery') return <Package className="h-5 w-5" />;
  if (path === '/favorites') return <Heart className="h-5 w-5" />;
  if (path === '/account') return <UserRound className="h-5 w-5" />;
  if (path === '/contacts') return <Info className="h-5 w-5" />;
  return <Grid className="h-5 w-5" />;
}

export function MobileMenu({ isOpen, onClose, items }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[61] h-full w-[86%] max-w-[340px] border-l border-stone-200 bg-[#fefdfb] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="text-3xl text-stone-900" style={{ fontFamily: 'var(--font-script)' }}>
                Меню
              </h2>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-stone-100" aria-label="Закрыть меню">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="p-4" style={{ fontFamily: 'var(--font-sans)' }}>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
                    >
                      <span className="text-[#C2958B]">{iconFor(item.to)}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-6 border-t border-stone-200 pt-4 text-sm text-stone-500">
                <a href="mailto:sales@mossybloom.ru" className="transition-colors hover:text-stone-900">
                  sales@mossybloom.ru
                </a>
              </div>
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

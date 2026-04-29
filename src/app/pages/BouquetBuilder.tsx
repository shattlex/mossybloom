import { useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { OrderExtrasFields } from '../components/OrderExtrasFields';
import { useCart } from '../context/CartContext';
import { generatedConstructorFlowers } from '../data/generatedContentMedia';
import { inferConstructorFlowerColor, type ConstructorFlowerColor } from '../data/constructorFlowerColors';

interface Flower {
  id: string;
  name: string;
  price: number;
  image: string;
  fullImage: string;
  color: ConstructorFlowerColor;
}

interface SelectedFlower extends Flower {
  quantity: number;
}

const flowerCatalog: Flower[] = generatedConstructorFlowers.map((flower, index) => ({
  id: flower.id || `f-${index + 1}`,
  name: flower.name,
  price: 350,
  image: flower.image.replace('/products/constructor/', '/products/constructor-previews/'),
  fullImage: flower.image,
  color: inferConstructorFlowerColor(flower.name)
}));

const colors = [
  { id: 'all', label: 'Все' },
  { id: 'red', label: 'Красные' },
  { id: 'pink', label: 'Розовые' },
  { id: 'white', label: 'Белые' },
  { id: 'yellow', label: 'Жёлтые' },
  { id: 'blue', label: 'Голубые' },
  { id: 'green', label: 'Зелень' }
] as const;

export function BouquetBuilder() {
  const navigate = useNavigate();
  const { addToCart, orderExtras, setOrderExtras } = useCart();

  const [selectedColor, setSelectedColor] = useState<(typeof colors)[number]['id']>('all');
  const [bouquetName, setBouquetName] = useState('');
  const [selectedFlowers, setSelectedFlowers] = useState<SelectedFlower[]>([]);
  const [recentlyAddedFlowerId, setRecentlyAddedFlowerId] = useState<string | null>(null);
  const resetAddedTimerRef = useRef<number | null>(null);

  const filteredFlowers = useMemo(() => {
    if (selectedColor === 'all') return flowerCatalog;
    return flowerCatalog.filter((flower) => flower.color === selectedColor);
  }, [selectedColor]);

  const selectedQuantityById = useMemo(
    () => selectedFlowers.reduce<Record<string, number>>((acc, flower) => {
      acc[flower.id] = flower.quantity;
      return acc;
    }, {}),
    [selectedFlowers]
  );

  const flowerCount = useMemo(
    () => selectedFlowers.reduce((sum, flower) => sum + flower.quantity, 0),
    [selectedFlowers]
  );

  const bouquetPrice = useMemo(
    () => selectedFlowers.reduce((sum, flower) => sum + flower.price * flower.quantity, 0),
    [selectedFlowers]
  );

  function addFlower(flower: Flower) {
    setSelectedFlowers((prev) => {
      const existing = prev.find((item) => item.id === flower.id);
      if (existing) {
        return prev.map((item) =>
          item.id === flower.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...flower, quantity: 1 }];
    });

    setRecentlyAddedFlowerId(flower.id);
    if (resetAddedTimerRef.current) {
      window.clearTimeout(resetAddedTimerRef.current);
    }
    resetAddedTimerRef.current = window.setTimeout(() => {
      setRecentlyAddedFlowerId(null);
      resetAddedTimerRef.current = null;
    }, 700);
  }

  function changeQuantity(flowerId: string, nextQuantity: number) {
    if (nextQuantity <= 0) {
      setSelectedFlowers((prev) => prev.filter((item) => item.id !== flowerId));
      return;
    }

    setSelectedFlowers((prev) =>
      prev.map((item) => (item.id === flowerId ? { ...item, quantity: nextQuantity } : item))
    );
  }

  function removeFlower(flowerId: string) {
    setSelectedFlowers((prev) => prev.filter((item) => item.id !== flowerId));
  }

  function addBouquetToCart() {
    if (selectedFlowers.length === 0) return;

    const title = bouquetName.trim() || `Авторский букет (${flowerCount} шт)`;
    const composition = selectedFlowers
      .map((item) => `${item.name} x${item.quantity}`)
      .join(', ');

    addToCart(
      {
        id: `custom-${Date.now()}`,
        title,
        price: bouquetPrice,
        image: selectedFlowers[0]?.fullImage || flowerCatalog[0].fullImage,
        category: 'custom',
        description: `Собран в конструкторе: ${composition}`,
        sizes: [{ value: 'custom', label: 'custom', price: bouquetPrice }]
      },
      'custom'
    );

    setOrderExtras(orderExtras);
    navigate('/cart');
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 w-full flex-1 min-h-screen">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-12 flex items-center gap-4">
        <Link to="/" className="hover:text-stone-900 transition-colors">Главная</Link>
        <span className="w-[3px] h-[3px] bg-stone-300 rounded-full" />
        <span className="text-stone-900 font-medium">Конструктор букетов</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
        <h1 className="text-5xl md:text-6xl font-serif text-stone-900 tracking-tight">Конструктор букетов</h1>
        <p className="text-stone-500 max-w-md">Соберите индивидуальную композицию, добавьте открытку и упаковку, затем отправьте в корзину.</p>
      </div>

      <div className="md:hidden fixed left-4 right-4 top-[88px] z-40 rounded-2xl border border-stone-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-stone-500">Ваш букет</p>
            <p className="text-sm text-stone-900 mt-1">{flowerCount} шт • {bouquetPrice.toLocaleString('ru-RU')} ₽</p>
          </div>
          <button
            onClick={addBouquetToCart}
            disabled={selectedFlowers.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-[11px] tracking-widest uppercase font-medium text-white disabled:opacity-60"
          >
            <ShoppingBag size={14} />
            В корзину
          </button>
        </div>
      </div>

      <div className="h-20 md:hidden" />

      <div className="flex flex-col xl:grid xl:grid-cols-12 gap-10 xl:gap-16">
        <section className="order-2 xl:order-1 xl:col-span-8 space-y-8">
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color.id}
                onClick={() => setSelectedColor(color.id)}
                className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                  selectedColor === color.id
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
              >
                {color.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {filteredFlowers.map((flower, index) => {
              const selectedQuantity = selectedQuantityById[flower.id] ?? 0;
              const isSelected = selectedQuantity > 0;
              const isRecentlyAdded = recentlyAddedFlowerId === flower.id;

              return (
                <button
                  key={flower.id}
                  onClick={() => addFlower(flower)}
                  className={`group relative text-left p-4 md:p-5 rounded-2xl transition-all duration-300 border ${
                    isSelected
                      ? 'bg-white border-[#C2958B] shadow-[0_12px_30px_rgba(194,149,139,0.22)]'
                      : 'bg-transparent border-transparent hover:bg-white hover:border-stone-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]'
                  } ${isRecentlyAdded ? 'scale-[1.02]' : ''}`}
                >
                  {isSelected && (
                    <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
                      <Check className="h-3.5 w-3.5" />
                      x{selectedQuantity}
                    </span>
                  )}

                  <div className="aspect-square bg-stone-100 rounded-xl overflow-hidden mb-4">
                    <img
                      src={flower.image}
                      alt={flower.name}
                      loading={index < 8 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.2s] ease-[cubic-bezier(0.25,1,0.5,1)]"
                    />
                  </div>
                  <div className="px-2">
                    <p className="font-medium text-stone-900">{flower.name}</p>
                    <p className="text-sm text-stone-500 mt-1">{flower.price.toLocaleString('ru-RU')} ₽ / шт</p>
                    <p className={`text-xs mt-2 transition-colors ${isSelected ? 'text-[#C2958B] font-medium' : 'text-stone-400'}`}>
                      {isSelected ? 'Выбрано в букет' : 'Нажмите, чтобы добавить'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="order-1 xl:order-2 xl:col-span-4">
          <div className="bg-white p-8 rounded-[2rem] border border-stone-100 shadow-[0_20px_60px_rgba(0,0,0,0.04)] sticky top-[88px] z-20 xl:top-32 space-y-6 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto">
            <h2 className="text-3xl font-serif text-stone-900">Ваш букет</h2>

            <input
              type="text"
              value={bouquetName}
              onChange={(e) => setBouquetName(e.target.value)}
              placeholder="Название букета (опционально)"
              className="w-full border border-stone-200 rounded-xl px-4 py-3"
            />

            <div className="space-y-3 max-h-72 overflow-auto pr-1">
              {selectedFlowers.length === 0 ? (
                <div className="text-sm text-stone-500">Добавьте цветы из каталога слева.</div>
              ) : (
                selectedFlowers.map((flower) => (
                  <div key={flower.id} className="flex items-center gap-3 border border-stone-200 rounded-xl p-3">
                    <img src={flower.image} alt={flower.name} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{flower.name}</p>
                      <p className="text-xs text-stone-500">{flower.price.toLocaleString('ru-RU')} ₽</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQuantity(flower.id, flower.quantity - 1)} className="p-1 rounded-full hover:bg-stone-100" aria-label="Уменьшить">
                        <Minus size={14} />
                      </button>
                      <span className="text-sm w-6 text-center">{flower.quantity}</span>
                      <button onClick={() => changeQuantity(flower.id, flower.quantity + 1)} className="p-1 rounded-full hover:bg-stone-100" aria-label="Увеличить">
                        <Plus size={14} />
                      </button>
                      <button onClick={() => removeFlower(flower.id)} className="p-1 rounded-full hover:bg-red-50 text-red-500" aria-label="Удалить">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-stone-200">
              <OrderExtrasFields extras={orderExtras} onChange={setOrderExtras} title="Дополнительно" />
            </div>

            <div className="pt-4 border-t border-stone-200 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Цветов в букете</span>
                <span className="font-medium text-stone-900">{flowerCount} шт</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Стоимость</span>
                <span className="text-xl font-serif text-stone-900">{bouquetPrice.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>

            <button
              onClick={addBouquetToCart}
              disabled={selectedFlowers.length === 0}
              className="w-full bg-stone-900 text-white rounded-xl py-4 text-[12px] tracking-[0.2em] uppercase font-medium hover:bg-[#C2958B] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 xl:sticky xl:bottom-0 xl:z-10"
            >
              <ShoppingBag size={16} />
              Добавить в корзину
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}






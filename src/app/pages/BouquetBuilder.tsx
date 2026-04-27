import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
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

  const filteredFlowers = useMemo(() => {
    if (selectedColor === 'all') return flowerCatalog;
    return flowerCatalog.filter((flower) => flower.color === selectedColor);
  }, [selectedColor]);

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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:gap-16">
        <section className="xl:col-span-8 space-y-8">
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
            {filteredFlowers.map((flower, index) => (
              <button
                key={flower.id}
                onClick={() => addFlower(flower)}
                className="group text-left p-4 md:p-5 bg-transparent border border-transparent rounded-2xl hover:bg-white hover:border-stone-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all duration-500"
              >
                <div className="aspect-square bg-stone-100 rounded-xl overflow-hidden mb-4">
                  <img
                    src={flower.image}
                    alt={flower.name}
                    loading={index < 8 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-[cubic-bezier(0.25,1,0.5,1)]"
                  />
                </div>
                <div className="px-2">
                  <p className="font-medium text-stone-900">{flower.name}</p>
                  <p className="text-sm text-stone-500 mt-1">{flower.price.toLocaleString('ru-RU')} ₽ / шт</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="xl:col-span-4">
          <div className="bg-white p-8 rounded-[2rem] border border-stone-100 shadow-[0_20px_60px_rgba(0,0,0,0.04)] xl:sticky xl:top-32 space-y-6">
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
              className="w-full bg-stone-900 text-white rounded-xl py-4 text-[12px] tracking-[0.2em] uppercase font-medium hover:bg-[#C2958B] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

import { motion } from 'motion/react';
import { Clock, MapPin, Package, Camera, Shield, HeartHandshake, type LucideIcon } from 'lucide-react';
import { findCmsPage, type CmsBlock } from '../cms/content';
import { useCmsContent } from '../cms/useCmsContent';

interface DeliveryOption {
  icon: LucideIcon;
  title: string;
  time: string;
  price: string;
  description: string;
}

interface AdvantageItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface ZoneItem {
  title: string;
  price: string;
}

const iconMap: Record<string, LucideIcon> = {
  clock: Clock,
  package: Package,
  'map-pin': MapPin,
  camera: Camera,
  shield: Shield,
  heart: HeartHandshake
};

const fallbackDeliveryOptions: DeliveryOption[] = [
  { icon: Clock, title: 'Экспресс-доставка', time: '60 минут', price: 'Бесплатно от 5000 ₽', description: 'Доставим ваш букет в течение часа по Москве' },
  { icon: Package, title: 'Стандартная доставка', time: '3 часа', price: '500 ₽', description: 'Доставка в удобное для вас время' },
  { icon: MapPin, title: 'Самовывоз', time: 'Сегодня', price: 'Бесплатно', description: 'Заберите букет из нашей студии' }
];

const fallbackAdvantages: AdvantageItem[] = [
  { icon: Camera, title: 'Фото перед отправкой', description: 'Отправим вам фото букета перед доставкой' },
  { icon: Shield, title: 'Гарантия качества', description: 'Вернем деньги, если что-то пойдет не так' },
  { icon: HeartHandshake, title: 'Индивидуальный подход', description: 'Учтем все ваши пожелания и комментарии' }
];

const fallbackZones: ZoneItem[] = [
  { title: 'В пределах МКАД', price: 'Бесплатно от 5000 ₽' },
  { title: 'За МКАД (до 10 км)', price: '500 ₽' },
  { title: 'За МКАД (10-30 км)', price: '1000 ₽' },
  { title: 'Московская область', price: 'По договоренности' }
];

function readSectionTitles(blocks: CmsBlock[]): string[] {
  return blocks
    .filter((block) => block.type === 'sectionTitle' && typeof block.text === 'string' && block.text.trim())
    .map((block) => block.text.trim());
}

function readSubtitle(blocks: CmsBlock[]): string {
  const subtitleBlock = blocks.find(
    (block) => block.type === 'text' && typeof block.title === 'string' && block.title.trim().toLowerCase() === 'subtitle'
  );
  if (typeof subtitleBlock?.body === 'string' && subtitleBlock.body.trim()) return subtitleBlock.body;
  return 'Доставляем свежие букеты по Москве и области с заботой о каждом цветке';
}

function toIcon(meta: unknown, fallback: LucideIcon): LucideIcon {
  if (typeof meta !== 'string') return fallback;
  return iconMap[meta.trim().toLowerCase()] ?? fallback;
}

function readProductsBlock(blocks: CmsBlock[], title: string): unknown[] {
  const block = blocks.find(
    (item) => item.type === 'products' && typeof item.title === 'string' && item.title.trim().toLowerCase() === title
  );
  if (!block || !Array.isArray(block.items)) return [];
  return block.items;
}

export function Delivery() {
  const cmsContent = useCmsContent();
  const cmsPage = findCmsPage(cmsContent, 'delivery');
  const blocks = cmsPage?.blocks ?? [];

  const sectionTitles = readSectionTitles(blocks);
  const pageTitle = sectionTitles[0] ?? 'Доставка цветов';
  const advantagesTitle = sectionTitles[1] ?? 'Наши преимущества';
  const zonesTitle = sectionTitles[2] ?? 'Зоны доставки';
  const subtitle = readSubtitle(blocks);

  const deliveryOptionsFromCms = readProductsBlock(blocks, 'delivery-options')
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.name === 'string' ? record.name.trim() : '';
      if (!title) return null;

      return {
        icon: toIcon(record.meta, Clock),
        title,
        time: typeof record.subtitle === 'string' && record.subtitle.trim() ? record.subtitle : '60 минут',
        price: typeof record.price === 'string' && record.price.trim() ? record.price : 'По договоренности',
        description: typeof record.description === 'string' && record.description.trim() ? record.description : ''
      } satisfies DeliveryOption;
    })
    .filter((item): item is DeliveryOption => item !== null);

  const advantagesFromCms = readProductsBlock(blocks, 'advantages')
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.name === 'string' ? record.name.trim() : '';
      if (!title) return null;

      return {
        icon: toIcon(record.meta, Camera),
        title,
        description: typeof record.description === 'string' && record.description.trim() ? record.description : ''
      } satisfies AdvantageItem;
    })
    .filter((item): item is AdvantageItem => item !== null);

  const zonesFromCms = readProductsBlock(blocks, 'delivery-zones')
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.name === 'string' ? record.name.trim() : '';
      if (!title) return null;

      return {
        title,
        price: typeof record.price === 'string' && record.price.trim() ? record.price : 'По договоренности'
      } satisfies ZoneItem;
    })
    .filter((item): item is ZoneItem => item !== null);

  const deliveryOptions = deliveryOptionsFromCms.length > 0 ? deliveryOptionsFromCms : fallbackDeliveryOptions;
  const advantages = advantagesFromCms.length > 0 ? advantagesFromCms : fallbackAdvantages;
  const zones = zonesFromCms.length > 0 ? zonesFromCms : fallbackZones;

  return (
    <div className="min-h-screen pb-16 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-light italic mb-6" style={{ fontFamily: 'var(--font-script)' }}>{pageTitle}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
            {subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {deliveryOptions.map((option, index) => (
            <motion.div key={`${option.title}-${index}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <option.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-light mb-2" style={{ fontFamily: 'var(--font-script)' }}>{option.title}</h3>
              <p className="text-3xl font-medium text-primary mb-2" style={{ fontFamily: 'var(--font-sans)' }}>{option.time}</p>
              <p className="text-lg text-gray-700 mb-3" style={{ fontFamily: 'var(--font-sans)' }}>{option.price}</p>
              <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>{option.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-gray-200 mb-20">
          <h2 className="text-4xl font-light italic text-center mb-12" style={{ fontFamily: 'var(--font-script)' }}>{advantagesTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {advantages.map((advantage, index) => (
              <div key={`${advantage.title}-${index}`} className="text-center">
                <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <advantage.icon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-3" style={{ fontFamily: 'var(--font-sans)' }}>{advantage.title}</h3>
                <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>{advantage.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-gray-200">
          <h2 className="text-4xl font-light italic text-center mb-8" style={{ fontFamily: 'var(--font-script)' }}>{zonesTitle}</h2>
          <div className="space-y-4">
            {zones.map((zone, index) => (
              <div key={`${zone.title}-${index}`} className={`flex items-center justify-between py-4 ${index < zones.length - 1 ? 'border-b border-gray-200' : ''}`}>
                <span className="text-lg" style={{ fontFamily: 'var(--font-sans)' }}>{zone.title}</span>
                <span className="text-lg font-medium text-primary" style={{ fontFamily: 'var(--font-sans)' }}>{zone.price}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}




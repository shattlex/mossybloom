import { useEffect, useState } from 'react';
import {
  DEFAULT_ORDER_EXTRAS,
  ORDER_POSTCARD_MAX_LENGTH,
  type GiftWrapColor,
  type GiftWrapType,
  type OrderExtras,
  type RibbonColor
} from '../types/orderExtras';

interface OrderExtrasFieldsProps {
  extras: OrderExtras;
  onChange: (extras: OrderExtras) => void;
  title?: string;
}

const wrapLabels: Record<GiftWrapType, string> = {
  none: 'Без упаковки',
  kraft: 'Крафт',
  colored: 'Цветная бумага',
  transparent: 'Прозрачная упаковка'
};

const wrapColorLabels: Record<GiftWrapColor, string> = {
  blush: 'Розовая',
  ivory: 'Кремовая',
  mint: 'Мятная',
  lilac: 'Сиреневая'
};

const ribbonColorLabels: Record<RibbonColor, string> = {
  none: 'Без ленты',
  white: 'Белая',
  pink: 'Розовая',
  red: 'Красная',
  gold: 'Золотая',
  green: 'Зеленая'
};

const wrapColorStyles: Record<GiftWrapColor, string> = {
  blush: '#f4b9c6',
  ivory: '#e9ddc6',
  mint: '#b7decf',
  lilac: '#cfb8ea'
};

const ribbonColorStyles: Record<Exclude<RibbonColor, 'none'>, string> = {
  white: '#ffffff',
  pink: '#e67ab6',
  red: '#d44444',
  gold: '#d4af37',
  green: '#4f9d69'
};

export function OrderExtrasFields({ extras, onChange, title = 'Дополнительно' }: OrderExtrasFieldsProps) {
  const normalizedExtras = extras || DEFAULT_ORDER_EXTRAS;
  const [showPostcardInput, setShowPostcardInput] = useState(Boolean(normalizedExtras.postcardText.trim()));

  useEffect(() => {
    setShowPostcardInput(Boolean(normalizedExtras.postcardText.trim()));
  }, [normalizedExtras.postcardText]);

  const setWrapType = (type: GiftWrapType) => {
    if (type === 'none') {
      onChange({ ...normalizedExtras, giftWrapType: 'none', giftWrap: false });
      return;
    }
    onChange({ ...normalizedExtras, giftWrapType: type, giftWrap: true });
  };

  const setWrapColor = (color: GiftWrapColor) => {
    onChange({
      ...normalizedExtras,
      giftWrapType: normalizedExtras.giftWrapType === 'none' ? 'colored' : normalizedExtras.giftWrapType,
      giftWrap: true,
      giftWrapColor: color
    });
  };

  const setRibbonColor = (color: RibbonColor) => {
    onChange({ ...normalizedExtras, ribbonColor: color, ribbon: color !== 'none' });
  };

  const activeWrapType = normalizedExtras.giftWrapType;
  const activeRibbonColor = normalizedExtras.ribbonColor;

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-xl">{title}</h3>

      <div className="space-y-2">
        <p className="text-sm font-medium">Упаковка</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(['none', 'kraft', 'colored', 'transparent'] as GiftWrapType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setWrapType(type)}
              className={`px-3 py-2 rounded-xl border text-sm text-left transition ${
                activeWrapType === type ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {wrapLabels[type]}
            </button>
          ))}
        </div>
      </div>

      {activeWrapType === 'colored' && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Цвет бумаги</p>
          <div className="flex flex-wrap gap-2">
            {(['blush', 'ivory', 'mint', 'lilac'] as GiftWrapColor[]).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setWrapColor(color)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
                  normalizedExtras.giftWrapColor === color ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: wrapColorStyles[color] }} />
                {wrapColorLabels[color]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Лента</p>
        <div className="flex flex-wrap gap-2">
          {(['none', 'white', 'pink', 'red', 'gold', 'green'] as RibbonColor[]).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setRibbonColor(color)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
                activeRibbonColor === color ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {color !== 'none' && (
                <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: ribbonColorStyles[color] }} />
              )}
              {ribbonColorLabels[color]}
            </button>
          ))}
        </div>
      </div>

      {!showPostcardInput ? (
        <button type="button" onClick={() => setShowPostcardInput(true)} className="text-primary hover:underline">
          Добавить открытку
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Текст открытки</p>
            <button
              type="button"
              onClick={() => {
                setShowPostcardInput(false);
                onChange({ ...normalizedExtras, postcardText: '' });
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Удалить открытку
            </button>
          </div>
          <textarea
            value={normalizedExtras.postcardText}
            onChange={(e) => onChange({ ...normalizedExtras, postcardText: e.target.value.slice(0, ORDER_POSTCARD_MAX_LENGTH) })}
            rows={3}
            maxLength={ORDER_POSTCARD_MAX_LENGTH}
            placeholder="Введите текст открытки"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary resize-none"
          />
          <p className="text-xs text-gray-500">
            {normalizedExtras.postcardText.length}/{ORDER_POSTCARD_MAX_LENGTH}
          </p>
        </div>
      )}
    </div>
  );
}


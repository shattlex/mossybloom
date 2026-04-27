export interface ProductSize {
  value: string;
  label: string;
  price: number;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  images: string[];
  category: string;
  description: string;
  isNew?: boolean;
  isPopular?: boolean;
  sizes: ProductSize[];
}

const FIXED_SIZE_PRICES = {
  S: 5000,
  M: 8500,
  L: 13500
} as const;

type SizeValue = keyof typeof FIXED_SIZE_PRICES;

function normalizeSizeValue(value: string, index: number): SizeValue {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "S" || normalized === "M" || normalized === "L") {
    return normalized;
  }
  if (index === 0) return "S";
  if (index === 1) return "M";
  return "L";
}

function applyFixedProductPricing(product: Product): Product {
  const normalizedSizes = product.sizes.map((size, index) => {
    const normalizedValue = normalizeSizeValue(size.value, index);
    return {
      ...size,
      value: normalizedValue,
      price: FIXED_SIZE_PRICES[normalizedValue]
    };
  });

  return {
    ...product,
    price: FIXED_SIZE_PRICES.S,
    sizes: normalizedSizes
  };
}

export const products: Product[] = [
  {
    id: "rose-001",
    title: "Аваланж Белая",
    price: 3200,
    image: "/products/roses/rose-001/1.webp",
    images: [
      "/products/roses/rose-001/1.webp",
      "/products/roses/rose-001/2.webp",
      "/products/roses/rose-001/3.webp",
    ],
    category: "roses",
    description: "Роза «Аваланж Белая» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Аваланж Белая» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    isNew: true,
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 2600 },
      { value: "M", label: "M", price: 3200 },
      { value: "L", label: "L", price: 4100 }
    ]
  },
  {
    id: "rose-002",
    title: "Аква",
    price: 3450,
    image: "/products/roses/rose-002/1.webp",
    images: [
      "/products/roses/rose-002/1.webp",
      "/products/roses/rose-002/2.webp",
      "/products/roses/rose-002/3.webp",
    ],
    category: "roses",
    description: "Сорт «Аква» выбирают за насыщенный оттенок и премиальный вид в монобукете. Эти розы хорошо смотрятся как самостоятельная композиция и в авторских миксах. Закажите букет из роз «Аква» с доставкой и фото перед отправкой, чтобы заранее согласовать итоговый вид.",
    isNew: true,
    sizes: [
      { value: "S", label: "S", price: 2850 },
      { value: "M", label: "M", price: 3450 },
      { value: "L", label: "L", price: 4350 }
    ]
  },
  {
    id: "rose-003",
    title: "Барбодос",
    price: 3700,
    image: "/products/roses/rose-003/1.webp",
    images: [
      "/products/roses/rose-003/1.webp",
      "/products/roses/rose-003/2.webp",
      "/products/roses/rose-003/3.webp",
    ],
    category: "roses",
    description: "Розы «Барбодос» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Барбодос» онлайн с быстрой доставкой по Москве и области.",
    isNew: true,
    sizes: [
      { value: "S", label: "S", price: 3100 },
      { value: "M", label: "M", price: 3700 },
      { value: "L", label: "L", price: 4600 }
    ]
  },
  {
    id: "rose-004",
    title: "Баттеркап",
    price: 3950,
    image: "/products/roses/rose-004/1.webp",
    images: [
      "/products/roses/rose-004/1.webp",
      "/products/roses/rose-004/2.webp",
      "/products/roses/rose-004/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Баттеркап» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    isNew: true,
    sizes: [
      { value: "S", label: "S", price: 3350 },
      { value: "M", label: "M", price: 3950 },
      { value: "L", label: "L", price: 4850 }
    ]
  },
  {
    id: "rose-005",
    title: "Вайт Барбодос",
    price: 4200,
    image: "/products/roses/rose-005/1.webp",
    images: [
      "/products/roses/rose-005/1.webp",
      "/products/roses/rose-005/2.webp",
      "/products/roses/rose-005/3.webp",
    ],
    category: "roses",
    description: "Роза «Вайт Барбодос» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Вайт Барбодос», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    isNew: true,
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 3600 },
      { value: "M", label: "M", price: 4200 },
      { value: "L", label: "L", price: 5100 }
    ]
  },
  {
    id: "rose-006",
    title: "Вау",
    price: 4450,
    image: "/products/roses/rose-006/1.webp",
    images: [
      "/products/roses/rose-006/1.webp",
      "/products/roses/rose-006/2.webp",
      "/products/roses/rose-006/3.webp",
    ],
    category: "roses",
    description: "Роза «Вау» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Вау» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    isNew: true,
    sizes: [
      { value: "S", label: "S", price: 3850 },
      { value: "M", label: "M", price: 4450 },
      { value: "L", label: "L", price: 5350 }
    ]
  },
  {
    id: "rose-007",
    title: "Грация",
    price: 4700,
    image: "/products/roses/rose-007/1.webp",
    images: [
      "/products/roses/rose-007/1.webp",
      "/products/roses/rose-007/2.webp",
      "/products/roses/rose-007/3.webp",
    ],
    category: "roses",
    description: "Сорт «Грация» выбирают за насыщенный оттенок и премиальный вид в монобукете. Эти розы хорошо смотрятся как самостоятельная композиция и в авторских миксах. Закажите букет из роз «Грация» с доставкой и фото перед отправкой, чтобы заранее согласовать итоговый вид.",
    sizes: [
      { value: "S", label: "S", price: 4100 },
      { value: "M", label: "M", price: 4700 },
      { value: "L", label: "L", price: 5600 }
    ]
  },
  {
    id: "rose-008",
    title: "Джумилия",
    price: 3200,
    image: "/products/roses/rose-008/1.webp",
    images: [
      "/products/roses/rose-008/1.webp",
      "/products/roses/rose-008/2.webp",
      "/products/roses/rose-008/3.webp",
    ],
    category: "roses",
    description: "Розы «Джумилия» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Джумилия» онлайн с быстрой доставкой по Москве и области.",
    sizes: [
      { value: "S", label: "S", price: 2600 },
      { value: "M", label: "M", price: 3200 },
      { value: "L", label: "L", price: 4100 }
    ]
  },
  {
    id: "rose-009",
    title: "Испана",
    price: 3450,
    image: "/products/roses/rose-009/1.webp",
    images: [
      "/products/roses/rose-009/1.webp",
      "/products/roses/rose-009/2.webp",
      "/products/roses/rose-009/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Испана» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 2850 },
      { value: "M", label: "M", price: 3450 },
      { value: "L", label: "L", price: 4350 }
    ]
  },
  {
    id: "rose-010",
    title: "Кимберли",
    price: 3700,
    image: "/products/roses/rose-010/1.webp",
    images: [
      "/products/roses/rose-010/1.webp",
      "/products/roses/rose-010/2.webp",
      "/products/roses/rose-010/3.webp",
    ],
    category: "roses",
    description: "Роза «Кимберли» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Кимберли», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    sizes: [
      { value: "S", label: "S", price: 3100 },
      { value: "M", label: "M", price: 3700 },
      { value: "L", label: "L", price: 4600 }
    ]
  },
  {
    id: "rose-011",
    title: "Кинг бабблс",
    price: 3950,
    image: "/products/roses/rose-011/1.webp",
    images: [
      "/products/roses/rose-011/1.webp",
      "/products/roses/rose-011/2.webp",
      "/products/roses/rose-011/3.webp",
    ],
    category: "roses",
    description: "Роза «Кинг бабблс» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Кинг бабблс» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    sizes: [
      { value: "S", label: "S", price: 3350 },
      { value: "M", label: "M", price: 3950 },
      { value: "L", label: "L", price: 4850 }
    ]
  },
  {
    id: "rose-013",
    title: "Лавандер бабблс",
    price: 4450,
    image: "/products/roses/rose-013/1.webp",
    images: [
      "/products/roses/rose-013/1.webp",
      "/products/roses/rose-013/2.webp",
      "/products/roses/rose-013/3.webp",
    ],
    category: "roses",
    description: "Розы «Лавандер бабблс» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Лавандер бабблс» онлайн с быстрой доставкой по Москве и области.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 3850 },
      { value: "M", label: "M", price: 4450 },
      { value: "L", label: "L", price: 5350 }
    ]
  },
  {
    id: "rose-014",
    title: "Лавли Лидия",
    price: 4700,
    image: "/products/roses/rose-014/1.webp",
    images: [
      "/products/roses/rose-014/1.webp",
      "/products/roses/rose-014/2.webp",
      "/products/roses/rose-014/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Лавли Лидия» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    sizes: [
      { value: "S", label: "S", price: 4100 },
      { value: "M", label: "M", price: 4700 },
      { value: "L", label: "L", price: 5600 }
    ]
  },
  {
    id: "rose-015",
    title: "Леди бомбастик",
    price: 3200,
    image: "/products/roses/rose-015/1.webp",
    images: [
      "/products/roses/rose-015/1.webp",
      "/products/roses/rose-015/2.webp",
      "/products/roses/rose-015/3.webp",
    ],
    category: "roses",
    description: "Роза «Леди бомбастик» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Леди бомбастик», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    sizes: [
      { value: "S", label: "S", price: 2600 },
      { value: "M", label: "M", price: 3200 },
      { value: "L", label: "L", price: 4100 }
    ]
  },
  {
    id: "rose-016",
    title: "Лидия",
    price: 3450,
    image: "/products/roses/rose-016/1.webp",
    images: [
      "/products/roses/rose-016/1.webp",
      "/products/roses/rose-016/2.webp",
      "/products/roses/rose-016/3.webp",
    ],
    category: "roses",
    description: "Роза «Лидия» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Лидия» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    sizes: [
      { value: "S", label: "S", price: 2850 },
      { value: "M", label: "M", price: 3450 },
      { value: "L", label: "L", price: 4350 }
    ]
  },
  {
    id: "rose-017",
    title: "Лондон Таймс",
    price: 3700,
    image: "/products/roses/rose-017/1.webp",
    images: [
      "/products/roses/rose-017/1.webp",
      "/products/roses/rose-017/2.webp",
      "/products/roses/rose-017/3.webp",
    ],
    category: "roses",
    description: "Сорт «Лондон Таймс» выбирают за насыщенный оттенок и премиальный вид в монобукете. Эти розы хорошо смотрятся как самостоятельная композиция и в авторских миксах. Закажите букет из роз «Лондон Таймс» с доставкой и фото перед отправкой, чтобы заранее согласовать итоговый вид.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 3100 },
      { value: "M", label: "M", price: 3700 },
      { value: "L", label: "L", price: 4600 }
    ]
  },
  {
    id: "rose-018",
    title: "Марвелос бабблс",
    price: 3950,
    image: "/products/roses/rose-018/1.webp",
    images: [
      "/products/roses/rose-018/1.webp",
      "/products/roses/rose-018/2.webp",
      "/products/roses/rose-018/3.webp",
    ],
    category: "roses",
    description: "Розы «Марвелос бабблс» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Марвелос бабблс» онлайн с быстрой доставкой по Москве и области.",
    sizes: [
      { value: "S", label: "S", price: 3350 },
      { value: "M", label: "M", price: 3950 },
      { value: "L", label: "L", price: 4850 }
    ]
  },
  {
    id: "rose-019",
    title: "Маритим",
    price: 4200,
    image: "/products/roses/rose-019/1.webp",
    images: [
      "/products/roses/rose-019/1.webp",
      "/products/roses/rose-019/2.webp",
      "/products/roses/rose-019/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Маритим» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    sizes: [
      { value: "S", label: "S", price: 3600 },
      { value: "M", label: "M", price: 4200 },
      { value: "L", label: "L", price: 5100 }
    ]
  },
  {
    id: "rose-020",
    title: "Мисс Пигги",
    price: 4450,
    image: "/products/roses/rose-020/1.webp",
    images: [
      "/products/roses/rose-020/1.webp",
      "/products/roses/rose-020/2.webp",
      "/products/roses/rose-020/3.webp",
    ],
    category: "roses",
    description: "Роза «Мисс Пигги» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Мисс Пигги», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    sizes: [
      { value: "S", label: "S", price: 3850 },
      { value: "M", label: "M", price: 4450 },
      { value: "L", label: "L", price: 5350 }
    ]
  },
  {
    id: "rose-021",
    title: "Мисти бабблс",
    price: 4700,
    image: "/products/roses/rose-021/1.webp",
    images: [
      "/products/roses/rose-021/1.webp",
      "/products/roses/rose-021/2.webp",
      "/products/roses/rose-021/3.webp",
    ],
    category: "roses",
    description: "Роза «Мисти бабблс» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Мисти бабблс» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 4100 },
      { value: "M", label: "M", price: 4700 },
      { value: "L", label: "L", price: 5600 }
    ]
  },
  {
    id: "rose-022",
    title: "Пакая",
    price: 3200,
    image: "/products/roses/rose-022/1.webp",
    images: [
      "/products/roses/rose-022/1.webp",
      "/products/roses/rose-022/2.webp",
      "/products/roses/rose-022/3.webp",
    ],
    category: "roses",
    description: "Сорт «Пакая» выбирают за насыщенный оттенок и премиальный вид в монобукете. Эти розы хорошо смотрятся как самостоятельная композиция и в авторских миксах. Закажите букет из роз «Пакая» с доставкой и фото перед отправкой, чтобы заранее согласовать итоговый вид.",
    sizes: [
      { value: "S", label: "S", price: 2600 },
      { value: "M", label: "M", price: 3200 },
      { value: "L", label: "L", price: 4100 }
    ]
  },
  {
    id: "rose-023",
    title: "Пени Лейн",
    price: 3450,
    image: "/products/roses/rose-023/1.webp",
    images: [
      "/products/roses/rose-023/1.webp",
      "/products/roses/rose-023/2.webp",
      "/products/roses/rose-023/3.webp",
    ],
    category: "roses",
    description: "Розы «Пени Лейн» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Пени Лейн» онлайн с быстрой доставкой по Москве и области.",
    sizes: [
      { value: "S", label: "S", price: 2850 },
      { value: "M", label: "M", price: 3450 },
      { value: "L", label: "L", price: 4350 }
    ]
  },
  {
    id: "rose-024",
    title: "Пинк Аваланж",
    price: 3700,
    image: "/products/roses/rose-024/1.webp",
    images: [
      "/products/roses/rose-024/1.webp",
      "/products/roses/rose-024/2.webp",
      "/products/roses/rose-024/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Пинк Аваланж» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    sizes: [
      { value: "S", label: "S", price: 3100 },
      { value: "M", label: "M", price: 3700 },
      { value: "L", label: "L", price: 4600 }
    ]
  },
  {
    id: "rose-025",
    title: "Пинк дименшн",
    price: 3950,
    image: "/products/roses/rose-025/1.webp",
    images: [
      "/products/roses/rose-025/1.webp",
      "/products/roses/rose-025/2.webp",
      "/products/roses/rose-025/3.webp",
    ],
    category: "roses",
    description: "Роза «Пинк дименшн» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Пинк дименшн», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 3350 },
      { value: "M", label: "M", price: 3950 },
      { value: "L", label: "L", price: 4850 }
    ]
  },
  {
    id: "rose-026",
    title: "Пинк Флойд",
    price: 4200,
    image: "/products/roses/rose-026/1.webp",
    images: [
      "/products/roses/rose-026/1.webp",
      "/products/roses/rose-026/2.webp",
      "/products/roses/rose-026/3.webp",
    ],
    category: "roses",
    description: "Роза «Пинк Флойд» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Пинк Флойд» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    sizes: [
      { value: "S", label: "S", price: 3600 },
      { value: "M", label: "M", price: 4200 },
      { value: "L", label: "L", price: 5100 }
    ]
  },
  {
    id: "rose-027",
    title: "Пиони бабблс",
    price: 4450,
    image: "/products/roses/rose-027/1.webp",
    images: [
      "/products/roses/rose-027/1.webp",
      "/products/roses/rose-027/2.webp",
      "/products/roses/rose-027/3.webp",
    ],
    category: "roses",
    description: "Сорт «Пиони бабблс» выбирают за насыщенный оттенок и премиальный вид в монобукете. Эти розы хорошо смотрятся как самостоятельная композиция и в авторских миксах. Закажите букет из роз «Пиони бабблс» с доставкой и фото перед отправкой, чтобы заранее согласовать итоговый вид.",
    sizes: [
      { value: "S", label: "S", price: 3850 },
      { value: "M", label: "M", price: 4450 },
      { value: "L", label: "L", price: 5350 }
    ]
  },
  {
    id: "rose-028",
    title: "Питер Парк",
    price: 4700,
    image: "/products/roses/rose-028/1.webp",
    images: [
      "/products/roses/rose-028/1.webp",
      "/products/roses/rose-028/2.webp",
      "/products/roses/rose-028/3.webp",
    ],
    category: "roses",
    description: "Розы «Питер Парк» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Питер Парк» онлайн с быстрой доставкой по Москве и области.",
    sizes: [
      { value: "S", label: "S", price: 4100 },
      { value: "M", label: "M", price: 4700 },
      { value: "L", label: "L", price: 5600 }
    ]
  },
  {
    id: "rose-029",
    title: "Пич Аваланж",
    price: 3200,
    image: "/products/roses/rose-029/1.webp",
    images: [
      "/products/roses/rose-029/1.webp",
      "/products/roses/rose-029/2.webp",
      "/products/roses/rose-029/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Пич Аваланж» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 2600 },
      { value: "M", label: "M", price: 3200 },
      { value: "L", label: "L", price: 4100 }
    ]
  },
  {
    id: "rose-030",
    title: "Пич дименшн",
    price: 3450,
    image: "/products/roses/rose-030/1.webp",
    images: [
      "/products/roses/rose-030/1.webp",
      "/products/roses/rose-030/2.webp",
      "/products/roses/rose-030/3.webp",
    ],
    category: "roses",
    description: "Роза «Пич дименшн» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Пич дименшн», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    sizes: [
      { value: "S", label: "S", price: 2850 },
      { value: "M", label: "M", price: 3450 },
      { value: "L", label: "L", price: 4350 }
    ]
  },
  {
    id: "rose-031",
    title: "Ред Наоми",
    price: 3700,
    image: "/products/roses/rose-031/1.webp",
    images: [
      "/products/roses/rose-031/1.webp",
      "/products/roses/rose-031/2.webp",
      "/products/roses/rose-031/3.webp",
    ],
    category: "roses",
    description: "Роза «Ред Наоми» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Ред Наоми» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    sizes: [
      { value: "S", label: "S", price: 3100 },
      { value: "M", label: "M", price: 3700 },
      { value: "L", label: "L", price: 4600 }
    ]
  },
  {
    id: "rose-032",
    title: "Ридженс Парк",
    price: 3950,
    image: "/products/roses/rose-032/1.webp",
    images: [
      "/products/roses/rose-032/1.webp",
      "/products/roses/rose-032/2.webp",
      "/products/roses/rose-032/3.webp",
    ],
    category: "roses",
    description: "Сорт «Ридженс Парк» выбирают за насыщенный оттенок и премиальный вид в монобукете. Эти розы хорошо смотрятся как самостоятельная композиция и в авторских миксах. Закажите букет из роз «Ридженс Парк» с доставкой и фото перед отправкой, чтобы заранее согласовать итоговый вид.",
    sizes: [
      { value: "S", label: "S", price: 3350 },
      { value: "M", label: "M", price: 3950 },
      { value: "L", label: "L", price: 4850 }
    ]
  },
  {
    id: "rose-033",
    title: "Свит Ревайвл",
    price: 4200,
    image: "/products/roses/rose-033/1.webp",
    images: [
      "/products/roses/rose-033/1.webp",
      "/products/roses/rose-033/2.webp",
      "/products/roses/rose-033/3.webp",
    ],
    category: "roses",
    description: "Розы «Свит Ревайвл» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Свит Ревайвл» онлайн с быстрой доставкой по Москве и области.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 3600 },
      { value: "M", label: "M", price: 4200 },
      { value: "L", label: "L", price: 5100 }
    ]
  },
  {
    id: "rose-034",
    title: "Скайвард",
    price: 4450,
    image: "/products/roses/rose-034/1.webp",
    images: [
      "/products/roses/rose-034/1.webp",
      "/products/roses/rose-034/2.webp",
      "/products/roses/rose-034/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Скайвард» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    sizes: [
      { value: "S", label: "S", price: 3850 },
      { value: "M", label: "M", price: 4450 },
      { value: "L", label: "L", price: 5350 }
    ]
  },
  {
    id: "rose-035",
    title: "Скарлет дименшн",
    price: 4700,
    image: "/products/roses/rose-035/1.webp",
    images: [
      "/products/roses/rose-035/1.webp",
      "/products/roses/rose-035/2.webp",
      "/products/roses/rose-035/3.webp",
    ],
    category: "roses",
    description: "Роза «Скарлет дименшн» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Скарлет дименшн», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    sizes: [
      { value: "S", label: "S", price: 4100 },
      { value: "M", label: "M", price: 4700 },
      { value: "L", label: "L", price: 5600 }
    ]
  },
  {
    id: "rose-036",
    title: "Софи Лорен",
    price: 3200,
    image: "/products/roses/rose-036/1.webp",
    images: [
      "/products/roses/rose-036/1.webp",
      "/products/roses/rose-036/2.webp",
      "/products/roses/rose-036/3.webp",
    ],
    category: "roses",
    description: "Роза «Софи Лорен» — выразительный сорт для букета с чистой формой бутона и аккуратным раскрытием. Подходит для подарка на день рождения, свидание и деловой повод. Купить розы «Софи Лорен» с доставкой по Москве можно на удобное время; флорист собирает композицию из свежей партии в день заказа.",
    sizes: [
      { value: "S", label: "S", price: 2600 },
      { value: "M", label: "M", price: 3200 },
      { value: "L", label: "L", price: 4100 }
    ]
  },
  {
    id: "rose-037",
    title: "Спешл дименшн",
    price: 3450,
    image: "/products/roses/rose-037/1.webp",
    images: [
      "/products/roses/rose-037/1.webp",
      "/products/roses/rose-037/2.webp",
      "/products/roses/rose-037/3.webp",
    ],
    category: "roses",
    description: "Сорт «Спешл дименшн» выбирают за насыщенный оттенок и премиальный вид в монобукете. Эти розы хорошо смотрятся как самостоятельная композиция и в авторских миксах. Закажите букет из роз «Спешл дименшн» с доставкой и фото перед отправкой, чтобы заранее согласовать итоговый вид.",
    isPopular: true,
    sizes: [
      { value: "S", label: "S", price: 2850 },
      { value: "M", label: "M", price: 3450 },
      { value: "L", label: "L", price: 4350 }
    ]
  },
  {
    id: "rose-038",
    title: "Шангрила",
    price: 3700,
    image: "/products/roses/rose-038/1.webp",
    images: [
      "/products/roses/rose-038/1.webp",
      "/products/roses/rose-038/2.webp",
      "/products/roses/rose-038/3.webp",
    ],
    category: "roses",
    description: "Розы «Шангрила» подходят для композиций в современном европейском стиле: плотная сборка, чистая геометрия, лаконичная упаковка. Если нужен эффектный букет без лишнего декора, этот сорт закрывает задачу. Оформите заказ на «Шангрила» онлайн с быстрой доставкой по Москве и области.",
    sizes: [
      { value: "S", label: "S", price: 3100 },
      { value: "M", label: "M", price: 3700 },
      { value: "L", label: "L", price: 4600 }
    ]
  },
  {
    id: "rose-039",
    title: "Эва Ред",
    price: 3950,
    image: "/products/roses/rose-039/1.webp",
    images: [
      "/products/roses/rose-039/1.webp",
      "/products/roses/rose-039/2.webp",
      "/products/roses/rose-039/3.webp",
    ],
    category: "roses",
    description: "Букет из роз «Эва Ред» — универсальное решение для поздравления, благодарности и романтического жеста. Сорт ценят за свежесть, стойкость и ровный тон лепестков. Мы бережно собираем композицию и доставляем в выбранный интервал, чтобы букет выглядел презентабельно с первых минут.",
    sizes: [
      { value: "S", label: "S", price: 3350 },
      { value: "M", label: "M", price: 3950 },
      { value: "L", label: "L", price: 4850 }
    ]
  },
  {
    id: "rose-040",
    title: "Эль Торо",
    price: 4200,
    image: "/products/roses/rose-040/1.webp",
    images: [
      "/products/roses/rose-040/1.webp",
      "/products/roses/rose-040/2.webp",
      "/products/roses/rose-040/3.webp",
    ],
    category: "roses",
    description: "Роза «Эль Торо» хорошо раскрывается в средних и больших монобукетах, создавая объем и аккуратную текстуру. Этот сорт часто выбирают для стильных подарков и камерных событий. Заказывая «Эль Торо», вы получаете свежую срезку, работу флориста и оперативную доставку по городу.",
    sizes: [
      { value: "S", label: "S", price: 3600 },
      { value: "M", label: "M", price: 4200 },
      { value: "L", label: "L", price: 5100 }
    ]
  }
].map(applyFixedProductPricing);

export const categories = [
  { id: "all", title: "Все букеты" },
  { id: "roses", title: "Розы" }
];

export function getProductById(id: string | undefined): Product | undefined {
  if (!id) return undefined;
  return products.find((product) => product.id === id);
}

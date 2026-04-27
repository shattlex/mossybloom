export const STORAGE_KEY = "sara_flowers_cms_v1";

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const requiredPages = [
  { slug: "home", title: "Главная", type: "landing", inNav: true },
  { slug: "about", title: "О нас", type: "custom", inNav: true },
  { slug: "catalog", title: "Каталог", type: "catalog", inNav: true },
  { slug: "bouquet-builder", title: "Конструктор", type: "custom", inNav: true },
  { slug: "delivery", title: "Доставка", type: "custom", inNav: true },
  { slug: "contacts", title: "Контакты", type: "custom", inNav: true }
];

function item(name, price, image, subtitle = "", description = "", meta = "") {
  return { id: uid(), name, price, image, subtitle, description, meta };
}

function defaultHomeBlocks() {
  return [
    {
      id: uid(),
      type: "hero",
      title: "MossyBloom",
      subtitle: "Создаем букеты с любовью для вас",
      buttonText: "Выбрать букет",
      buttonLink: "/catalog",
      image: "https://images.unsplash.com/photo-1773169206110-103f891dda08?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
    },
    {
      id: uid(),
      type: "products",
      title: "Популярные букеты",
      items: [
        item("Букет \"Нежность пионов\"", "7500 ₽", "https://images.unsplash.com/photo-1773169206110-103f891dda08?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Классические розы\"", "4900 ₽", "https://images.unsplash.com/photo-1758827644723-f0acdb36bd85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Солнечный\"", "4200 ₽", "https://images.unsplash.com/photo-1752765579971-b9949096c5d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080")
      ]
    }
  ];
}

function defaultCatalogBlocks() {
  return [
    { id: uid(), type: "sectionTitle", text: "Каталог букетов" },
    {
      id: uid(),
      type: "products",
      title: "Все товары",
      items: [
        item("Букет \"Нежность пионов\"", "7500 ₽", "https://images.unsplash.com/photo-1773169206110-103f891dda08?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Классические розы\"", "4900 ₽", "https://images.unsplash.com/photo-1758827644723-f0acdb36bd85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Белоснежный\"", "6200 ₽", "https://images.unsplash.com/photo-1766734867043-92b9b2f25ffa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Весенние тюльпаны\"", "3900 ₽", "https://images.unsplash.com/photo-1580403071102-c23c5267d060?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Орхидеи премиум\"", "8900 ₽", "https://images.unsplash.com/photo-1768368052646-a6185df478c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Солнечный\"", "4200 ₽", "https://images.unsplash.com/photo-1752765579971-b9949096c5d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Голубая гортензия\"", "5800 ₽", "https://images.unsplash.com/photo-1629379555555-79c361b3736b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"),
        item("Букет \"Микс радости\"", "5500 ₽", "https://images.unsplash.com/photo-1708604378427-a06673e5cc0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080")
      ]
    }
  ];
}

function defaultAboutBlocks() {
  return [
    { id: uid(), type: "sectionTitle", text: "О нас" },
    {
      id: uid(),
      type: "text",
      title: "MossyBloom",
      body: "Мы создаем авторские букеты и композиции из свежих цветов. Каждая работа собирается вручную с вниманием к деталям."
    },
    {
      id: uid(),
      type: "text",
      title: "Наш подход",
      body: "• свежие поставки каждый день\n• фото букета перед отправкой\n• бережная доставка по Москве и области"
    }
  ];
}

function defaultBouquetBuilderBlocks() {
  return [
    { id: uid(), type: "sectionTitle", text: "Конструктор букетов" },
    { id: uid(), type: "text", title: "subtitle", body: "Создайте уникальный букет из любимых цветов" },
    {
      id: uid(),
      type: "products",
      title: "flowers",
      items: [
        item("Роза красная", "350 ₽", "https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=700", "", "", "red"),
        item("Роза белая", "320 ₽", "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=700", "", "", "white"),
        item("Роза розовая", "330 ₽", "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=700", "", "", "pink"),
        item("Пион розовый", "450 ₽", "https://images.unsplash.com/photo-1773169206110-103f891dda08?w=700", "", "", "pink"),
        item("Тюльпан красный", "180 ₽", "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=700", "", "", "red"),
        item("Тюльпан желтый", "180 ₽", "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=700", "", "", "yellow"),
        item("Орхидея", "800 ₽", "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=700", "", "", "white"),
        item("Подсолнух", "280 ₽", "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=700", "", "", "yellow"),
        item("Гортензия голубая", "520 ₽", "https://images.unsplash.com/photo-1596438459194-f275f413d6ff?w=700", "", "", "blue")
      ]
    }
  ];
}

function defaultDeliveryBlocks() {
  return [
    { id: uid(), type: "sectionTitle", text: "Доставка цветов" },
    { id: uid(), type: "text", title: "subtitle", body: "Доставляем свежие букеты по Москве и области с заботой о каждом цветке" },
    {
      id: uid(),
      type: "products",
      title: "delivery-options",
      items: [
        item("Экспресс-доставка", "Бесплатно от 5000 ₽", "", "60 минут", "Доставим ваш букет в течение часа по Москве", "clock"),
        item("Стандартная доставка", "500 ₽", "", "3 часа", "Доставка в удобное для вас время", "package"),
        item("Самовывоз", "Бесплатно", "", "Сегодня", "Заберите букет из нашей студии", "map-pin")
      ]
    },
    { id: uid(), type: "sectionTitle", text: "Наши преимущества" },
    {
      id: uid(),
      type: "products",
      title: "advantages",
      items: [
        item("Фото перед отправкой", "", "", "", "Отправим вам фото букета перед доставкой", "camera"),
        item("Гарантия качества", "", "", "", "Вернем деньги, если что-то пойдет не так", "shield"),
        item("Индивидуальный подход", "", "", "", "Учтем все ваши пожелания и комментарии", "heart" )
      ]
    },
    { id: uid(), type: "sectionTitle", text: "Зоны доставки" },
    {
      id: uid(),
      type: "products",
      title: "delivery-zones",
      items: [
        item("В пределах МКАД", "Бесплатно от 5000 ₽", ""),
        item("За МКАД (до 10 км)", "500 ₽", ""),
        item("За МКАД (10-30 км)", "1000 ₽", ""),
        item("Московская область", "По договоренности", "")
      ]
    }
  ];
}

function defaultContactsBlocks() {
  return [
    { id: uid(), type: "sectionTitle", text: "Контакты" },
    { id: uid(), type: "text", title: "subtitle", body: "Свяжитесь с нами любым удобным способом. Мы всегда рады помочь!" },
    {
      id: uid(),
      type: "products",
      title: "contact-items",
      items: [
        item("Телефон", "+7 (495) 123-45-67", "", "", "tel:+74951234567", "phone"),
        item("Email", "sales@mossybloom.ru", "", "", "mailto:sales@mossybloom.ru", "mail"),
        item("Instagram", "@sara_flowers", "", "", "https://instagram.com", "instagram"),
        item("Адрес", "Москва, ул. Цветочная, д. 15", "", "", "", "map-pin")
      ]
    },
    { id: uid(), type: "text", title: "Режим работы", body: "Ежедневно с 9:00 до 21:00" },
    { id: uid(), type: "text", title: "Форма", body: "Отправить сообщение" }
  ];
}

function createRequiredPage(slug) {
  const base = requiredPages.find((page) => page.slug === slug);
  if (!base) return null;

  if (slug === "home") return { id: "home", slug: "home", title: "Главная", type: "landing", inNav: true, blocks: defaultHomeBlocks() };
  if (slug === "about") return { id: "about", slug: "about", title: "О нас", type: "custom", inNav: true, blocks: defaultAboutBlocks() };
  if (slug === "catalog") return { id: "catalog", slug: "catalog", title: "Каталог", type: "catalog", inNav: true, blocks: defaultCatalogBlocks() };
  if (slug === "bouquet-builder") return { id: "bouquet-builder", slug: "bouquet-builder", title: "Конструктор", type: "custom", inNav: true, blocks: defaultBouquetBuilderBlocks() };
  if (slug === "delivery") return { id: "delivery", slug: "delivery", title: "Доставка", type: "custom", inNav: true, blocks: defaultDeliveryBlocks() };
  if (slug === "contacts") return { id: "contacts", slug: "contacts", title: "Контакты", type: "custom", inNav: true, blocks: defaultContactsBlocks() };

  return {
    id: slug,
    slug: base.slug,
    title: base.title,
    type: base.type,
    inNav: base.inNav,
    blocks: [{ id: uid(), type: "text", title: base.title, body: "Заполните контент этой страницы через админку." }]
  };
}

export const defaultContent = {
  siteName: "SARA FLOWERS",
  pages: requiredPages.map((page) => createRequiredPage(page.slug)),
  media: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isLegacySeed(safe) {
  const home = Array.isArray(safe.pages) ? safe.pages.find((page) => page.slug === "home") : null;
  const hero = Array.isArray(home?.blocks) ? home.blocks.find((block) => block.type === "hero") : null;
  return Array.isArray(safe.pages) && safe.pages.length <= 2 && typeof hero?.title === "string" && hero.title.trim().toLowerCase() === "сара цветы";
}

function isPlaceholderPage(page) {
  if (!page || !Array.isArray(page.blocks) || page.blocks.length !== 1) return false;
  const block = page.blocks[0];
  if (!block || block.type !== "text") return false;
  const body = typeof block.body === "string" ? block.body : "";
  return body.includes("Заполните контент этой страницы через админку");
}

function needsRichUpgrade(page, slug) {
  if (!page || !Array.isArray(page.blocks)) return true;
  if (slug === "bouquet-builder") return !page.blocks.some((b) => b.type === "products");
  if (slug === "delivery") return page.blocks.filter((b) => b.type === "products").length < 3;
  if (slug === "contacts") return !page.blocks.some((b) => b.type === "products");
  return false;
}

function normalize(data) {
  const safe = data && typeof data === "object" ? data : {};
  safe.pages = Array.isArray(safe.pages) && safe.pages.length ? safe.pages : clone(defaultContent.pages);
  safe.media = Array.isArray(safe.media) ? safe.media : [];
  safe.siteName = typeof safe.siteName === "string" && safe.siteName.trim() ? safe.siteName : defaultContent.siteName;

  if (isLegacySeed(safe)) {
    safe.pages = clone(defaultContent.pages);
  }

  for (const page of safe.pages) {
    if (!Array.isArray(page.blocks)) page.blocks = [];
    if (typeof page.id !== "string") page.id = uid();
    if (typeof page.slug !== "string" || !page.slug.trim()) page.slug = `page-${uid().slice(-5)}`;
    if (typeof page.title !== "string" || !page.title.trim()) page.title = "Новая страница";
    if (typeof page.type !== "string" || !page.type.trim()) page.type = "custom";
    if (typeof page.inNav !== "boolean") page.inNav = true;
  }

  for (const required of requiredPages) {
    const existing = safe.pages.find((page) => page.slug === required.slug);
    if (!existing) {
      const newPage = createRequiredPage(required.slug);
      if (newPage) safe.pages.push(newPage);
      continue;
    }

    if (isPlaceholderPage(existing) || needsRichUpgrade(existing, required.slug)) {
      const replacement = createRequiredPage(required.slug);
      if (replacement) {
        existing.blocks = replacement.blocks;
        existing.title = replacement.title;
      }
    }
  }

  return safe;
}

export function loadContent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = clone(defaultContent);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const normalized = normalize(JSON.parse(raw));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    const fallback = clone(defaultContent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

export function saveContent(data) {
  const normalized = normalize(clone(data));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetContent() {
  const value = clone(defaultContent);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function makeId(prefix = "id") {
  return `${prefix}_${uid()}`;
}


import { loadContent } from "./content-store.js";

const app = document.getElementById("app");
const nav = document.getElementById("site-nav");
const footerYear = document.getElementById("footer-year");

function resolveImage(content, value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("media:")) return value;
  const id = value.slice("media:".length);
  const media = content.media?.find((m) => m.id === id);
  return media?.url || "";
}

function getActivePage(content) {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("page") || "home";
  return content.pages.find((p) => p.slug === slug) || content.pages[0];
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (typeof text === "string") el.textContent = text;
  return el;
}

function renderNav(content, activePage) {
  clear(nav);

  for (const page of content.pages.filter((p) => p.inNav)) {
    const a = h("a", "main-nav-link", page.title);
    a.href = `?page=${encodeURIComponent(page.slug)}`;
    if (page.slug === activePage.slug) a.classList.add("is-active");
    nav.appendChild(a);
  }
}

function renderHero(content, block) {
  const section = h("section", "hero-block container");

  const image = h("img", "hero-image");
  image.src = resolveImage(content, block.image || "");
  image.alt = block.title || "Hero";

  const overlay = h("div", "hero-overlay");
  overlay.append(h("h1", "hero-title", block.title || ""));
  overlay.append(h("p", "hero-subtitle", (block.subtitle || "").toUpperCase()));

  if (block.buttonText) {
    const btn = h("a", "outline-btn", block.buttonText.toUpperCase());
    btn.href = block.buttonLink || "#";
    overlay.append(btn);
  }

  section.append(image, overlay);
  return section;
}

function renderProducts(content, block) {
  const section = h("section", "products-block container");
  if (block.title) section.append(h("h2", "section-title", block.title.toUpperCase()));

  const grid = h("div", "products-grid");
  for (const item of block.items || []) {
    const card = h("article", "product-card");
    const image = h("img", "product-image");
    image.src = resolveImage(content, item.image || "");
    image.alt = item.name || "Товар";
    card.append(image, h("h3", "product-name", item.name || ""), h("p", "product-price", item.price || ""));
    grid.append(card);
  }

  section.append(grid);
  return section;
}

function renderSectionTitle(block) {
  const section = h("section", "section-title-only container");
  section.append(h("h2", "section-title", (block.text || "").toUpperCase()));
  return section;
}

function renderTextImage(content, block) {
  const section = h("section", "about-block container");
  if (block.imageSide === "left") section.classList.add("image-left");

  const sectionContent = h("div", "about-content");
  sectionContent.append(h("h2", "section-title", (block.title || "").toUpperCase()));
  sectionContent.append(h("p", "about-text", block.text || ""));

  if (block.buttonText) {
    const btn = h("a", "outline-btn", block.buttonText.toUpperCase());
    btn.href = block.buttonLink || "#";
    sectionContent.append(btn);
  }

  const image = h("img", "about-image");
  image.src = resolveImage(content, block.image || "");
  image.alt = block.title || "Блок";

  section.append(sectionContent, image);
  return section;
}

function renderText(block) {
  const section = h("section", "text-block container");
  if (block.title) section.append(h("h2", "section-title", (block.title || "").toUpperCase()));
  section.append(h("p", "text-body", block.body || ""));
  return section;
}

function renderImage(content, block) {
  const section = h("section", "image-block container");
  const image = h("img", "full-image");
  image.src = resolveImage(content, block.image || "");
  image.alt = block.alt || "Изображение";
  section.append(image);
  if (block.caption) section.append(h("p", "image-caption", block.caption));
  return section;
}

function renderBlock(content, block) {
  switch (block.type) {
    case "hero":
      return renderHero(content, block);
    case "products":
      return renderProducts(content, block);
    case "sectionTitle":
      return renderSectionTitle(block);
    case "textImage":
      return renderTextImage(content, block);
    case "text":
      return renderText(block);
    case "image":
      return renderImage(content, block);
    default: {
      const fallback = h("section", "text-block container");
      fallback.append(h("p", "text-body", `Неизвестный тип блока: ${block.type}`));
      return fallback;
    }
  }
}

function renderPage(content, page) {
  clear(app);
  for (const block of page.blocks || []) app.append(renderBlock(content, block));
}

function init() {
  const content = loadContent();
  const active = getActivePage(content);
  renderNav(content, active);
  renderPage(content, active);
  footerYear.textContent = String(new Date().getFullYear());
}

init();

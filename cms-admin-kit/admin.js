import { loadContent, saveContent, makeId } from "./content-store.js";

let state = loadContent();
let selectedPageId = state.pages[0]?.id || null;
let initialized = false;

const ADMIN_LOGIN = "AGteam";
const ADMIN_PASSWORD = "moneyenjoyer";
const AUTH_SESSION_KEY = "sara_admin_auth";

const refs = {
  authGate: document.getElementById("admin-auth"),
  adminApp: document.getElementById("admin-app"),
  authForm: document.getElementById("auth-form"),
  authLogin: document.getElementById("auth-login"),
  authPassword: document.getElementById("auth-password"),
  authError: document.getElementById("auth-error"),
  pagesPanel: document.getElementById("pages-panel"),
  mediaPanel: document.getElementById("media-panel"),
  tabPages: document.getElementById("tab-pages"),
  tabMedia: document.getElementById("tab-media"),
  pagesList: document.getElementById("pages-list"),
  pageEditor: document.getElementById("page-editor"),
  addPageBtn: document.getElementById("add-page-btn"),
  resetBtn: document.getElementById("reset-btn"),
  syncStatus: document.getElementById("sync-status"),
  mediaForm: document.getElementById("media-form"),
  mediaName: document.getElementById("media-name"),
  mediaUrl: document.getElementById("media-url"),
  mediaFile: document.getElementById("media-file"),
  mediaList: document.getElementById("media-list")
};

const blockTypes = ["hero", "products", "sectionTitle", "textImage", "text", "image"];

function setStatus(text, isError = false) {
  refs.syncStatus.textContent = text;
  refs.syncStatus.style.color = isError ? "#ffb4b4" : "#d0c7cc";
}

function persist() {
  try {
    state = saveContent(state);
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить данные CMS.";
    setStatus(
      `Ошибка сохранения: ${message}. Проверьте размер изображений (base64 может переполнить localStorage).`,
      true
    );
    return false;
  }
}

function byId(items, id) {
  return items.find((item) => item.id === id);
}

function sanitizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё-\s]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function resolveMedia(value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("media:")) return value;
  const mediaId = value.slice("media:".length);
  return state.media.find((m) => m.id === mediaId)?.url || "";
}

function imageField({ label, value, onChange }) {
  const wrap = document.createElement("div");
  wrap.className = "image-field";

  const title = document.createElement("p");
  title.className = "small";
  title.textContent = label;

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "URL изображения или media:<id>";
  urlInput.value = value || "";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  const row = document.createElement("div");
  row.className = "toolbar";

  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.className = "btn";
  uploadBtn.textContent = "Загрузить";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn";
  clearBtn.textContent = "Очистить";

  const preview = document.createElement("img");
  preview.className = "media-preview media-preview-inline";
  preview.alt = "Превью";
  preview.src = resolveMedia(urlInput.value);

  const hint = document.createElement("span");
  hint.className = "small";
  hint.textContent = "Поддерживаются URL, media:<id> и локальная загрузка файла.";

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });

  urlInput.addEventListener("input", () => {
    preview.src = resolveMedia(urlInput.value);
  });
  urlInput.addEventListener("change", () => onChange(urlInput.value));
  urlInput.addEventListener("blur", () => onChange(urlInput.value));

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      alert("Сначала выберите файл.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const existing = state.media.find((m) => m.url === dataUrl);
      const mediaId = existing?.id || makeId("media");
      if (!existing) {
        state.media.push({
          id: mediaId,
          name: file.name || "Uploaded image",
          url: dataUrl
        });
      }

      const mediaRef = `media:${mediaId}`;
      urlInput.value = mediaRef;
      preview.src = resolveMedia(mediaRef);
      onChange(mediaRef);
      persist();
      renderMediaList();
      setStatus("Изображение загружено в медиатеку и привязано к полю.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Ошибка загрузки";
      setStatus(`Ошибка: ${msg}`, true);
      alert(msg);
    }
  });

  clearBtn.addEventListener("click", () => {
    urlInput.value = "";
    fileInput.value = "";
    preview.src = "";
    onChange("");
  });

  row.append(uploadBtn, clearBtn);
  wrap.append(title, urlInput, fileInput, row, preview, hint);
  return wrap;
}

function inputField({ label, value, onChange, type = "text" }) {
  const wrap = document.createElement("label");
  wrap.textContent = label;

  const input = document.createElement("input");
  input.type = type;
  input.value = value || "";
  input.addEventListener("change", () => onChange(input.value));
  input.addEventListener("blur", () => onChange(input.value));

  wrap.append(input);
  return wrap;
}

function textareaField({ label, value, onChange }) {
  const wrap = document.createElement("label");
  wrap.textContent = label;

  const textarea = document.createElement("textarea");
  textarea.value = value || "";
  textarea.addEventListener("change", () => onChange(textarea.value));
  textarea.addEventListener("blur", () => onChange(textarea.value));

  wrap.append(textarea);
  return wrap;
}

function selectField({ label, value, options, onChange }) {
  const wrap = document.createElement("label");
  wrap.textContent = label;

  const select = document.createElement("select");
  for (const optionData of options) {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    if (optionData.value === value) option.selected = true;
    select.append(option);
  }
  select.addEventListener("change", () => onChange(select.value));

  wrap.append(select);
  return wrap;
}

function createDefaultBlock(type) {
  if (type === "hero") {
    return {
      id: makeId("block"),
      type,
      title: "Новый hero",
      subtitle: "Подзаголовок",
      buttonText: "Кнопка",
      buttonLink: "#",
      image: ""
    };
  }

  if (type === "products") {
    return {
      id: makeId("block"),
      type,
      title: "Новая коллекция",
      items: [{ id: makeId("item"), name: "Товар", price: "0 ₽", image: "", subtitle: "", description: "", meta: "" }]
    };
  }

  if (type === "sectionTitle") return { id: makeId("block"), type, text: "Новый заголовок" };

  if (type === "textImage") {
    return {
      id: makeId("block"),
      type,
      title: "Новый блок",
      text: "Текст блока",
      buttonText: "Подробнее",
      buttonLink: "#",
      image: "",
      imageSide: "right"
    };
  }

  if (type === "text") return { id: makeId("block"), type, title: "Текстовый блок", body: "Текст" };

  return { id: makeId("block"), type, image: "", alt: "", caption: "" };
}

function renderProductsEditor(block, page, editor) {
  editor.append(
    inputField({
      label: "Заголовок блока",
      value: block.title,
      onChange: (v) => {
        block.title = v;
        persist();
      }
    })
  );

  const list = document.createElement("ul");
  list.className = "product-items";

  for (const item of block.items || []) {
    const row = document.createElement("li");
    row.className = "product-item";

    const rowHead = document.createElement("div");
    rowHead.className = "product-row-header";

    const title = document.createElement("strong");
    title.textContent = item.name || "Товар";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-danger";
    del.textContent = "Удалить";
    del.addEventListener("click", () => {
      block.items = (block.items || []).filter((i) => i.id !== item.id);
      persist();
      renderPageEditor();
    });

    rowHead.append(title, del);

    const grid = document.createElement("div");
    grid.className = "product-editor";
    grid.append(
      inputField({
        label: "Название",
        value: item.name,
        onChange: (v) => {
          item.name = v;
          title.textContent = v || "Товар";
          persist();
        }
      }),
      inputField({
        label: "Цена",
        value: item.price,
        onChange: (v) => {
          item.price = v;
          persist();
        }
      }),
      inputField({
        label: "Подзаголовок / доп. поле",
        value: item.subtitle,
        onChange: (v) => {
          item.subtitle = v;
          persist();
        }
      }),
      textareaField({
        label: "Описание",
        value: item.description,
        onChange: (v) => {
          item.description = v;
          persist();
        }
      }),
      inputField({
        label: "Meta (цвет / иконка / ключ)",
        value: item.meta,
        onChange: (v) => {
          item.meta = v;
          persist();
        }
      }),
      imageField({
        label: "Изображение",
        value: item.image,
        onChange: (v) => {
          item.image = v;
          persist();
        }
      })
    );

    row.append(rowHead, grid);
    list.append(row);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn";
  addBtn.textContent = "+ Добавить товар";
  addBtn.addEventListener("click", () => {
    if (!Array.isArray(block.items)) block.items = [];
    block.items.push({ id: makeId("item"), name: "Товар", price: "0 ₽", image: "", subtitle: "", description: "", meta: "" });
    persist();
    renderPageEditor();
  });

  editor.append(list, addBtn);
}

function renderBlockEditor(page, block) {
  const item = document.createElement("li");
  item.className = "block-item";

  const head = document.createElement("div");
  head.className = "block-header";

  const name = document.createElement("strong");
  name.textContent = block.type;

  const tools = document.createElement("div");
  tools.className = "toolbar";

  const up = document.createElement("button");
  up.className = "btn";
  up.type = "button";
  up.textContent = "↑";
  up.addEventListener("click", () => {
    const index = page.blocks.findIndex((b) => b.id === block.id);
    if (index > 0) {
      [page.blocks[index - 1], page.blocks[index]] = [page.blocks[index], page.blocks[index - 1]];
      persist();
      renderPageEditor();
    }
  });

  const down = document.createElement("button");
  down.className = "btn";
  down.type = "button";
  down.textContent = "↓";
  down.addEventListener("click", () => {
    const index = page.blocks.findIndex((b) => b.id === block.id);
    if (index < page.blocks.length - 1) {
      [page.blocks[index + 1], page.blocks[index]] = [page.blocks[index], page.blocks[index + 1]];
      persist();
      renderPageEditor();
    }
  });

  const del = document.createElement("button");
  del.className = "btn btn-danger";
  del.type = "button";
  del.textContent = "Удалить";
  del.addEventListener("click", () => {
    page.blocks = page.blocks.filter((b) => b.id !== block.id);
    persist();
    renderPageEditor();
  });

  tools.append(up, down, del);
  head.append(name, tools);

  const editor = document.createElement("div");
  editor.className = "block-editor";

  if (block.type === "hero") {
    editor.append(
      inputField({ label: "Заголовок", value: block.title, onChange: (v) => ((block.title = v), persist()) }),
      inputField({ label: "Подзаголовок", value: block.subtitle, onChange: (v) => ((block.subtitle = v), persist()) }),
      inputField({ label: "Текст кнопки", value: block.buttonText, onChange: (v) => ((block.buttonText = v), persist()) }),
      inputField({ label: "Ссылка кнопки", value: block.buttonLink, onChange: (v) => ((block.buttonLink = v), persist()) }),
      imageField({ label: "Изображение", value: block.image, onChange: (v) => ((block.image = v), persist()) })
    );
  } else if (block.type === "products") {
    renderProductsEditor(block, page, editor);
  } else if (block.type === "sectionTitle") {
    editor.append(inputField({ label: "Текст", value: block.text, onChange: (v) => ((block.text = v), persist()) }));
  } else if (block.type === "textImage") {
    editor.append(
      inputField({ label: "Заголовок", value: block.title, onChange: (v) => ((block.title = v), persist()) }),
      textareaField({ label: "Текст", value: block.text, onChange: (v) => ((block.text = v), persist()) }),
      inputField({ label: "Текст кнопки", value: block.buttonText, onChange: (v) => ((block.buttonText = v), persist()) }),
      inputField({ label: "Ссылка кнопки", value: block.buttonLink, onChange: (v) => ((block.buttonLink = v), persist()) }),
      imageField({ label: "Изображение", value: block.image, onChange: (v) => ((block.image = v), persist()) }),
      selectField({
        label: "Позиция картинки",
        value: block.imageSide || "right",
        options: [
          { value: "right", label: "Справа" },
          { value: "left", label: "Слева" }
        ],
        onChange: (v) => {
          block.imageSide = v;
          persist();
        }
      })
    );
  } else if (block.type === "text") {
    editor.append(
      inputField({ label: "Заголовок", value: block.title, onChange: (v) => ((block.title = v), persist()) }),
      textareaField({ label: "Текст", value: block.body, onChange: (v) => ((block.body = v), persist()) })
    );
  } else if (block.type === "image") {
    editor.append(
      imageField({ label: "Изображение", value: block.image, onChange: (v) => ((block.image = v), persist()) }),
      inputField({ label: "ALT", value: block.alt, onChange: (v) => ((block.alt = v), persist()) }),
      inputField({ label: "Подпись", value: block.caption, onChange: (v) => ((block.caption = v), persist()) })
    );
  }

  item.append(head, editor);
  return item;
}

function pageHref(page) {
  return page.slug === "home" ? "/" : `/${page.slug}`;
}

function renderPageEditor() {
  const page = byId(state.pages, selectedPageId);
  if (!page) {
    refs.pageEditor.className = "card empty-state";
    refs.pageEditor.textContent = "Выберите страницу слева или создайте новую.";
    return;
  }

  refs.pageEditor.className = "card";
  refs.pageEditor.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = `Редактирование: ${page.title}`;

  const form = document.createElement("div");
  form.className = "editor-grid";
  form.append(
    inputField({
      label: "Название страницы",
      value: page.title,
      onChange: (v) => {
        page.title = v;
        persist();
        renderPagesList();
        title.textContent = `Редактирование: ${page.title}`;
      }
    }),
    inputField({
      label: "Slug",
      value: page.slug,
      onChange: (v) => {
        page.slug = sanitizeSlug(v);
        persist();
        renderPagesList();
      }
    }),
    selectField({
      label: "Тип страницы",
      value: page.type || "custom",
      options: [
        { value: "landing", label: "Landing" },
        { value: "catalog", label: "Каталог" },
        { value: "custom", label: "Custom" }
      ],
      onChange: (v) => {
        page.type = v;
        persist();
      }
    })
  );

  const navLabel = document.createElement("label");
  navLabel.textContent = "Показывать в навигации";
  const navCheckbox = document.createElement("input");
  navCheckbox.type = "checkbox";
  navCheckbox.checked = !!page.inNav;
  navCheckbox.addEventListener("change", () => {
    page.inNav = navCheckbox.checked;
    persist();
  });
  navLabel.append(navCheckbox);
  form.append(navLabel);

  const pageTools = document.createElement("div");
  pageTools.className = "toolbar";

  const openBtn = document.createElement("a");
  openBtn.className = "btn";
  openBtn.href = pageHref(page);
  openBtn.target = "_blank";
  openBtn.rel = "noreferrer";
  openBtn.textContent = "Открыть страницу";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Сохранить";
  saveBtn.addEventListener("click", () => {
    persist();
    setStatus(`Страница «${page.title}» сохранена.`);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "Удалить страницу";
  deleteBtn.disabled = ["home", "catalog", "bouquet-builder", "delivery", "contacts"].includes(page.slug);
  if (!deleteBtn.disabled) {
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm("Удалить эту страницу?")) return;
      state.pages = state.pages.filter((p) => p.id !== page.id);
      selectedPageId = state.pages[0]?.id || null;
      persist();
      renderPagesList();
      renderPageEditor();
      setStatus("Страница удалена.");
    });
  }

  pageTools.append(openBtn, saveBtn, deleteBtn);

  const separator = document.createElement("hr");
  separator.className = "section-separator";

  const blocksTitle = document.createElement("h2");
  blocksTitle.textContent = "Блоки страницы";

  const blockActions = document.createElement("div");
  blockActions.className = "toolbar";

  const blockTypeSelect = document.createElement("select");
  for (const blockType of blockTypes) {
    const option = document.createElement("option");
    option.value = blockType;
    option.textContent = blockType;
    blockTypeSelect.append(option);
  }

  const addBlockBtn = document.createElement("button");
  addBlockBtn.type = "button";
  addBlockBtn.className = "btn btn-primary";
  addBlockBtn.textContent = "+ Добавить блок";
  addBlockBtn.addEventListener("click", () => {
    page.blocks.push(createDefaultBlock(blockTypeSelect.value));
    persist();
    renderPageEditor();
  });

  blockActions.append(blockTypeSelect, addBlockBtn);

  const blockList = document.createElement("ul");
  blockList.className = "blocks-list";
  for (const block of page.blocks || []) blockList.append(renderBlockEditor(page, block));

  refs.pageEditor.append(title, form, pageTools, separator, blocksTitle, blockActions, blockList);
}

function renderPagesList() {
  refs.pagesList.innerHTML = "";

  for (const page of state.pages) {
    const item = document.createElement("li");
    item.className = "page-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-select";
    if (page.id === selectedPageId) button.classList.add("is-selected");
    button.textContent = `[CMS] ${page.title} (${page.slug || "home"})`;
    button.addEventListener("click", () => {
      selectedPageId = page.id;
      renderPagesList();
      renderPageEditor();
    });

    item.append(button);
    refs.pagesList.append(item);
  }
}

function renderMediaList() {
  refs.mediaList.innerHTML = "";

  if (!state.media.length) {
    const empty = document.createElement("li");
    empty.className = "small";
    empty.textContent = "Пока нет изображений.";
    refs.mediaList.append(empty);
    return;
  }

  for (const media of state.media) {
    const item = document.createElement("li");
    item.className = "media-item";

    const row = document.createElement("div");
    row.className = "media-row";

    const left = document.createElement("div");
    left.className = "media-row";

    const image = document.createElement("img");
    image.className = "media-preview";
    image.src = media.url;
    image.alt = media.name || "media";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = media.name || "";
    nameInput.addEventListener("change", () => {
      media.name = nameInput.value;
      persist();
    });

    left.append(image, nameInput);

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.value = media.url;

    const tools = document.createElement("div");
    tools.className = "toolbar";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn";
    saveBtn.textContent = "Сохранить URL";
    saveBtn.addEventListener("click", () => {
      media.url = urlInput.value.trim();
      persist();
      renderMediaList();
      setStatus("URL изображения сохранен.");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Удалить";
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm("Удалить изображение?")) return;
      state.media = state.media.filter((m) => m.id !== media.id);
      persist();
      renderMediaList();
      setStatus("Изображение удалено.");
    });

    tools.append(saveBtn, deleteBtn);
    item.append(row, left, urlInput, tools);
    refs.mediaList.append(item);
  }
}

function switchTab(tab) {
  const pagesActive = tab === "pages";
  refs.pagesPanel.classList.toggle("is-visible", pagesActive);
  refs.mediaPanel.classList.toggle("is-visible", !pagesActive);
  refs.tabPages.classList.toggle("is-active", pagesActive);
  refs.tabMedia.classList.toggle("is-active", !pagesActive);
}

refs.addPageBtn.addEventListener("click", () => {
  const number = state.pages.length + 1;
  const newPage = {
    id: makeId("page"),
    slug: `page-${number}`,
    title: `Новая страница ${number}`,
    type: "custom",
    inNav: true,
    blocks: []
  };

  state.pages.push(newPage);
  selectedPageId = newPage.id;
  persist();
  renderPagesList();
  renderPageEditor();
});

refs.resetBtn.addEventListener("click", () => {
  state = loadContent();
  selectedPageId = state.pages[0]?.id || null;
  renderPagesList();
  renderPageEditor();
  renderMediaList();
  setStatus("Контент обновлен из localStorage.");
});

refs.mediaForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = refs.mediaName.value.trim();
  const url = refs.mediaUrl.value.trim();
  const file = refs.mediaFile.files[0];

  if (!name) {
    alert("Укажите название изображения.");
    return;
  }

  try {
    let finalUrl = url;

    if (file) {
      finalUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });
    }

    if (!finalUrl) {
      alert("Укажите URL или выберите файл.");
      return;
    }

    state.media.push({ id: makeId("media"), name, url: finalUrl });
    persist();
    renderMediaList();
    refs.mediaForm.reset();
    setStatus("Изображение добавлено в медиатеку.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ошибка";
    setStatus(`Ошибка медиатеки: ${msg}`, true);
    alert(msg);
  }
});

refs.tabPages.addEventListener("click", () => switchTab("pages"));
refs.tabMedia.addEventListener("click", () => switchTab("media"));

function init() {
  if (initialized) return;
  initialized = true;
  renderPagesList();
  renderPageEditor();
  renderMediaList();
  setStatus("Локальный режим CMS активен.");
}

refs.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const login = refs.authLogin.value.trim();
  const password = refs.authPassword.value;

  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_SESSION_KEY, "1");
    refs.authError.textContent = "";
    refs.authGate.classList.add("admin-hidden");
    refs.adminApp.classList.remove("admin-hidden");
    init();
    return;
  }

  refs.authError.textContent = "Неверный логин или пароль.";
});

function bootstrap() {
  const authed = sessionStorage.getItem(AUTH_SESSION_KEY) === "1";
  if (authed) {
    refs.authGate.classList.add("admin-hidden");
    refs.adminApp.classList.remove("admin-hidden");
    init();
  } else {
    refs.authGate.classList.remove("admin-hidden");
    refs.adminApp.classList.add("admin-hidden");
  }
}

bootstrap();

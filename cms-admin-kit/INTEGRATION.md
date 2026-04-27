# Integration Guide

## 1) Подключение админки
- Помести `admin.html`, `admin.css`, `admin.js`, `content-store.js` в проект.
- Убедись, что в `admin.html` подключен модуль:

```html
<script type="module" src="./admin.js"></script>
```

## 2) Подключение данных в публичный сайт
В публичном коде:

```js
import { loadContent } from "./content-store.js";
const content = loadContent();
```

Далее рендери `content.pages`/`content.media` своим UI.

## 3) Как резолвить изображения
Если в блоке `image` хранится `media:<id>`, нужно получить URL из `content.media`.

Пример:

```js
function resolveImage(content, value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("media:")) return value;
  const id = value.slice("media:".length);
  return content.media.find((m) => m.id === id)?.url || "";
}
```

## 4) Ключ хранилища
По умолчанию: `sara_flowers_cms_v1` (в `content-store.js`).
Если переносишь в другой сайт, лучше поменять на свой namespace.

## 5) Ограничения текущей версии
- Нет multi-user режима.
- Нет серверной синхронизации.
- Нет авторизации/ролей.
- Большие base64 изображения могут упираться в лимит `localStorage`.

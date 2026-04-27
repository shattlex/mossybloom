# Data Model

Корневой объект:

```json
{
  "siteName": "SARA FLOWERS",
  "pages": [],
  "media": []
}
```

## Page
```json
{
  "id": "page_xxx",
  "slug": "home",
  "title": "Главная",
  "type": "landing",
  "inNav": true,
  "blocks": []
}
```

## Block Types
- `hero`
- `products`
- `sectionTitle`
- `textImage`
- `text`
- `image`

## Media
```json
{
  "id": "media_xxx",
  "name": "Hero",
  "url": "https://... или data:image/..."
}
```

В полях изображений блоков можно хранить:
- прямой URL / dataURL
- или ссылку на медиа: `media:<mediaId>`

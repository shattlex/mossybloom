# Integrations Setup (RU)

## Что реализовано

- Личный кабинет с базой заказов (PostgreSQL)
- Регистрация/вход:
  - пароль (email/телефон + пароль)
  - SMS-код (через sms.ru, либо DEV-режим)
  - Google OAuth
  - Яндекс OAuth
- Оформление заказа с разделением:
  - плательщик
  - получатель (может быть другим человеком)
- Статусы заказа в ЛК:
  - `received` — Заказ получен
  - `assembled` — Собран
  - `out_for_delivery` — Передан на доставку
  - `delivered` — Вручен
- PDF-чек по оплаченному заказу (доступен в ЛК)
- Telegram уведомление после `payment.succeeded`:
  - букет (список)
  - фото букета (если есть URL)
  - адрес доставки
  - контакты плательщика и получателя
- Bitrix24 заявка из формы «Напишите нам»

## 1) PostgreSQL

Обязательно заполните в `.env`:

- `DATABASE_URL=postgres://user:password@host:5432/dbname`
- `JWT_SECRET=...`

При старте API таблицы создаются автоматически.

## 2) Bitrix24 (форма контактов)

1. Создайте входящий webhook с правами CRM.
2. Заполните:
   - `BITRIX24_WEBHOOK_URL=https://<portal>.bitrix24.ru/rest/<user_id>/<webhook_key>`

Форма `Контакты` отправляет POST на `/api/contact`, сервер создает лид через `crm.lead.add.json`.

## 3) YooKassa (оплата для РФ)

Заполните:

- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `PUBLIC_BASE_URL=https://mossybloom.ru`

В YooKassa настройте webhook:

- URL: `https://mossybloom.ru/api/payments/webhook`
- событие: `payment.succeeded`

## 4) Telegram Bot

Заполните:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

После успешной оплаты API отправит сообщение/фото в Telegram.

## 5) SMS авторизация (sms.ru)

Заполните:

- `SMSRU_API_ID`

Если `SMSRU_API_ID` пустой, в DEV-режиме код возвращается в ответе API как `devCode`.

## 6) OAuth (Google и Яндекс)

Заполните:

- Google:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI=https://mossybloom.ru/api/auth/oauth/google/callback`
- Яндекс:
  - `YANDEX_CLIENT_ID`
  - `YANDEX_CLIENT_SECRET`
  - `YANDEX_REDIRECT_URI=https://mossybloom.ru/api/auth/oauth/yandex/callback`

После OAuth пользователь возвращается в `/account` уже авторизованным.

## 7) Опционально: защита ручного обновления статуса

Для endpoint `PATCH /api/orders/:orderId/status` заполните:

- `ADMIN_API_TOKEN`

И передавайте заголовок `x-admin-token`.

## Локальный запуск

1. Скопируйте `.env.example` -> `.env` и заполните ключи.
2. Запустите API:
   - `npm run dev:api`
3. Запустите фронт:
   - `npm run dev`

Vite проксирует `/api/*` на `http://127.0.0.1:8787`.

## 8) DaData (��������� ������ � checkout)

���������:

- `DADATA_API_KEY`

Frontend �������� `/api/dadata/address-suggestions`, � ������ ���������� ������ � DaData.
���� DaData �������� ������ �� ������� � �� ������ � �������.

## 9) Strapi CMS (�������� CMS)

- Strapi ������ ���������� � `strapi-cms/`.
- ������� �������� ������ CMS ����� `GET http://127.0.0.1:1337/api/public-cms`.
- ��������� CMS ������������� ����� env:
  - `VITE_CMS_PROVIDER=strapi` (�� ���������, ������ CMS ���������)
  - `VITE_CMS_PROVIDER=legacy` (��������� fallback �� localStorage CMS)

������ Strapi:

- `npm run dev:cms`

����� ������� ������� seed-������� ������������� ������������� � Strapi �� legacy-���������.

## 10) Подтверждение email кодом (6 цифр)

### Что добавлено

- Поле пользователя: `email_verified` (`boolean`)
- Таблица кодов: `email_verification_codes`
- Endpoints:
  - `POST /api/auth/verify-email-code`
  - `POST /api/auth/resend-email-code`
- Обновлённые flow:
  - `POST /api/auth/register` теперь создаёт пользователя с `email_verified=false`, отправляет код и возвращает `requiresEmailVerification=true`
  - `POST /api/auth/login` блокирует вход для не подтверждённого email и возвращает `requiresEmailVerification=true`

### Правила безопасности

- Код: 6 цифр
- TTL: 10 минут
- Максимум 5 попыток на код
- Повторная отправка: не чаще 1 раза в 60 секунд
- Ограничение resend: максимум 5 запросов в час на email и IP
- Ограничение verify: ограничение по IP в час
- Хранится только `code_hash`, а не открытый код
- Старые активные коды инвалидируются при создании нового

### Используемый email provider

Используется текущий provider проекта (Unisender), отдельный SMTP не подключается.

Нужные env:

- `UNISENDER_API_KEY`
- `UNISENDER_SENDER_EMAIL`
- `UNISENDER_SENDER_NAME`
- `UNISENDER_API_URL` (опционально)
- `EMAIL_CODE_HASH_SECRET` (опционально, иначе используется `JWT_SECRET`)

### Как протестировать локально

1. Зарегистрируйте пользователя с email через форму `/profile`.
2. API вернёт `requiresEmailVerification=true`, UI покажет форму ввода кода.
3. Введите 6-значный код из письма.
4. После успешной проверки `email_verified` станет `true`.
5. Для повторной отправки нажмите «Отправить код повторно» (таймер 60с).


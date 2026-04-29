import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import { Pool } from 'pg';
import {
  TochkaApiError,
  createPaymentLink,
  decodeWebhookJwtUnsafe,
  getPaymentStatus,
  validateTochkaEnv,
  verifyWebhookJwt
} from './tochkaClient.js';
import { createTochkaPaymentRepository } from './tochkaPaymentRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RECEIPTS_DIR = path.join(ROOT_DIR, 'public', 'receipts');

if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

const app = express();
const PORT = Number(process.env.API_PORT || 8787);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const DB_SSL_REQUIRED = process.env.DATABASE_URL?.includes('sslmode=require');
const PG_SSL_REJECT_UNAUTHORIZED =
  String(process.env.PG_SSL_REJECT_UNAUTHORIZED ?? 'true').trim().toLowerCase() !== 'false';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: DB_SSL_REQUIRED ? { rejectUnauthorized: PG_SSL_REJECT_UNAUTHORIZED } : undefined
});
const tochkaPaymentRepository = createTochkaPaymentRepository(pool);

const ORDER_STATUSES = {
  received: 'Заказ получен',
  paid: 'Заказ оплачен',
  assembled: 'Собран',
  out_for_delivery: 'Передан на доставку',
  delivered: 'Вручен'
};
const TELEGRAM_BIND_PREFIX = 'sfbind_';
const TELEGRAM_CALLBACK_STATUS_PREFIX = 'ordst';
const MANAGER_UPDATABLE_STATUSES = ['assembled', 'out_for_delivery', 'delivered'];
const MKAD_FREE_RADIUS_KM = 5;
const DELIVERY_PRICE_PER_KM = 50;
const MOSCOW_CENTER = { lat: 55.7558, lon: 37.6176 };
const MKAD_AVERAGE_RADIUS_KM = 17.5;
const EMAIL_VERIFICATION_CODE_LENGTH = 6;
const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFICATION_RESEND_LIMIT_PER_HOUR = 5;
const EMAIL_VERIFICATION_VERIFY_LIMIT_PER_HOUR = 30;
const REGISTER_LIMIT_PER_IP_PER_HOUR = 20;
const REGISTER_LIMIT_PER_EMAIL_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_CODE_HASH_SECRET = String(process.env.EMAIL_CODE_HASH_SECRET || JWT_SECRET);
const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;
let cachedTelegramBotUsername = null;
const rateLimitBuckets = {
  registerByIp: new Map(),
  registerByEmail: new Map(),
  resendByIp: new Map(),
  resendByEmail: new Map(),
  verifyByIp: new Map()
};
const emailResendCooldown = new Map();

app.use(cors());
app.use(express.json({
  limit: '4mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use('/receipts', express.static(RECEIPTS_DIR));

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function toRubAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num.toFixed(2) : '0.00';
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function buildDeliveryCalculationResult(rawBeltwayHit, rawBeltwayDistance) {
  const beltwayHit = typeof rawBeltwayHit === 'string' && rawBeltwayHit.trim()
    ? rawBeltwayHit.trim().toUpperCase()
    : null;
  const beltwayDistance = toNumberOrNull(rawBeltwayDistance);

  if (beltwayHit === 'IN_MKAD') {
    return {
      beltwayHit,
      beltwayDistanceKm: 0,
      freeRadiusKm: MKAD_FREE_RADIUS_KM,
      pricePerKm: DELIVERY_PRICE_PER_KM,
      chargeableDistanceKm: 0,
      deliveryPrice: 0
    };
  }

  if (beltwayDistance === null || beltwayDistance < 0) {
    return null;
  }

  const chargeableDistanceKm = Math.max(0, Number((beltwayDistance - MKAD_FREE_RADIUS_KM).toFixed(2)));
  return {
    beltwayHit,
    beltwayDistanceKm: beltwayDistance,
    freeRadiusKm: MKAD_FREE_RADIUS_KM,
    pricePerKm: DELIVERY_PRICE_PER_KM,
    chargeableDistanceKm,
    deliveryPrice: Math.round(chargeableDistanceKm * DELIVERY_PRICE_PER_KM)
  };
}

function buildDeliveryCalculationFromGeo(rawLat, rawLon) {
  const lat = toNumberOrNull(rawLat);
  const lon = toNumberOrNull(rawLon);
  if (lat === null || lon === null) return null;

  const distanceFromCenter = haversineDistanceKm(MOSCOW_CENTER.lat, MOSCOW_CENTER.lon, lat, lon);
  const beltwayDistanceKm = Math.max(0, Number((distanceFromCenter - MKAD_AVERAGE_RADIUS_KM).toFixed(2)));
  return buildDeliveryCalculationResult(
    beltwayDistanceKm <= 0 ? 'IN_MKAD' : 'OUT_MKAD',
    beltwayDistanceKm
  );
}

function signAuthToken(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

function authOptional(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.slice('Bearer '.length);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId };
  } catch {
    req.user = undefined;
  }
  return next();
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ.' });
  }

  try {
    const token = authHeader.slice('Bearer '.length);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId };
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'РЎРµСЃСЃРёСЏ РёСЃС‚РµРєР»Р°. Р’РѕР№РґРёС‚Рµ СЃРЅРѕРІР°.' });
  }
}

function requireAdminToken(req, res, next) {
  const apiToken = String(process.env.ADMIN_API_TOKEN || '').trim();
  if (!apiToken || req.headers['x-admin-token'] !== apiToken) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }
  return next();
}

function normalizePromoCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function sanitizeOrderItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const quantity = Number(item?.quantity || 0);
      const price = Number(item?.price || 0);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
        return null;
      }
      return {
        id: String(item?.id || crypto.randomUUID()),
        name: String(item?.name || 'Букет'),
        quantity: Math.max(1, Math.floor(quantity)),
        price: Number(price.toFixed(2)),
        image: typeof item?.image === 'string' ? item.image : ''
      };
    })
    .filter(Boolean);
}

function calculateSubtotal(items) {
  return Number(
    (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const quantity = Number(item?.quantity || 0);
      const price = Number(item?.price || 0);
      return sum + quantity * price;
    }, 0).toFixed(2)
  );
}

function normalizeMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(Math.max(0, numeric).toFixed(2));
}

async function getPromoCodeByCode(code) {
  const normalizedCode = normalizePromoCode(code);
  if (!PROMO_CODE_PATTERN.test(normalizedCode)) return null;

  const result = await pool.query(
    `SELECT *
     FROM promo_codes
     WHERE code = $1
     LIMIT 1`,
    [normalizedCode]
  );
  return result.rows[0] || null;
}

async function validatePromoCodeForOrder({ code, subtotal, userId }) {
  const normalizedCode = normalizePromoCode(code);
  const normalizedSubtotal = normalizeMoney(subtotal);
  if (!normalizedCode) {
    return { valid: false, reason: 'Введите промокод.' };
  }
  if (!PROMO_CODE_PATTERN.test(normalizedCode)) {
    return { valid: false, reason: 'Некорректный формат промокода.' };
  }

  const promo = await getPromoCodeByCode(normalizedCode);
  if (!promo) {
    return { valid: false, reason: 'Промокод не найден.' };
  }
  if (!promo.is_active) {
    return { valid: false, reason: 'Промокод неактивен.' };
  }

  const now = Date.now();
  const startsAt = promo.starts_at ? new Date(promo.starts_at).getTime() : null;
  const endsAt = promo.ends_at ? new Date(promo.ends_at).getTime() : null;
  if (startsAt && startsAt > now) {
    return { valid: false, reason: 'Промокод ещё не действует.' };
  }
  if (endsAt && endsAt < now) {
    return { valid: false, reason: 'Срок действия промокода истёк.' };
  }

  const minOrderAmount = normalizeMoney(promo.min_order_amount);
  if (normalizedSubtotal < minOrderAmount) {
    return {
      valid: false,
      reason: `Промокод действует от ${minOrderAmount.toLocaleString('ru-RU')} ₽.`
    };
  }

  const maxUsesTotal = promo.max_uses_total !== null ? Number(promo.max_uses_total) : null;
  const usesTotal = Number(promo.uses_total || 0);
  if (maxUsesTotal !== null && usesTotal >= maxUsesTotal) {
    return { valid: false, reason: 'Промокод исчерпан.' };
  }

  const maxUsesPerUser = promo.max_uses_per_user !== null ? Number(promo.max_uses_per_user) : null;
  if (maxUsesPerUser !== null && userId) {
    const perUser = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM promo_code_usages
       WHERE promo_code_id = $1 AND user_id = $2`,
      [promo.id, userId]
    );
    const usedByUser = Number(perUser.rows[0]?.count || 0);
    if (usedByUser >= maxUsesPerUser) {
      return { valid: false, reason: 'Лимит использования промокода для пользователя исчерпан.' };
    }
  }

  const discountPercent = Math.max(0, Math.min(100, Number(promo.discount_percent || 0)));
  if (discountPercent <= 0) {
    return { valid: false, reason: 'У промокода нулевая скидка.' };
  }

  const discountAmount = Number((normalizedSubtotal * (discountPercent / 100)).toFixed(2));
  return {
    valid: true,
    promo,
    code: normalizedCode,
    discountPercent,
    discountAmount,
    subtotal: normalizedSubtotal
  };
}

function normalizePhone(raw) {
  return String(raw || '')
    .replace(/[^+\d]/g, '')
    .replace(/^8(\d{10})$/, '+7$1');
}

function normalizeEmail(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value || null;
}

function normalizeIp(raw) {
  const ip = String(raw || '').trim();
  return ip || 'unknown';
}

function generateVerificationCode() {
  return String(crypto.randomInt(0, 10 ** EMAIL_VERIFICATION_CODE_LENGTH)).padStart(EMAIL_VERIFICATION_CODE_LENGTH, '0');
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(`${EMAIL_CODE_HASH_SECRET}:${String(code || '').trim()}`).digest('hex');
}

function consumeRateLimit(bucket, key, limit, windowMs) {
  const now = Date.now();
  const raw = bucket.get(key);
  const recent = Array.isArray(raw) ? raw.filter((ts) => now - ts < windowMs) : [];
  if (recent.length >= limit) {
    const retryAfterMs = Math.max(1000, windowMs - (now - recent[0]));
    bucket.set(key, recent);
    return { ok: false, retryAfterMs };
  }
  recent.push(now);
  bucket.set(key, recent);
  return { ok: true, retryAfterMs: 0 };
}

function checkCooldown(cooldownBucket, key, cooldownMs) {
  const now = Date.now();
  const availableAt = Number(cooldownBucket.get(key) || 0);
  if (availableAt > now) {
    return { ok: false, retryAfterMs: availableAt - now };
  }
  return { ok: true, retryAfterMs: 0 };
}

function startCooldown(cooldownBucket, key, cooldownMs) {
  cooldownBucket.set(key, Date.now() + cooldownMs);
}

function normalizeUsername(raw) {
  const value = String(raw || '').trim();
  return value || null;
}

function isAcceptedConsent(value) {
  return value === true;
}

function normalizeOrderExtrasInput(extras) {
  const postcardRaw = typeof extras?.postcardText === 'string' ? extras.postcardText : '';
  const giftWrapTypeRaw = typeof extras?.giftWrapType === 'string' ? extras.giftWrapType : 'none';
  const giftWrapColorRaw = typeof extras?.giftWrapColor === 'string' ? extras.giftWrapColor : 'blush';
  const ribbonColorRaw = typeof extras?.ribbonColor === 'string' ? extras.ribbonColor : 'none';
  const giftWrapType = ['none', 'kraft', 'colored', 'transparent'].includes(giftWrapTypeRaw) ? giftWrapTypeRaw : 'none';
  const giftWrapColor = ['blush', 'ivory', 'mint', 'lilac'].includes(giftWrapColorRaw) ? giftWrapColorRaw : 'blush';
  const ribbonColor = ['none', 'white', 'pink', 'red', 'gold', 'green'].includes(ribbonColorRaw) ? ribbonColorRaw : 'none';
  return {
    giftWrap: Boolean(extras?.giftWrap) || giftWrapType !== 'none',
    ribbon: Boolean(extras?.ribbon) || ribbonColor !== 'none',
    giftWrapType,
    giftWrapColor,
    ribbonColor,
    postcardText: postcardRaw.trim().slice(0, 500)
  };
}

function getWrapTypeLabel(type, color) {
  if (type === 'kraft') return 'Крафт';
  if (type === 'transparent') return 'Прозрачная упаковка';
  if (type === 'colored') {
    const colorMap = {
      blush: 'розовая бумага',
      ivory: 'кремовая бумага',
      mint: 'мятная бумага',
      lilac: 'сиреневая бумага'
    };
    return `Цветная бумага (${colorMap[color] || 'цвет'})`;
  }
  return 'Без упаковки';
}

function getRibbonColorLabel(color) {
  const colorMap = {
    none: 'Без ленты',
    white: 'Белая',
    pink: 'Розовая',
    red: 'Красная',
    gold: 'Золотая',
    green: 'Зеленая'
  };
  return colorMap[color] || 'Без ленты';
}

function normalizeBitrixWebhookBase(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('.json')) {
    const idx = trimmed.lastIndexOf('/');
    return idx > -1 ? trimmed.slice(0, idx) : trimmed;
  }
  return trimmed;
}

function decodeMojibakeIfNeeded(value) {
  const source = String(value ?? '').trim();
  if (!source) return '';
  const looksBroken = /(?:\u00D0.|\u00D1.|\u0420.|\u0421.){2,}/.test(source);
  if (!looksBroken) return source;
  try {
    const decoded = Buffer.from(source, 'latin1').toString('utf8').trim();
    return decoded || source;
  } catch {
    return source;
  }
}

function getOAuthRedirectUri(provider) {
  const providerKey = String(provider || '').trim().toLowerCase();
  if (providerKey === 'google') {
    const explicit = String(process.env.GOOGLE_REDIRECT_URI || '').trim();
    return explicit || `${PUBLIC_BASE_URL}/api/auth/oauth/google/callback`;
  }
  if (providerKey === 'yandex') {
    const explicit = String(process.env.YANDEX_REDIRECT_URI || '').trim();
    return explicit || `${PUBLIC_BASE_URL}/api/auth/oauth/yandex/callback`;
  }
  return '';
}

function mapToInternalPaymentStatus(externalStatus) {
  const status = String(externalStatus || '').toUpperCase();
  if (status === 'APPROVED' || status === 'SUCCEEDED' || status === 'SUCCESS') return 'paid';
  if (status === 'AUTHORIZED' || status === 'CREATED' || status === 'PENDING') return 'pending';
  if (status === 'DECLINED' || status === 'FAILED' || status === 'CANCELED' || status === 'CANCELLED') return 'failed';
  return 'pending';
}

function mapToInternalOrderStatus(externalStatus) {
  return mapToInternalPaymentStatus(externalStatus) === 'paid' ? 'paid' : 'received';
}

function getTochkaOperationId(payload) {
  return String(
    payload?.operationId ||
    payload?.paymentId ||
    payload?.id ||
    payload?.data?.operationId ||
    ''
  ).trim();
}

function getTochkaPayloadStatus(payload) {
  return String(payload?.status || payload?.paymentStatus || payload?.data?.status || '').trim();
}

function getTochkaWebhookToken(req) {
  const body = req.body;
  if (typeof body === 'string' && body.split('.').length === 3) {
    return body.trim();
  }
  if (typeof req.rawBody === 'string') {
    const rawTrimmed = req.rawBody.trim();
    if (rawTrimmed.split('.').length === 3) {
      return rawTrimmed;
    }
    // JSON string case: "jwt.token.value"
    if (rawTrimmed.startsWith('"') && rawTrimmed.endsWith('"')) {
      const unwrapped = rawTrimmed.slice(1, -1);
      if (unwrapped.split('.').length === 3) return unwrapped;
    }
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return '';
}

function getErrorStatusCode(error) {
  if (error instanceof TochkaApiError && Number.isInteger(error.statusCode)) {
    return error.statusCode;
  }
  return 500;
}

async function sendTelegramMessage(text, options = {}) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = String(options.chatId || process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!chatId) {
    throw new Error('Missing required env: TELEGRAM_CHAT_ID (or chatId argument)');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options.parseMode || 'HTML',
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${await response.text()}`);
  }
}

async function sendTelegramPhoto(photoUrl, caption = '', options = {}) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = String(options.chatId || process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!chatId) {
    throw new Error('Missing required env: TELEGRAM_CHAT_ID (or chatId argument)');
  }

  if (photoUrl.startsWith('data:image/')) {
    const match = photoUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URI image format');
    }

    const mimeType = match[1];
    const base64Payload = match[2];
    const binary = Buffer.from(base64Payload, 'base64');

    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }
    if (options.replyMarkup) {
      formData.append('reply_markup', JSON.stringify(options.replyMarkup));
    }
    formData.append('photo', new Blob([binary], { type: mimeType }), 'order-image.jpg');

    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Telegram sendPhoto failed: ${await response.text()}`);
    }
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      caption
        ? {
            chat_id: chatId,
            photo: photoUrl,
            caption,
            parse_mode: 'HTML',
            ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {})
          }
        : {
            chat_id: chatId,
            photo: photoUrl,
            ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {})
          }
    )
  });

  if (!response.ok) {
    throw new Error(`Telegram sendPhoto failed: ${await response.text()}`);
  }
}

async function sendTelegramDocument(filePath, caption) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');
  const fileBuffer = await fs.promises.readFile(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append('chat_id', chatId);
  if (caption) {
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
  }
  formData.append('document', new Blob([fileBuffer], { type: 'application/pdf' }), fileName);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Telegram sendDocument failed: ${await response.text()}`);
  }
}

function getOrderPhotoList(order) {
  const photos = [];
  const items = Array.isArray(order?.items_json) ? order.items_json : [];

  for (const item of items) {
    const rawImage = typeof item?.image === 'string' ? item.image.trim() : '';
    if (!rawImage) continue;

    const image = rawImage.startsWith('/') ? `${PUBLIC_BASE_URL}${rawImage}` : rawImage;
    const hasSupportedImage =
      image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:image/');
    if (!hasSupportedImage) continue;

    const quantity = Math.max(1, Number.parseInt(String(item?.quantity ?? 1), 10) || 1);
    for (let i = 0; i < quantity; i += 1) {
      photos.push(image);
    }
  }

  if (photos.length > 0) return photos;

  const rawImage = typeof order?.first_image === 'string' ? order.first_image.trim() : '';
  if (!rawImage) return photos;

  const image = rawImage.startsWith('/') ? `${PUBLIC_BASE_URL}${rawImage}` : rawImage;
  const hasSupportedImage =
    image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:image/');
  if (hasSupportedImage) {
    photos.push(image);
  }

  return photos;
}

function isLocalOrPrivateUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return true;
  }
}

async function sendOrderTelegramNotification(order, message) {
  const replyMarkup = buildOrderStatusInlineKeyboard(order.id, order.status);
  const photos = getOrderPhotoList(order).filter((photoUrl) => !isLocalOrPrivateUrl(photoUrl));
  const captionLimit = 1024;
  const caption = message.length > captionLimit ? `${message.slice(0, captionLimit - 1)}...` : message;

  // Send all bouquet photos according to ordered quantities.
  if (photos.length > 0) {
    try {
      await sendTelegramPhoto(photos[0], caption, { replyMarkup });
      for (let i = 1; i < photos.length; i += 1) {
        try {
          await sendTelegramPhoto(photos[i]);
        } catch (photoError) {
          // eslint-disable-next-line no-console
          console.warn('Telegram additional photo send failed, skipping:', photoError);
        }
      }
      return;
    } catch (firstPhotoError) {
      // eslint-disable-next-line no-console
      console.warn('Telegram first photo send failed, fallback to text message:', firstPhotoError);
    }
  }

  await sendTelegramMessage(message, { replyMarkup });
}

async function sendSmsCode(phone, code) {
  const apiId = process.env.SMSRU_API_ID?.trim();
  const text = `MossyBloom: код входа ${code}`;

  if (!apiId) {
    // Dev fallback: no provider configured
    // eslint-disable-next-line no-console
    console.warn(`[SMS DEV] ${phone}: ${code}`);
    return { devMode: true };
  }

  const url = new URL('https://sms.ru/sms/send');
  url.searchParams.set('api_id', apiId);
  url.searchParams.set('to', phone);
  url.searchParams.set('msg', text);
  url.searchParams.set('json', '1');

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.status !== 'OK') {
    const providerDetails = [data?.status_code, data?.status_text].filter(Boolean).join(': ');
    throw new Error(
      providerDetails
        ? `Не удалось отправить SMS код (${providerDetails}).`
        : 'Не удалось отправить SMS код. Проверьте настройки SMSRU_API_ID.'
    );
  }

  return { devMode: false };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOrderItems(orderItems) {
  if (!Array.isArray(orderItems)) return 'Состав не указан';
  return orderItems
    .map((item) => `• ${item.name} x${item.quantity} (${Number(item.price).toLocaleString('ru-RU')} ₽)`)
    .join('\n');
}

function formatOrderItemsHtml(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return '<li>Состав не указан</li>';
  }
  return orderItems
    .map((item) => {
      const name = escapeHtml(item?.name || 'Букет');
      const quantity = Number(item?.quantity || 1);
      const price = Number(item?.price || 0).toLocaleString('ru-RU');
      return `<li>${name} × ${quantity} — ${price} ₽</li>`;
    })
    .join('');
}

function buildReceiptUrl(receiptPath) {
  const normalized = String(receiptPath || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('/')) return `${PUBLIC_BASE_URL}${normalized}`;
  return `${PUBLIC_BASE_URL}/${normalized}`;
}

function buildOrderEmailSubject(order, options = {}) {
  const { paid = false } = options;
  return paid
    ? `Заказ успешно оплачен: ${order.id}`
    : `Заказ успешно оформлен: ${order.id}`;
}

function buildOrderEmailText(order, options = {}) {
  const { paid = false, receiptPath = '' } = options;
  const itemsText = formatOrderItems(order.items_json);
  const statusLabel = paid ? 'Заказ успешно оплачен.' : 'Заказ успешно оформлен.';
  const receiptUrl = buildReceiptUrl(receiptPath || order.receipt_path);
  const recipientLine = order.recipient_mode === 'other'
    ? `${order.recipient_name || '—'}, ${order.recipient_phone || '—'}, ${order.recipient_email || '—'}`
    : `${order.payer_name || '—'}, ${order.payer_phone || '—'}, ${order.payer_email || '—'}`;

  return [
    `Здравствуйте!`,
    '',
    statusLabel,
    `Номер заказа: ${order.id}`,
    `Сумма: ${Number(order.total || 0).toLocaleString('ru-RU')} ₽`,
    '',
    'Состав заказа:',
    itemsText,
    '',
    `Адрес доставки: ${order.delivery_address || '—'}`,
    `Получатель: ${recipientLine}`,
    `Упаковка: ${getWrapTypeLabel(order.gift_wrap_type, order.gift_wrap_color)}`,
    `Лента: ${getRibbonColorLabel(order.ribbon_color)}`,
    `Открытка: "${(order.postcard_text || '').trim() || '—'}"`,
    order.comment ? `Комментарий: ${order.comment}` : '',
    receiptUrl ? `PDF-чек: ${receiptUrl}` : '',
    '',
    'Спасибо за заказ в MossyBloom!'
  ]
    .filter(Boolean)
    .join('\n');
}

function buildOrderEmailHtml(order, options = {}) {
  const { paid = false, receiptPath = '' } = options;
  const statusLabel = paid ? 'Заказ успешно оплачен' : 'Заказ успешно оформлен';
  const receiptUrl = buildReceiptUrl(receiptPath || order.receipt_path);
  const recipientLine = order.recipient_mode === 'other'
    ? `${order.recipient_name || '—'}, ${order.recipient_phone || '—'}, ${order.recipient_email || '—'}`
    : `${order.payer_name || '—'}, ${order.payer_phone || '—'}, ${order.payer_email || '—'}`;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5">
      <h2 style="margin:0 0 12px;">${escapeHtml(statusLabel)}</h2>
      <p style="margin:0 0 4px;"><b>Номер заказа:</b> ${escapeHtml(order.id)}</p>
      <p style="margin:0 0 16px;"><b>Сумма:</b> ${Number(order.total || 0).toLocaleString('ru-RU')} ₽</p>
      <p style="margin:0 0 8px;"><b>Состав заказа:</b></p>
      <ul style="margin:0 0 16px 20px;padding:0;">
        ${formatOrderItemsHtml(order.items_json)}
      </ul>
      <p style="margin:0 0 4px;"><b>Адрес доставки:</b> ${escapeHtml(order.delivery_address || '—')}</p>
      <p style="margin:0 0 4px;"><b>Получатель:</b> ${escapeHtml(recipientLine)}</p>
      <p style="margin:0 0 4px;"><b>Упаковка:</b> ${escapeHtml(getWrapTypeLabel(order.gift_wrap_type, order.gift_wrap_color))}</p>
      <p style="margin:0 0 4px;"><b>Лента:</b> ${escapeHtml(getRibbonColorLabel(order.ribbon_color))}</p>
      <p style="margin:0 0 4px;"><b>Открытка:</b> "${escapeHtml((order.postcard_text || '').trim() || '—')}"</p>
      ${order.comment ? `<p style="margin:0 0 4px;"><b>Комментарий:</b> ${escapeHtml(order.comment)}</p>` : ''}
      ${receiptUrl ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(receiptUrl)}" target="_blank" rel="noreferrer">Скачать PDF-чек</a></p>` : ''}
      <p style="margin:16px 0 0;">Спасибо за заказ в MossyBloom!</p>
    </div>
  `.trim();
}

async function sendOrderConfirmationEmail(order, options = {}) {
  const apiKey = String(process.env.UNISENDER_API_KEY || '').trim();
  const senderEmail = String(process.env.UNISENDER_SENDER_EMAIL || '').trim() || 'shattlexagteam@gmail.com';
  const senderName = String(process.env.UNISENDER_SENDER_NAME || '').trim() || 'MossyBloom';
  const recipientEmail = normalizeEmail(order?.payer_email);

  if (!apiKey) {
    console.warn('[email][unisender] skip send: missing UNISENDER_API_KEY', {
      orderId: order?.id || null,
      recipientEmail: recipientEmail || null
    });
    return false;
  }
  if (!recipientEmail) {
    console.warn('[email][unisender] skip send: missing recipient email', {
      orderId: order?.id || null
    });
    return false;
  }

  const url = String(process.env.UNISENDER_API_URL || 'https://api.unisender.com/ru/api/sendEmail').trim();
  const subject = buildOrderEmailSubject(order, options);
  const htmlBody = buildOrderEmailHtml(order, options);

  const formData = new URLSearchParams();
  formData.set('api_key', apiKey);
  formData.set('email', recipientEmail);
  formData.set('sender_name', senderName);
  formData.set('sender_email', senderEmail);
  formData.set('subject', subject);
  formData.set('body', htmlBody);
  // Some Unisender API methods reject extra fields like `body_type`.
  // We send HTML body without this flag for compatibility.

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  const responseText = await response.text();
  const payload = (() => {
    try {
      return responseText ? JSON.parse(responseText) : {};
    } catch {
      return {};
    }
  })();

  console.info('[email][unisender] response received', {
    orderId: order?.id || null,
    recipientEmail,
    senderEmail,
    url,
    status: response.status,
    ok: response.ok
  });

  if (!response.ok || payload?.error) {
    const providerMessage = payload?.error
      ? `${payload.error}${payload?.code ? ` (${payload.code})` : ''}`
      : `HTTP ${response.status}`;
    console.error('[email][unisender] send failed', {
      orderId: order?.id || null,
      recipientEmail,
      senderEmail,
      url,
      status: response.status,
      statusText: response.statusText,
      payload,
      rawResponse: responseText
    });
    throw new Error(`Unisender sendEmail failed: ${providerMessage}`);
  }

  console.info('[email][unisender] send success', {
    orderId: order?.id || null,
    recipientEmail,
    payload
  });

  return true;
}

async function sendVerificationCodeEmail({ to, code }) {
  const apiKey = String(process.env.UNISENDER_API_KEY || '').trim();
  const senderEmail = String(process.env.UNISENDER_SENDER_EMAIL || '').trim() || 'shattlexagteam@gmail.com';
  const senderName = String(process.env.UNISENDER_SENDER_NAME || '').trim() || 'MossyBloom';
  const recipientEmail = normalizeEmail(to);

  if (!apiKey) {
    throw new Error('Email provider is not configured: UNISENDER_API_KEY is missing.');
  }
  if (!recipientEmail) {
    throw new Error('Recipient email is required for verification code.');
  }

  const subject = 'Подтверждение email';
  const textBody = `Ваш код подтверждения: ${code}\n\nКод действует 10 минут.`;
  const htmlBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5">
      <h2 style="margin:0 0 12px;">Подтверждение email</h2>
      <p style="margin:0 0 8px;">Ваш код подтверждения:</p>
      <p style="margin:0 0 12px;font-size:28px;font-weight:700;letter-spacing:4px;">${escapeHtml(code)}</p>
      <p style="margin:0;">Код действует 10 минут.</p>
    </div>
  `.trim();

  const url = String(process.env.UNISENDER_API_URL || 'https://api.unisender.com/ru/api/sendEmail').trim();
  const formData = new URLSearchParams();
  formData.set('api_key', apiKey);
  formData.set('email', recipientEmail);
  formData.set('sender_name', senderName);
  formData.set('sender_email', senderEmail);
  formData.set('subject', subject);
  formData.set('body', htmlBody);
  // Some Unisender API methods reject extra fields like `body_type`.
  // We send HTML body without this flag for compatibility.

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  const responseText = await response.text();
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok || payload?.error) {
    const providerMessage = payload?.error
      ? `${payload.error}${payload?.code ? ` (${payload.code})` : ''}`
      : `HTTP ${response.status}`;
    const rawProviderError = String(payload?.error || '');
    const requiresAuthenticatedSender = /custom domain email with authentication/i.test(rawProviderError);
    const humanReadableMessage = requiresAuthenticatedSender
      ? 'Unisender не принял адрес отправителя. Подтвердите email/домен отправителя в Unisender и укажите подтвержденный адрес в UNISENDER_SENDER_EMAIL.'
      : providerMessage;
    console.error('[email][verification] send failed', {
      recipientEmail,
      senderEmail,
      url,
      status: response.status,
      statusText: response.statusText,
      payload,
      rawResponse: responseText
    });
    throw new Error(`Unisender verification email failed: ${humanReadableMessage}`);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[email][verification] send success', {
      recipientEmail,
      previewText: textBody
    });
  } else {
    console.info('[email][verification] send success', { recipientEmail });
  }

  return true;
}

async function createEmailVerificationCode({ userId, email }) {
  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE email_verification_codes
       SET used = true, updated_at = NOW()
       WHERE user_id = $1 AND email = $2 AND used = false`,
      [userId, email]
    );
    await client.query(
      `INSERT INTO email_verification_codes (
         id, user_id, email, code_hash, expires_at, attempts_count, used, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 0, false, NOW(), NOW())`,
      [crypto.randomUUID(), userId, email, codeHash, expiresAt]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Email provider integration point: keep this isolated to swap providers later.
  await sendVerificationCodeEmail({ to: email, code });
  return true;
}

function buildTelegramOrderMessage(order, options = {}) {
  const { paid = true } = options;
  const itemsText = formatOrderItems(order.items_json);
  const recipientLine = order.recipient_mode === 'other'
    ? `${order.recipient_name || '—'}, ${order.recipient_phone || '—'}, ${order.recipient_email || '—'}`
    : `${order.payer_name || '—'}, ${order.payer_phone || '—'}, ${order.payer_email || '—'}`;

  return [
    paid ? `<b>Оплачен заказ ${escapeHtml(order.id)}</b>` : `<b>Новый заказ (наличные) ${escapeHtml(order.id)}</b>`,
    `Сумма: <b>${Number(order.total).toLocaleString('ru-RU')} ₽</b>`,
    paid ? 'Статус оплаты: <b>Оплачен</b>' : 'Статус оплаты: <b>Не оплачен (наличные)</b>',
    '',
    `<b>Букет(ы):</b>`,
    escapeHtml(itemsText),
    '',
    `<b>Адрес доставки:</b> ${escapeHtml(order.delivery_address || '—')}`,
    `<b>Плательщик:</b> ${escapeHtml(order.payer_name || '—')} / ${escapeHtml(order.payer_phone || '—')} / ${escapeHtml(order.payer_email || '—')}`,
    `<b>Получатель:</b> ${escapeHtml(recipientLine)}`,
    `<b>Упаковка:</b> ${escapeHtml(getWrapTypeLabel(order.gift_wrap_type, order.gift_wrap_color))}`,
    `<b>Лента:</b> ${escapeHtml(getRibbonColorLabel(order.ribbon_color))}`,
    `<b>Открытка:</b> "${escapeHtml((order.postcard_text || '').trim() || '—')}"`,
    order.comment ? `<b>Комментарий:</b> ${escapeHtml(order.comment)}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function mapUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    last_name: user.last_name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    default_delivery_address: user.default_delivery_address,
    email_verified: Boolean(user.email_verified),
    auth_provider: user.auth_provider,
    created_at: user.created_at,
    telegram_chat_id: user.telegram_chat_id || null,
    telegram_username: user.telegram_username || null,
    telegram_connected_at: user.telegram_connected_at || null
  };
}

async function getTelegramBotUsername() {
  if (cachedTelegramBotUsername) return cachedTelegramBotUsername;

  const fromEnv = String(process.env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@+/, '');
  if (fromEnv) {
    cachedTelegramBotUsername = fromEnv;
    return cachedTelegramBotUsername;
  }

  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return null;

  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.result?.username) {
    return null;
  }

  cachedTelegramBotUsername = String(data.result.username).replace(/^@+/, '');
  return cachedTelegramBotUsername;
}

function buildCustomerStatusMessage(orderId, status, updatedAt) {
  const statusLabel = ORDER_STATUSES[status] || status || 'Статус обновлен';
  const dateLabel = updatedAt ? new Date(updatedAt).toLocaleString('ru-RU') : new Date().toLocaleString('ru-RU');
  return [
    `<b>Обновление по заказу ${escapeHtml(orderId)}</b>`,
    `Новый статус: <b>${escapeHtml(statusLabel)}</b>`,
    `Время: ${escapeHtml(dateLabel)}`,
    '',
    'Детали доступны в личном кабинете на сайте.'
  ].join('\n');
}

function getTelegramAdminIdSet() {
  const raw = String(process.env.TELEGRAM_ADMIN_IDS || '').trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function buildOrderStatusInlineKeyboard(orderId, currentStatus) {
  const safeOrderId = String(orderId || '').trim();
  if (!safeOrderId) return null;
  const statusButtons = [
    { key: 'assembled', label: 'Собирается/собран' },
    { key: 'out_for_delivery', label: 'Передан в доставку' },
    { key: 'delivered', label: 'Вручен' }
  ];

  return {
    inline_keyboard: statusButtons.map((button) => [
      {
        text: currentStatus === button.key ? `✅ ${button.label}` : button.label,
        callback_data: `${TELEGRAM_CALLBACK_STATUS_PREFIX}|${safeOrderId}|${button.key}`
      }
    ])
  };
}

function parseOrderStatusCallbackData(data) {
  const parts = String(data || '').split('|');
  if (parts.length !== 3 || parts[0] !== TELEGRAM_CALLBACK_STATUS_PREFIX) return null;
  return {
    orderId: parts[1],
    nextStatus: parts[2]
  };
}

async function answerTelegramCallbackQuery(callbackQueryId, options = {}) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  if (!callbackQueryId) return;

  const response = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      ...(options.text ? { text: options.text } : {}),
      ...(options.showAlert ? { show_alert: true } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram answerCallbackQuery failed: ${await response.text()}`);
  }
}

async function editTelegramMessageReplyMarkup(chatId, messageId, replyMarkup) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const response = await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram editMessageReplyMarkup failed: ${await response.text()}`);
  }
}

async function updateOrderStatus(orderId, nextStatus) {
  const updated = await pool.query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [nextStatus, orderId]
  );
  return updated.rows[0] || null;
}

async function notifyCustomerOrderStatus(orderId, status, updatedAt) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return;

  const orderResult = await pool.query(
    `SELECT o.id, o.status, o.updated_at, u.telegram_chat_id
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.id = $1
     LIMIT 1`,
    [orderId]
  );
  const row = orderResult.rows[0];
  const chatId = String(row?.telegram_chat_id || '').trim();
  if (!chatId) return;

  const text = buildCustomerStatusMessage(orderId, status || row.status, updatedAt || row.updated_at);
  await sendTelegramMessage(text, { chatId });
}

async function createReceiptPdf(order) {
  const fileName = `${order.id}.pdf`;
  const filePath = path.join(RECEIPTS_DIR, fileName);
  const preferredFonts = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    'C:\\Windows\\Fonts\\arial.ttf'
  ];
  const unicodeFont = preferredFonts.find((fontPath) => fs.existsSync(fontPath));

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);
    if (unicodeFont) {
      doc.font(unicodeFont);
    }
    doc.fontSize(20).text('MossyBloom — Кассовый чек');
    doc.moveDown();

    doc.fontSize(12).text(`Заказ: ${order.id}`);
    doc.text(`Дата: ${new Date().toLocaleString('ru-RU')}`);
    doc.text(`Статус: ${ORDER_STATUSES[order.status] || order.status}`);
    doc.moveDown();

    doc.fontSize(14).text('Позиции:');
    doc.moveDown(0.5);

    for (const item of order.items_json || []) {
      doc.fontSize(12).text(`${item.name} x${item.quantity} — ${Number(item.price).toLocaleString('ru-RU')} ₽`);
    }

    doc.moveDown();
    doc.fontSize(12).text(`Итого: ${Number(order.total).toLocaleString('ru-RU')} ₽`);
    doc.text(`Адрес доставки: ${order.delivery_address || '—'}`);
    doc.text(`Плательщик: ${order.payer_name || '—'}, ${order.payer_phone || '—'}, ${order.payer_email || '—'}`);
    doc.text(`Упаковка: ${getWrapTypeLabel(order.gift_wrap_type, order.gift_wrap_color)}`);
    doc.text(`Лента: ${getRibbonColorLabel(order.ribbon_color)}`);
    doc.text(`Открытка: "${(order.postcard_text || '').trim() || '—'}"`);

    if (order.recipient_mode === 'other') {
      doc.text(`Получатель: ${order.recipient_name || '—'}, ${order.recipient_phone || '—'}, ${order.recipient_email || '—'}`);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `/receipts/${fileName}`;
}

async function markOrderAsPaidAndNotify(orderId) {
  const updatedOrder = await pool.query(
    `UPDATE orders
     SET payment_status = 'paid',
         status = 'paid',
         paid_at = COALESCE(paid_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId]
  );
  const order = updatedOrder.rows[0];
  if (!order) return null;

  const receiptPath = await createReceiptPdf(order);
  await pool.query(`UPDATE orders SET receipt_path = $1, updated_at = NOW() WHERE id = $2`, [receiptPath, orderId]);

  try {
    await sendOrderConfirmationEmail(order, { paid: true, receiptPath });
  } catch (emailError) {
    // eslint-disable-next-line no-console
    console.error('Order confirmation email failed (paid):', emailError);
  }

  const message = buildTelegramOrderMessage(order, { paid: true });
  await sendOrderTelegramNotification(order, message);
  const receiptFilePath = path.join(RECEIPTS_DIR, path.basename(receiptPath));
  await sendTelegramDocument(receiptFilePath, `<b>PDF-чек</b> по заказу ${escapeHtml(order.id)}`);
  await notifyCustomerOrderStatus(order.id, 'paid', order.updated_at);
  return order;
}

async function createTochkaPaymentForExistingOrder({ orderId, amount, description }) {
  const existing = await tochkaPaymentRepository.getPaymentByOrderId(orderId);
  if (existing?.operationId && existing?.paymentLink) {
    return {
      success: true,
      operationId: existing.operationId,
      paymentLink: existing.paymentLink,
      raw: { reused: true, status: existing.status }
    };
  }

  const operation = await createPaymentLink({
    amount,
    purpose: description,
    paymentMode: ['card', 'sbp'],
    paymentLinkId: orderId,
    redirectUrl: `${PUBLIC_BASE_URL}/checkout?payment=success&orderId=${encodeURIComponent(orderId)}`,
    failRedirectUrl: `${PUBLIC_BASE_URL}/checkout?payment=failed&orderId=${encodeURIComponent(orderId)}`
  });

  await tochkaPaymentRepository.createPaymentRecord({
    orderId,
    operationId: operation.operationId,
    paymentLink: operation.paymentLink,
    amount,
    status: getTochkaPayloadStatus(operation.raw),
    rawPayload: operation.raw
  });

  return operation;
}

async function upsertOAuthUser({ provider, providerUserId, email, name }) {
  const existing = await pool.query(
    `SELECT * FROM users WHERE auth_provider = $1 AND provider_user_id = $2 LIMIT 1`,
    [provider, providerUserId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  if (email) {
    const byEmail = await pool.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (byEmail.rows[0]) {
      const updated = await pool.query(
        `UPDATE users
         SET auth_provider = $1,
             provider_user_id = $2,
             email_verified = true,
             updated_at = NOW(),
             name = COALESCE(NULLIF($3, ''), name)
         WHERE id = $4
         RETURNING *`,
        [provider, providerUserId, name || '', byEmail.rows[0].id]
      );
      return updated.rows[0];
    }
  }

  const inserted = await pool.query(
    `INSERT INTO users (id, name, email, email_verified, auth_provider, provider_user_id)
     VALUES ($1, $2, $3, true, $4, $5)
     RETURNING *`,
    [crypto.randomUUID(), name || '', email, provider, providerUserId]
  );

  return inserted.rows[0];
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      last_name TEXT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT true,
      phone TEXT UNIQUE,
      default_delivery_address TEXT,
      password_hash TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'password',
      provider_user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_delivery_address TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMPTZ;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users (username) WHERE username IS NOT NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sms_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_link_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id ON telegram_link_tokens(user_id);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verification_codes_lookup ON email_verification_codes (user_id, email, used, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes (expires_at);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_codes_single_active ON email_verification_codes (user_id, email) WHERE used = false;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_percent NUMERIC(5,2) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      max_uses_total INTEGER,
      uses_total INTEGER NOT NULL DEFAULT 0,
      max_uses_per_user INTEGER,
      min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'received',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payer_name TEXT,
      payer_phone TEXT,
      payer_email TEXT,
      recipient_mode TEXT NOT NULL DEFAULT 'self',
      recipient_name TEXT,
      recipient_phone TEXT,
      recipient_email TEXT,
      delivery_address TEXT,
      gift_wrap BOOLEAN NOT NULL DEFAULT false,
      ribbon BOOLEAN NOT NULL DEFAULT false,
      gift_wrap_type TEXT NOT NULL DEFAULT 'none',
      gift_wrap_color TEXT NOT NULL DEFAULT 'blush',
      ribbon_color TEXT NOT NULL DEFAULT 'none',
      postcard_text TEXT,
      comment TEXT,
      items_json JSONB NOT NULL,
      total NUMERIC(12,2) NOT NULL,
      first_image TEXT,
      payment_id TEXT,
      payment_provider TEXT,
      payment_url TEXT,
      payment_raw_status TEXT,
      tochka_customer_code TEXT,
      tochka_operation_id TEXT,
      tochka_last_payload JSONB,
      paid_at TIMESTAMPTZ,
      receipt_path TEXT,
      promo_code TEXT,
      promo_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      promo_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      delivery_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_before_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_after_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrap BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ribbon BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrap_type TEXT NOT NULL DEFAULT 'none';`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrap_color TEXT NOT NULL DEFAULT 'blush';`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ribbon_color TEXT NOT NULL DEFAULT 'none';`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS postcard_text TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_url TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_raw_status TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tochka_customer_code TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tochka_operation_id TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tochka_last_payload JSONB;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_amount NUMERIC(12,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_before_discount NUMERIC(12,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_after_discount NUMERIC(12,2) NOT NULL DEFAULT 0;`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_tochka_operation_id ON orders(tochka_operation_id);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_code_usages (
      id TEXT PRIMARY KEY,
      promo_code_id TEXT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_promo_code_usages_promo_code_id ON promo_code_usages(promo_code_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_promo_code_usages_user_id ON promo_code_usages(user_id);`);
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'mossybloom-api', db: 'ok' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'db error' });
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, last_name, username, email, phone, default_delivery_address, auth_provider, created_at,
              email_verified,
              telegram_chat_id, telegram_username, telegram_connected_at
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user.userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ.' });
    }

    return res.json({ ok: true, user: mapUserResponse(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.patch('/api/auth/profile', authRequired, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const username = normalizeUsername(req.body?.username);
    const normalizedEmail = normalizeEmail(req.body?.email);
    const normalizedPhone = normalizePhone(req.body?.phone);
    const defaultDeliveryAddressRaw = req.body?.defaultDeliveryAddress;
    const defaultDeliveryAddress = typeof defaultDeliveryAddressRaw === 'string'
      ? defaultDeliveryAddressRaw.trim()
      : '';

    if (!name || !username || (!normalizedEmail && !normalizedPhone)) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ РёРјСЏ, Р»РѕРіРёРЅ Рё С‚РµР»РµС„РѕРЅ РёР»Рё email.' });
    }

    if (defaultDeliveryAddress.length > 500) {
      return res.status(400).json({ ok: false, error: 'Address is too long.' });
    }

    const existing = await pool.query(
      `SELECT id FROM users
       WHERE id <> $1 AND (email = $2 OR phone = $3 OR username = $4)
       LIMIT 1`,
      [req.user.userId, normalizedEmail, normalizedPhone || null, username]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ ok: false, error: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email, С‚РµР»РµС„РѕРЅРѕРј РёР»Рё Р»РѕРіРёРЅРѕРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚.' });
    }

    const updated = await pool.query(
      `UPDATE users
       SET name = $1,
           last_name = $2,
           username = $3,
           email = $4,
           phone = $5,
           default_delivery_address = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, last_name, username, email, phone, default_delivery_address, auth_provider, created_at,
                 email_verified,
                 telegram_chat_id, telegram_username, telegram_connected_at`,
      [name, lastName || null, username, normalizedEmail, normalizedPhone || null, defaultDeliveryAddress || null, req.user.userId]
    );

    if (!updated.rows[0]) {
      return res.status(404).json({ ok: false, error: 'User not found.' });
    }

    return res.json({ ok: true, user: mapUserResponse(updated.rows[0]) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, lastName, username, email, phone, password, consentPersonalData, consentTerms } = req.body ?? {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const normalizedUsername = normalizeUsername(username);
    const requestIp = normalizeIp(req.ip);

    if (!name || !normalizedUsername || !password || !normalizedEmail) {
      return res.status(400).json({ ok: false, error: 'Укажите имя, логин, email и пароль.' });
    }
    if (!isAcceptedConsent(consentPersonalData) || !isAcceptedConsent(consentTerms)) {
      return res.status(400).json({ ok: false, error: 'Для регистрации требуется согласие на обработку персональных данных и пользовательское соглашение.' });
    }

    const registerIpRate = consumeRateLimit(rateLimitBuckets.registerByIp, `register:ip:${requestIp}`, REGISTER_LIMIT_PER_IP_PER_HOUR, RATE_LIMIT_WINDOW_MS);
    if (!registerIpRate.ok) {
      return res.status(429).json({
        ok: false,
        error: 'Слишком много попыток регистрации. Попробуйте позже.'
      });
    }

    const registerEmailRate = consumeRateLimit(rateLimitBuckets.registerByEmail, `register:email:${normalizedEmail}`, REGISTER_LIMIT_PER_EMAIL_PER_HOUR, RATE_LIMIT_WINDOW_MS);
    if (!registerEmailRate.ok) {
      return res.status(429).json({
        ok: false,
        error: 'Слишком много попыток регистрации для этого email. Попробуйте позже.'
      });
    }

    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1 OR phone = $2 OR username = $3 LIMIT 1`,
      [normalizedEmail, normalizedPhone || null, normalizedUsername]
    );

    if (existing.rows[0]) {
      return res.status(409).json({ ok: false, error: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const userId = crypto.randomUUID();

    const inserted = await pool.query(
      `INSERT INTO users (id, name, last_name, username, email, email_verified, phone, password_hash, auth_provider)
       VALUES ($1, $2, $3, $4, $5, false, $6, $7, 'password')
       RETURNING id, name, last_name, username, email, phone, default_delivery_address, auth_provider, created_at,
                 email_verified,
                 telegram_chat_id, telegram_username, telegram_connected_at`,
      [userId, String(name).trim(), String(lastName || '').trim() || null, normalizedUsername, normalizedEmail, normalizedPhone || null, passwordHash]
    );

    await createEmailVerificationCode({ userId, email: normalizedEmail });

    return res.json({
      ok: true,
      success: true,
      requiresEmailVerification: true,
      email: normalizedEmail
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body ?? {};
    if (!login || !password) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ.' });
    }

    const normalizedLogin = String(login).trim().toLowerCase();
    const normalizedPhone = normalizePhone(normalizedLogin);

    const found = await pool.query(
      `SELECT * FROM users WHERE email = $1 OR phone = $2 OR username = $3 LIMIT 1`,
      [normalizedLogin, normalizedPhone || null, normalizedLogin]
    );

    const user = found.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ ok: false, error: 'РќРµРІРµСЂРЅС‹Р№ Р»РѕРіРёРЅ РёР»Рё РїР°СЂРѕР»СЊ.' });
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'РќРµРІРµСЂРЅС‹Р№ Р»РѕРіРёРЅ РёР»Рё РїР°СЂРѕР»СЊ.' });
    }

    if (user.email && user.email_verified === false) {
      return res.status(403).json({
        ok: false,
        success: false,
        requiresEmailVerification: true,
        message: 'Подтвердите email',
        email: user.email
      });
    }

    const token = signAuthToken(user);
    return res.json({
      ok: true,
      token,
      user: mapUserResponse(user)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/auth/verify-email-code', async (req, res) => {
  try {
    const requestIp = normalizeIp(req.ip);
    const verifyRate = consumeRateLimit(rateLimitBuckets.verifyByIp, `verify:ip:${requestIp}`, EMAIL_VERIFICATION_VERIFY_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_MS);
    if (!verifyRate.ok) {
      return res.status(429).json({ ok: false, error: 'Слишком много попыток проверки кода. Попробуйте позже.' });
    }

    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'Укажите корректные email и 6-значный код.' });
    }

    const userResult = await pool.query(`SELECT id, email_verified FROM users WHERE email = $1 LIMIT 1`, [email]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(400).json({ ok: false, error: 'Неверный код или email.' });
    }

    if (user.email_verified === true) {
      return res.json({ ok: true, success: true, emailVerified: true });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const codeResult = await client.query(
        `SELECT id, code_hash, expires_at, attempts_count, used
         FROM email_verification_codes
         WHERE user_id = $1 AND email = $2 AND used = false
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [user.id, email]
      );
      const currentCode = codeResult.rows[0];

      if (!currentCode) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Код не найден или уже недействителен. Запросите новый.' });
      }

      const expired = new Date(currentCode.expires_at).getTime() <= Date.now();
      if (expired) {
        await client.query(
          `UPDATE email_verification_codes
           SET used = true, updated_at = NOW()
           WHERE id = $1`,
          [currentCode.id]
        );
        await client.query('COMMIT');
        return res.status(400).json({ ok: false, error: 'Код истёк. Запросите новый.' });
      }

      if (Number(currentCode.attempts_count) >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
        await client.query(
          `UPDATE email_verification_codes
           SET used = true, updated_at = NOW()
           WHERE id = $1`,
          [currentCode.id]
        );
        await client.query('COMMIT');
        return res.status(400).json({ ok: false, error: 'Превышено число попыток. Запросите новый код.' });
      }

      const updatedAttempt = await client.query(
        `UPDATE email_verification_codes
         SET attempts_count = attempts_count + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING attempts_count`,
        [currentCode.id]
      );
      const attemptsCount = Number(updatedAttempt.rows[0]?.attempts_count || 0);

      if (hashVerificationCode(code) !== currentCode.code_hash) {
        if (attemptsCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
          await client.query(
            `UPDATE email_verification_codes
             SET used = true, updated_at = NOW()
             WHERE id = $1`,
            [currentCode.id]
          );
        }
        await client.query('COMMIT');
        const attemptsLeft = Math.max(0, EMAIL_VERIFICATION_MAX_ATTEMPTS - attemptsCount);
        return res.status(400).json({
          ok: false,
          error: attemptsLeft > 0
            ? `Неверный код. Осталось попыток: ${attemptsLeft}.`
            : 'Превышено число попыток. Запросите новый код.'
        });
      }

      await client.query(
        `UPDATE users
         SET email_verified = true, updated_at = NOW()
         WHERE id = $1 AND email_verified = false`,
        [user.id]
      );
      await client.query(
        `UPDATE email_verification_codes
         SET used = true, updated_at = NOW()
         WHERE id = $1`,
        [currentCode.id]
      );
      await client.query('COMMIT');

      return res.json({ ok: true, success: true, emailVerified: true });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/auth/resend-email-code', async (req, res) => {
  try {
    const requestIp = normalizeIp(req.ip);
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Укажите email.' });
    }

    const ipRate = consumeRateLimit(rateLimitBuckets.resendByIp, `resend:ip:${requestIp}`, EMAIL_VERIFICATION_RESEND_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_MS);
    if (!ipRate.ok) {
      return res.status(429).json({ ok: false, error: 'Слишком много запросов кода. Попробуйте позже.' });
    }
    const emailRate = consumeRateLimit(rateLimitBuckets.resendByEmail, `resend:email:${email}`, EMAIL_VERIFICATION_RESEND_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_MS);
    if (!emailRate.ok) {
      return res.status(429).json({ ok: false, error: 'Слишком много запросов кода для этого email. Попробуйте позже.' });
    }

    const cooldownByIp = checkCooldown(emailResendCooldown, `resend:ip:${requestIp}`, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);
    if (!cooldownByIp.ok) {
      return res.status(429).json({
        ok: false,
        error: 'Повторная отправка доступна чуть позже.',
        retryAfterSeconds: Math.ceil(cooldownByIp.retryAfterMs / 1000)
      });
    }
    const cooldownByEmail = checkCooldown(emailResendCooldown, `resend:email:${email}`, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);
    if (!cooldownByEmail.ok) {
      return res.status(429).json({
        ok: false,
        error: 'Повторная отправка доступна чуть позже.',
        retryAfterSeconds: Math.ceil(cooldownByEmail.retryAfterMs / 1000)
      });
    }

    const userResult = await pool.query(
      `SELECT id, email_verified
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );
    const user = userResult.rows[0];

    // Security: do not disclose user existence for unknown emails.
    if (!user) {
      startCooldown(emailResendCooldown, `resend:ip:${requestIp}`, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);
      startCooldown(emailResendCooldown, `resend:email:${email}`, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);
      return res.json({
        ok: true,
        success: true,
        message: 'Если аккаунт с таким email существует, код отправлен.',
        resendAvailableIn: Math.ceil(EMAIL_VERIFICATION_RESEND_COOLDOWN_MS / 1000)
      });
    }

    if (user.email_verified === true) {
      return res.json({
        ok: true,
        success: true,
        emailVerified: true,
        message: 'Email уже подтвержден.'
      });
    }

    await createEmailVerificationCode({ userId: user.id, email });
    startCooldown(emailResendCooldown, `resend:ip:${requestIp}`, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);
    startCooldown(emailResendCooldown, `resend:email:${email}`, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);

    return res.json({
      ok: true,
      success: true,
      message: 'Код отправлен на email.',
      resendAvailableIn: Math.ceil(EMAIL_VERIFICATION_RESEND_COOLDOWN_MS / 1000)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/auth/sms/request', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const consentPersonalData = req.body?.consentPersonalData;
    const consentTerms = req.body?.consentTerms;
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ С‚РµР»РµС„РѕРЅ РІ С„РѕСЂРјР°С‚Рµ +7...' });
    }
    if (!isAcceptedConsent(consentPersonalData) || !isAcceptedConsent(consentTerms)) {
      return res.status(400).json({ ok: false, error: 'Р”Р»СЏ РІС…РѕРґР° РїРѕ SMS С‚СЂРµР±СѓРµС‚СЃСЏ СЃРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРµ СЃРѕРіР»Р°С€РµРЅРёРµ.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `INSERT INTO sms_codes (phone, code, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (phone)
       DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
      [phone, code, expiresAt]
    );

    const result = await sendSmsCode(phone, code);

    return res.json({
      ok: true,
      message: 'РљРѕРґ РѕС‚РїСЂР°РІР»РµРЅ',
      ...(result.devMode && process.env.NODE_ENV !== 'production' ? { devCode: code } : {})
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/auth/sms/verify', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();
    const name = String(req.body?.name || '').trim();

    if (!phone || !code) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ С‚РµР»РµС„РѕРЅ Рё РєРѕРґ.' });
    }

    const dbCode = await pool.query(
      `SELECT code, expires_at FROM sms_codes WHERE phone = $1 LIMIT 1`,
      [phone]
    );

    if (!dbCode.rows[0] || dbCode.rows[0].code !== code) {
      return res.status(401).json({ ok: false, error: 'РќРµРІРµСЂРЅС‹Р№ РєРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ.' });
    }

    if (new Date(dbCode.rows[0].expires_at).getTime() < Date.now()) {
      return res.status(401).json({ ok: false, error: 'РљРѕРґ РёСЃС‚РµРє, Р·Р°РїСЂРѕСЃРёС‚Рµ РЅРѕРІС‹Р№.' });
    }

    await pool.query(`DELETE FROM sms_codes WHERE phone = $1`, [phone]);

    const existing = await pool.query(`SELECT * FROM users WHERE phone = $1 LIMIT 1`, [phone]);
    let user = existing.rows[0];

    if (!user) {
      const inserted = await pool.query(
        `INSERT INTO users (id, name, phone, auth_provider)
         VALUES ($1, $2, $3, 'sms')
         RETURNING *`,
        [crypto.randomUUID(), name || 'РљР»РёРµРЅС‚', phone]
      );
      user = inserted.rows[0];
    }

    const token = signAuthToken(user);
    return res.json({
      ok: true,
      token,
      user: mapUserResponse(user)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.get('/api/telegram/link', authRequired, async (req, res) => {
  try {
    const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
      return res.status(503).json({ ok: false, error: 'Telegram bot is not configured.' });
    }

    const botUsername = await getTelegramBotUsername();
    if (!botUsername) {
      return res.status(503).json({ ok: false, error: 'Could not resolve Telegram bot username.' });
    }

    const userResult = await pool.query(
      `SELECT telegram_chat_id, telegram_username, telegram_connected_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.userId]
    );
    if (!userResult.rows[0]) {
      return res.status(404).json({ ok: false, error: 'User not found.' });
    }

    const activeTokenResult = await pool.query(
      `SELECT token, expires_at
       FROM telegram_link_tokens
       WHERE user_id = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.userId]
    );

    let bindToken = activeTokenResult.rows[0]?.token;
    let expiresAt = activeTokenResult.rows[0]?.expires_at;

    if (!bindToken) {
      bindToken = crypto.randomBytes(24).toString('hex');
      expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await pool.query(
        `INSERT INTO telegram_link_tokens (token, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [bindToken, req.user.userId, expiresAt]
      );
    }

    const startPayload = `${TELEGRAM_BIND_PREFIX}${bindToken}`;
    const deepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(startPayload)}`;

    return res.json({
      ok: true,
      botUsername,
      deepLink,
      expiresAt,
      connected: Boolean(userResult.rows[0].telegram_chat_id),
      telegramUsername: userResult.rows[0].telegram_username || null
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    if (expectedSecret) {
      const providedSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '').trim();
      if (providedSecret !== expectedSecret) {
        return res.status(401).json({ ok: false, error: 'Unauthorized webhook call.' });
      }
    }

    const callbackQuery = req.body?.callback_query;
    if (callbackQuery) {
      const callbackQueryId = String(callbackQuery.id || '').trim();
      const callbackData = String(callbackQuery.data || '').trim();
      const parsed = parseOrderStatusCallbackData(callbackData);
      if (!parsed) {
        await answerTelegramCallbackQuery(callbackQueryId);
        return res.json({ ok: true, ignored: true });
      }

      const adminIdSet = getTelegramAdminIdSet();
      const actorId = String(callbackQuery.from?.id || '').trim();
      if (!actorId || !adminIdSet.has(actorId)) {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: 'Нет прав для изменения статуса.',
          showAlert: true
        });
        return res.json({ ok: true, ignored: true, reason: 'forbidden' });
      }

      if (!MANAGER_UPDATABLE_STATUSES.includes(parsed.nextStatus)) {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: 'Недопустимый статус.',
          showAlert: true
        });
        return res.json({ ok: true, ignored: true, reason: 'invalid_status' });
      }

      const updatedOrder = await updateOrderStatus(parsed.orderId, parsed.nextStatus);
      if (!updatedOrder) {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: 'Заказ не найден.',
          showAlert: true
        });
        return res.json({ ok: true, ignored: true, reason: 'not_found' });
      }

      if (callbackQuery.message?.chat?.id && callbackQuery.message?.message_id) {
        try {
          await editTelegramMessageReplyMarkup(
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            buildOrderStatusInlineKeyboard(updatedOrder.id, parsed.nextStatus)
          );
        } catch (telegramEditError) {
          // eslint-disable-next-line no-console
          console.error('Telegram inline keyboard update failed:', telegramEditError);
        }
      }

      try {
        await notifyCustomerOrderStatus(updatedOrder.id, parsed.nextStatus, updatedOrder.updated_at);
      } catch (telegramError) {
        // eslint-disable-next-line no-console
        console.error('Telegram customer status notification failed:', telegramError);
      }

      const statusLabel = ORDER_STATUSES[parsed.nextStatus] || parsed.nextStatus;
      await answerTelegramCallbackQuery(callbackQueryId, {
        text: `Статус обновлен: ${statusLabel}`
      });
      return res.json({ ok: true });
    }

    const message = req.body?.message || req.body?.edited_message;
    if (!message) return res.json({ ok: true, ignored: true });

    const text = String(message.text || '').trim();
    const chatId = String(message.chat?.id || '').trim();
    const chatType = String(message.chat?.type || '').trim();
    const telegramUsername = String(message.from?.username || '').trim() || null;
    const match = text.match(/^\/start(?:@\w+)?\s+(.+)$/i);
    if (!match) {
      return res.json({ ok: true, ignored: true });
    }

    const payload = match[1].trim();
    if (!payload.startsWith(TELEGRAM_BIND_PREFIX)) {
      return res.json({ ok: true, ignored: true });
    }

    if (!chatId || chatType !== 'private') {
      return res.json({ ok: true, ignored: true });
    }

    const bindToken = payload.slice(TELEGRAM_BIND_PREFIX.length);
    if (!bindToken) {
      await sendTelegramMessage('Не удалось привязать аккаунт: некорректный токен.', { chatId, parseMode: undefined });
      return res.json({ ok: true });
    }

    const tokenResult = await pool.query(
      `SELECT token, user_id
       FROM telegram_link_tokens
       WHERE token = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [bindToken]
    );

    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      await sendTelegramMessage('Ссылка для привязки истекла. Сгенерируйте новую в личном кабинете.', { chatId, parseMode: undefined });
      return res.json({ ok: true });
    }

    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE users
         SET telegram_chat_id = $1,
             telegram_username = $2,
             telegram_connected_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [chatId, telegramUsername, tokenRow.user_id]
      );

      await pool.query(
        `UPDATE telegram_link_tokens
         SET used_at = NOW()
         WHERE token = $1`,
        [tokenRow.token]
      );
      await pool.query('COMMIT');
    } catch (dbError) {
      await pool.query('ROLLBACK');
      throw dbError;
    }

    await sendTelegramMessage('Готово! Telegram успешно привязан к вашему аккаунту на сайте.', {
      chatId,
      parseMode: undefined
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.patch('/api/auth/password', authRequired, async (req, res) => {
  try {
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: 'РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 6 СЃРёРјРІРѕР»РѕРІ.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ ok: false, error: 'РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await pool.query(
      `UPDATE users
       SET password_hash = $1, auth_provider = 'password', updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [passwordHash, req.user.userId]
    );

    if (!updated.rows[0]) {
      return res.status(404).json({ ok: false, error: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ.' });
    }

    return res.json({ ok: true, message: 'РџР°СЂРѕР»СЊ РѕР±РЅРѕРІР»РµРЅ.' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.get('/api/auth/oauth/:provider/start', (req, res) => {
  try {
    const { provider } = req.params;
    const state = crypto.randomUUID();

    if (provider === 'google') {
      const clientId = requireEnv('GOOGLE_CLIENT_ID');
      const redirectUri = getOAuthRedirectUri('google');
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      return res.json({ ok: true, url: authUrl.toString() });
    }

    if (provider === 'yandex') {
      const clientId = requireEnv('YANDEX_CLIENT_ID');
      const redirectUri = getOAuthRedirectUri('yandex');
      const authUrl = new URL('https://oauth.yandex.ru/authorize');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'login:email');
      authUrl.searchParams.set('state', state);
      return res.json({ ok: true, url: authUrl.toString() });
    }

    return res.status(400).json({ ok: false, error: 'РќРµРїРѕРґРґРµСЂР¶РёРІР°РµРјС‹Р№ OAuth РїСЂРѕРІР°Р№РґРµСЂ.' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.get('/api/auth/oauth/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params;
    const code = String(req.query.code || '');
    if (!code) {
      return res.status(400).send('Missing OAuth code');
    }

    let profile = null;

    if (provider === 'google') {
      const redirectUri = getOAuthRedirectUri('google');
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: requireEnv('GOOGLE_CLIENT_ID'),
          client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      const tokenData = await tokenResp.json();

      const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userResp.json();
      profile = {
        providerUserId: String(userData.id || ''),
        email: normalizeEmail(userData.email),
        name: String(userData.name || '')
      };
    } else if (provider === 'yandex') {
      const redirectUri = getOAuthRedirectUri('yandex');
      const tokenResp = await fetch('https://oauth.yandex.ru/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: requireEnv('YANDEX_CLIENT_ID'),
          client_secret: requireEnv('YANDEX_CLIENT_SECRET')
        })
      });
      const tokenData = await tokenResp.json();

      const userResp = await fetch('https://login.yandex.ru/info?format=json', {
        headers: { Authorization: `OAuth ${tokenData.access_token}` }
      });
      const userData = await userResp.json();
      profile = {
        providerUserId: String(userData.id || ''),
        email: normalizeEmail(userData.default_email),
        name: String(userData.real_name || userData.display_name || '')
      };
    } else {
      return res.status(400).send('Unsupported provider');
    }

    if (!profile?.providerUserId) {
      return res.status(400).send('OAuth profile is invalid');
    }

    const user = await upsertOAuthUser({ provider, ...profile });
    const token = signAuthToken(user);
    return res.redirect(`${PUBLIC_BASE_URL}/account?authToken=${encodeURIComponent(token)}`);
  } catch (error) {
    return res.status(500).send(error instanceof Error ? error.message : 'OAuth error');
  }
});

app.get('/api/orders/my', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, status, payment_status, total, subtotal, delivery_amount, promo_code, promo_discount_percent, promo_discount_amount, total_before_discount, total_after_discount, delivery_address, created_at, updated_at,
              receipt_path, items_json, payer_name, recipient_mode, recipient_name,
              gift_wrap, ribbon, gift_wrap_type, gift_wrap_color, ribbon_color, postcard_text
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    return res.json({
      ok: true,
      orders: result.rows.map((order) => ({
        ...order,
        status_label: ORDER_STATUSES[order.status] || order.status
      }))
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/promo-codes/validate', authOptional, async (req, res) => {
  try {
    const code = normalizePromoCode(req.body?.code);
    const subtotal = normalizeMoney(req.body?.subtotal);
    const validation = await validatePromoCodeForOrder({
      code,
      subtotal,
      userId: req.user?.userId || null
    });

    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        valid: false,
        code,
        discountPercent: 0,
        discountAmount: 0,
        subtotal,
        message: validation.reason || 'Промокод недействителен.'
      });
    }

    return res.json({
      ok: true,
      valid: true,
      code: validation.code,
      discountPercent: validation.discountPercent,
      discountAmount: validation.discountAmount,
      subtotal: validation.subtotal,
      message: 'Промокод применён.'
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.get('/api/admin/promo-codes', requireAdminToken, async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM promo_codes ORDER BY created_at DESC`);
    return res.json({ ok: true, promoCodes: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/admin/promo-codes', requireAdminToken, async (req, res) => {
  try {
    const code = normalizePromoCode(req.body?.code);
    const discountPercent = Number(req.body?.discountPercent);
    const isActive = req.body?.isActive !== false;
    const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body?.endsAt ? new Date(req.body.endsAt) : null;
    const maxUsesTotal = req.body?.maxUsesTotal === null || req.body?.maxUsesTotal === undefined ? null : Number(req.body.maxUsesTotal);
    const maxUsesPerUser = req.body?.maxUsesPerUser === null || req.body?.maxUsesPerUser === undefined ? null : Number(req.body.maxUsesPerUser);
    const minOrderAmount = normalizeMoney(req.body?.minOrderAmount || 0);

    if (!PROMO_CODE_PATTERN.test(code)) {
      return res.status(400).json({ ok: false, error: 'Некорректный код промокода.' });
    }
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      return res.status(400).json({ ok: false, error: 'discountPercent должен быть в диапазоне 0..100.' });
    }
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ ok: false, error: 'Некорректная дата startsAt.' });
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return res.status(400).json({ ok: false, error: 'Некорректная дата endsAt.' });
    }
    if (maxUsesTotal !== null && (!Number.isFinite(maxUsesTotal) || maxUsesTotal < 1)) {
      return res.status(400).json({ ok: false, error: 'maxUsesTotal должен быть >= 1.' });
    }
    if (maxUsesPerUser !== null && (!Number.isFinite(maxUsesPerUser) || maxUsesPerUser < 1)) {
      return res.status(400).json({ ok: false, error: 'maxUsesPerUser должен быть >= 1.' });
    }

    const created = await pool.query(
      `INSERT INTO promo_codes (
        id, code, discount_percent, is_active, starts_at, ends_at, max_uses_total, max_uses_per_user, min_order_amount, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      RETURNING *`,
      [
        crypto.randomUUID(),
        code,
        Number(discountPercent.toFixed(2)),
        isActive,
        startsAt ? startsAt.toISOString() : null,
        endsAt ? endsAt.toISOString() : null,
        maxUsesTotal !== null ? Math.floor(maxUsesTotal) : null,
        maxUsesPerUser !== null ? Math.floor(maxUsesPerUser) : null,
        toRubAmount(minOrderAmount)
      ]
    );

    return res.json({ ok: true, promoCode: created.rows[0] });
  } catch (error) {
    if (String(error?.message || '').includes('promo_codes_code_key')) {
      return res.status(409).json({ ok: false, error: 'Промокод с таким кодом уже существует.' });
    }
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.patch('/api/admin/promo-codes/:promoCodeId', requireAdminToken, async (req, res) => {
  try {
    const promoCodeId = String(req.params.promoCodeId || '').trim();
    const updates = [];
    const values = [];
    let index = 1;

    if (req.body?.code !== undefined) {
      const code = normalizePromoCode(req.body?.code);
      if (!PROMO_CODE_PATTERN.test(code)) {
        return res.status(400).json({ ok: false, error: 'Некорректный код промокода.' });
      }
      updates.push(`code = $${index++}`);
      values.push(code);
    }
    if (req.body?.discountPercent !== undefined) {
      const discountPercent = Number(req.body.discountPercent);
      if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
        return res.status(400).json({ ok: false, error: 'discountPercent должен быть в диапазоне 0..100.' });
      }
      updates.push(`discount_percent = $${index++}`);
      values.push(Number(discountPercent.toFixed(2)));
    }
    if (req.body?.isActive !== undefined) {
      updates.push(`is_active = $${index++}`);
      values.push(Boolean(req.body.isActive));
    }
    if (req.body?.startsAt !== undefined) {
      const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
      if (startsAt && Number.isNaN(startsAt.getTime())) {
        return res.status(400).json({ ok: false, error: 'Некорректная дата startsAt.' });
      }
      updates.push(`starts_at = $${index++}`);
      values.push(startsAt ? startsAt.toISOString() : null);
    }
    if (req.body?.endsAt !== undefined) {
      const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
      if (endsAt && Number.isNaN(endsAt.getTime())) {
        return res.status(400).json({ ok: false, error: 'Некорректная дата endsAt.' });
      }
      updates.push(`ends_at = $${index++}`);
      values.push(endsAt ? endsAt.toISOString() : null);
    }
    if (req.body?.maxUsesTotal !== undefined) {
      const maxUsesTotal = req.body.maxUsesTotal === null ? null : Number(req.body.maxUsesTotal);
      if (maxUsesTotal !== null && (!Number.isFinite(maxUsesTotal) || maxUsesTotal < 1)) {
        return res.status(400).json({ ok: false, error: 'maxUsesTotal должен быть >= 1.' });
      }
      updates.push(`max_uses_total = $${index++}`);
      values.push(maxUsesTotal !== null ? Math.floor(maxUsesTotal) : null);
    }
    if (req.body?.maxUsesPerUser !== undefined) {
      const maxUsesPerUser = req.body.maxUsesPerUser === null ? null : Number(req.body.maxUsesPerUser);
      if (maxUsesPerUser !== null && (!Number.isFinite(maxUsesPerUser) || maxUsesPerUser < 1)) {
        return res.status(400).json({ ok: false, error: 'maxUsesPerUser должен быть >= 1.' });
      }
      updates.push(`max_uses_per_user = $${index++}`);
      values.push(maxUsesPerUser !== null ? Math.floor(maxUsesPerUser) : null);
    }
    if (req.body?.minOrderAmount !== undefined) {
      updates.push(`min_order_amount = $${index++}`);
      values.push(toRubAmount(normalizeMoney(req.body.minOrderAmount)));
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'Нет полей для обновления.' });
    }

    updates.push('updated_at = NOW()');
    values.push(promoCodeId);

    const updated = await pool.query(
      `UPDATE promo_codes
       SET ${updates.join(', ')}
       WHERE id = $${index}
       RETURNING *`,
      values
    );

    if (!updated.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Промокод не найден.' });
    }

    return res.json({ ok: true, promoCode: updated.rows[0] });
  } catch (error) {
    if (String(error?.message || '').includes('promo_codes_code_key')) {
      return res.status(409).json({ ok: false, error: 'Промокод с таким кодом уже существует.' });
    }
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.delete('/api/admin/promo-codes/:promoCodeId', requireAdminToken, async (req, res) => {
  try {
    const promoCodeId = String(req.params.promoCodeId || '').trim();
    if (!promoCodeId) {
      return res.status(400).json({ ok: false, error: 'promoCodeId is required.' });
    }

    const deleted = await pool.query(
      `DELETE FROM promo_codes
       WHERE id = $1
       RETURNING *`,
      [promoCodeId]
    );

    if (!deleted.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Промокод не найден.' });
    }

    return res.json({ ok: true, promoCode: deleted.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.patch('/api/orders/:orderId/status', async (req, res) => {
  try {
    const apiToken = process.env.ADMIN_API_TOKEN?.trim();
    if (!apiToken || req.headers['x-admin-token'] !== apiToken) {
      return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    }

    const { orderId } = req.params;
    const nextStatus = String(req.body?.status || '');

    if (!ORDER_STATUSES[nextStatus]) {
      return res.status(400).json({ ok: false, error: 'РќРµРґРѕРїСѓСЃС‚РёРјС‹Р№ СЃС‚Р°С‚СѓСЃ.' });
    }

    const updated = { rows: [await updateOrderStatus(orderId, nextStatus)] };

    if (!updated.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.' });
    }

    try {
      await notifyCustomerOrderStatus(updated.rows[0].id, nextStatus, updated.rows[0].updated_at);
    } catch (telegramError) {
      // eslint-disable-next-line no-console
      console.error('Telegram customer status notification failed:', telegramError);
    }

    return res.json({ ok: true, order: updated.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      message,
      consentPersonalData,
      consentTerms
    } = req.body ?? {};

    const normalizedName = decodeMojibakeIfNeeded(name);
    const normalizedPhone = decodeMojibakeIfNeeded(phone);
    const normalizedEmail = decodeMojibakeIfNeeded(email);
    const normalizedMessage = decodeMojibakeIfNeeded(message);

    if (!normalizedName || (!normalizedPhone && !normalizedEmail) || !normalizedMessage) {
      return res.status(400).json({ ok: false, error: 'Р—Р°РїРѕР»РЅРёС‚Рµ РёРјСЏ, СЃРѕРѕР±С‰РµРЅРёРµ Рё С‚РµР»РµС„РѕРЅ РёР»Рё email.' });
    }

    if (!isAcceptedConsent(consentPersonalData) || !isAcceptedConsent(consentTerms)) {
      return res.status(400).json({ ok: false, error: 'РўСЂРµР±СѓРµС‚СЃСЏ СЃРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРµ СЃРѕРіР»Р°С€РµРЅРёРµ.' });
    }

    const bitrixBase = normalizeBitrixWebhookBase(requireEnv('BITRIX24_WEBHOOK_URL'));
    const bitrixUrl = `${bitrixBase}/crm.lead.add.json`;

    const leadPayload = {
      fields: {
        TITLE: `Lead from MossyBloom website: ${normalizedName}`,
        NAME: normalizedName,
        PHONE: normalizedPhone ? [{ VALUE: normalizedPhone, VALUE_TYPE: 'WORK' }] : [],
        EMAIL: normalizedEmail ? [{ VALUE: normalizedEmail, VALUE_TYPE: 'WORK' }] : [],
        COMMENTS: normalizedMessage,
        SOURCE_ID: 'WEB'
      },
      params: { REGISTER_SONET_EVENT: 'Y' }
    };

    const bitrixResponse = await fetch(bitrixUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(leadPayload)
    });

    const bitrixData = await bitrixResponse.json().catch(() => ({}));
    if (!bitrixResponse.ok || bitrixData.error) {
      return res.status(502).json({ ok: false, error: 'Bitrix24 РІРµСЂРЅСѓР» РѕС€РёР±РєСѓ', details: bitrixData });
    }

    return res.json({ ok: true, leadId: bitrixData.result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/dadata/address-suggestions', async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (query.length < 3) {
      return res.status(400).json({ ok: false, error: 'Р’РІРµРґРёС‚Рµ РЅРµ РјРµРЅРµРµ 3 СЃРёРјРІРѕР»РѕРІ РґР»СЏ РїРѕРёСЃРєР° Р°РґСЂРµСЃР°.' });
    }
    if (query.length > 200) {
      return res.status(400).json({ ok: false, error: 'РЎР»РёС€РєРѕРј РґР»РёРЅРЅС‹Р№ РїРѕРёСЃРєРѕРІС‹Р№ Р·Р°РїСЂРѕСЃ.' });
    }

    const token = process.env.DADATA_API_KEY?.trim();
    if (!token) {
      return res.status(503).json({ ok: false, error: 'РџРѕРґСЃРєР°Р·РєРё Р°РґСЂРµСЃР° РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРЅС‹.' });
    }

    const dadataResponse = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        query,
        count: 7,
        locations: [{ country: 'Россия' }]
      })
    });

    const dadataData = await dadataResponse.json().catch(() => ({}));
    if (!dadataResponse.ok) {
      return res.status(502).json({ ok: false, error: 'DaData РІРµСЂРЅСѓР» РѕС€РёР±РєСѓ.', details: dadataData });
    }

    const suggestions = Array.isArray(dadataData?.suggestions)
      ? dadataData.suggestions.map((item) => ({
          value: typeof item?.value === 'string' ? item.value : '',
          unrestricted_value: typeof item?.unrestricted_value === 'string' ? item.unrestricted_value : '',
          data: item?.data && typeof item.data === 'object' ? item.data : {}
        }))
      : [];

    return res.json({ ok: true, suggestions });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/dadata/delivery-calculation', async (req, res) => {
  try {
    const address = String(req.body?.address || '').trim();
    if (address.length < 3) {
      return res.status(400).json({ ok: false, error: 'Введите минимум 3 символа адреса.' });
    }
    if (address.length > 300) {
      return res.status(400).json({ ok: false, error: 'Слишком длинный адрес.' });
    }

    const token = process.env.DADATA_API_KEY?.trim();
    if (!token) {
      return res.status(503).json({ ok: false, error: 'Расчет доставки временно недоступен.' });
    }

    const dadataResponse = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        query: address,
        count: 1,
        locations: [{ country: 'Россия' }]
      })
    });

    const dadataData = await dadataResponse.json().catch(() => ({}));
    if (!dadataResponse.ok) {
      return res.status(502).json({ ok: false, error: 'DaData вернул ошибку.', details: dadataData });
    }

    const firstAddress =
      Array.isArray(dadataData?.suggestions) && dadataData.suggestions.length > 0
        ? dadataData.suggestions[0]?.data
        : null;
    const delivery =
      buildDeliveryCalculationResult(firstAddress?.beltway_hit, firstAddress?.beltway_distance) ||
      buildDeliveryCalculationFromGeo(firstAddress?.geo_lat, firstAddress?.geo_lon);
    if (!delivery) {
      return res.status(422).json({
        ok: false,
        error: 'Не удалось определить расстояние от МКАД для выбранного адреса.'
      });
    }

    return res.json({ ok: true, ...delivery });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/orders/create-cash', authOptional, async (req, res) => {
  try {
    const {
      payer,
      recipient,
      recipientMode,
      items,
      total,
      deliveryAmount,
      promoCode,
      deliveryAddress,
      orderComment,
      consents,
      extras
    } = req.body ?? {};
    const normalizedExtras = normalizeOrderExtrasInput(extras);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'РљРѕСЂР·РёРЅР° РїСѓСЃС‚Р°.' });
    }

    if (!deliveryAddress || !String(deliveryAddress).trim()) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ Р°РґСЂРµСЃ РґРѕСЃС‚Р°РІРєРё.' });
    }

    if (!payer?.name || !payer?.phone) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ РґР°РЅРЅС‹Рµ РїР»Р°С‚РµР»СЊС‰РёРєР°.' });
    }

    if (recipientMode === 'other' && (!recipient?.name || !recipient?.phone)) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ РґР°РЅРЅС‹Рµ РїРѕР»СѓС‡Р°С‚РµР»СЏ.' });
    }

    if (!isAcceptedConsent(consents?.offerAccepted) || !isAcceptedConsent(consents?.personalDataAccepted)) {
      return res.status(400).json({ ok: false, error: 'Р”Р»СЏ РѕС„РѕСЂРјР»РµРЅРёСЏ Р·Р°РєР°Р·Р° РЅРµРѕР±С…РѕРґРёРјРѕ РїРѕРґС‚РІРµСЂРґРёС‚СЊ РѕС„РµСЂС‚Сѓ Рё СЃРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С….' });
    }

    if (normalizedExtras.postcardText.length > 500) {
      return res.status(400).json({ ok: false, error: 'РўРµРєСЃС‚ РѕС‚РєСЂС‹С‚РєРё РЅРµ РґРѕР»Р¶РµРЅ РїСЂРµРІС‹С€Р°С‚СЊ 500 СЃРёРјРІРѕР»РѕРІ.' });
    }

    const safeItems = sanitizeOrderItems(items);
    if (safeItems.length === 0) {
      return res.status(400).json({ ok: false, error: 'Корзина пуста.' });
    }

    const subtotal = calculateSubtotal(safeItems);
    const normalizedDeliveryAmount = normalizeMoney(deliveryAmount);
    const totalBeforeDiscount = normalizeMoney(subtotal + normalizedDeliveryAmount);
    const requestedTotal = normalizeMoney(total);

    let promo = {
      valid: false,
      code: null,
      discountPercent: 0,
      discountAmount: 0,
      promoId: null
    };

    const normalizedPromoCode = normalizePromoCode(promoCode);
    if (normalizedPromoCode) {
      const promoValidation = await validatePromoCodeForOrder({
        code: normalizedPromoCode,
        subtotal,
        userId: req.user?.userId || null
      });
      if (!promoValidation.valid) {
        return res.status(400).json({ ok: false, error: promoValidation.reason || 'Промокод недействителен.' });
      }
      promo = {
        valid: true,
        code: promoValidation.code,
        discountPercent: promoValidation.discountPercent,
        discountAmount: promoValidation.discountAmount,
        promoId: promoValidation.promo.id
      };
    }

    const totalAfterDiscount = normalizeMoney(totalBeforeDiscount - promo.discountAmount);
    if (totalAfterDiscount <= 0) {
      return res.status(400).json({ ok: false, error: 'Некорректная итоговая сумма заказа.' });
    }

    if (requestedTotal > 0 && Math.abs(requestedTotal - totalAfterDiscount) > 1) {
      // eslint-disable-next-line no-console
      console.warn('Client total mismatch, using server total', {
        requestedTotal,
        totalAfterDiscount
      });
    }

    const orderId = `SF-${Date.now()}`;
    const firstImage = safeItems.find((item) => item.image)?.image || null;
    const client = await pool.connect();
    let createdOrder = null;
    try {
      await client.query('BEGIN');
      const insertedOrder = await client.query(
        `INSERT INTO orders (
          id, user_id, status, payment_status,
          payer_name, payer_phone, payer_email,
          recipient_mode, recipient_name, recipient_phone, recipient_email,
          delivery_address, gift_wrap, ribbon, gift_wrap_type, gift_wrap_color, ribbon_color, postcard_text, comment, items_json, total, first_image,
          promo_code, promo_discount_percent, promo_discount_amount, subtotal, delivery_amount, total_before_discount, total_after_discount
        ) VALUES (
          $1, $2, 'received', 'pending',
          $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20,
          $21, $22, $23, $24, $25, $26, $27
        )
        RETURNING *`,
        [
          orderId,
          req.user?.userId || null,
          String(payer.name).trim(),
          normalizePhone(payer.phone),
          normalizeEmail(payer.email),
          recipientMode === 'other' ? 'other' : 'self',
          recipientMode === 'other' ? String(recipient.name || '').trim() : null,
          recipientMode === 'other' ? normalizePhone(recipient.phone) : null,
          recipientMode === 'other' ? normalizeEmail(recipient.email) : null,
          String(deliveryAddress).trim(),
          normalizedExtras.giftWrap,
          normalizedExtras.ribbon,
          normalizedExtras.giftWrapType,
          normalizedExtras.giftWrapColor,
          normalizedExtras.ribbonColor,
          normalizedExtras.postcardText || null,
          String(orderComment || '').trim(),
          JSON.stringify(safeItems),
          toRubAmount(totalAfterDiscount),
          firstImage,
          promo.code,
          promo.discountPercent,
          toRubAmount(promo.discountAmount),
          toRubAmount(subtotal),
          toRubAmount(normalizedDeliveryAmount),
          toRubAmount(totalBeforeDiscount),
          toRubAmount(totalAfterDiscount)
        ]
      );
      createdOrder = insertedOrder.rows[0];

      if (promo.valid && promo.promoId) {
        await client.query(
          `INSERT INTO promo_code_usages (id, promo_code_id, order_id, user_id, used_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [crypto.randomUUID(), promo.promoId, orderId, req.user?.userId || null]
        );
        await client.query(
          `UPDATE promo_codes
           SET uses_total = uses_total + 1, updated_at = NOW()
           WHERE id = $1`,
          [promo.promoId]
        );
      }
      await client.query('COMMIT');
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

    if (createdOrder) {
      let receiptPath = null;
      try {
        receiptPath = await createReceiptPdf(createdOrder);
        await pool.query(`UPDATE orders SET receipt_path = $1, updated_at = NOW() WHERE id = $2`, [receiptPath, createdOrder.id]);
      } catch (receiptError) {
        // eslint-disable-next-line no-console
        console.error('Receipt generation failed for cash order:', receiptError);
      }

      try {
        // eslint-disable-next-line no-console
        console.info('Attempting order confirmation email (cash)', {
          orderId: createdOrder.id,
          payerEmail: createdOrder.payer_email || null
        });
        await sendOrderConfirmationEmail(createdOrder, { paid: false, receiptPath });
      } catch (emailError) {
        // eslint-disable-next-line no-console
        console.error('Order confirmation email failed (cash):', emailError);
      }

      const message = buildTelegramOrderMessage(createdOrder, { paid: false });
      try {
        await sendOrderTelegramNotification(createdOrder, message);
        if (receiptPath) {
          const receiptFilePath = path.join(RECEIPTS_DIR, path.basename(receiptPath));
          await sendTelegramDocument(receiptFilePath, `<b>PDF-чек (наличные)</b> по заказу ${escapeHtml(createdOrder.id)}`);
        }
      } catch (telegramError) {
        // eslint-disable-next-line no-console
        console.error('Telegram notification failed for cash order:', telegramError);
      }
    }

    return res.json({
      ok: true,
      orderId,
      subtotal,
      delivery: normalizedDeliveryAmount,
      discountAmount: promo.discountAmount,
      discountPercent: promo.discountPercent,
      grandTotal: totalAfterDiscount,
      promoApplied: promo.valid,
      promoCode: promo.code
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.post('/api/payments/tochka/create', authOptional, async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const description = String(req.body?.description || '').trim();
    const orderId = String(req.body?.orderId || '').trim();
    const redirectUrl = typeof req.body?.redirectUrl === 'string' ? req.body.redirectUrl.trim() : '';
    const failRedirectUrl = typeof req.body?.failRedirectUrl === 'string' ? req.body.failRedirectUrl.trim() : '';
    const paymentMode = Array.isArray(req.body?.paymentMode) ? req.body.paymentMode : undefined;
    const ttl = req.body?.ttl;
    const merchantId = typeof req.body?.merchantId === 'string' ? req.body.merchantId.trim() : undefined;

    if (!orderId || !description || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'amount, description и orderId обязательны.'
      });
    }

    const orderCheck = await pool.query(`SELECT id FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
    if (!orderCheck.rows[0]) {
      return res.status(404).json({ success: false, error: 'Заказ не найден.' });
    }

    const existing = await tochkaPaymentRepository.getPaymentByOrderId(orderId);
    if (existing?.operationId && existing?.paymentLink) {
      return res.json({
        success: true,
        operationId: existing.operationId,
        paymentLink: existing.paymentLink,
        status: existing.status || 'CREATED'
      });
    }

    const operation = await createPaymentLink({
      amount,
      purpose: description,
      paymentMode,
      paymentLinkId: orderId,
      redirectUrl: redirectUrl || `${PUBLIC_BASE_URL}/checkout?payment=success&orderId=${encodeURIComponent(orderId)}`,
      failRedirectUrl: failRedirectUrl || `${PUBLIC_BASE_URL}/checkout?payment=failed&orderId=${encodeURIComponent(orderId)}`,
      ttl,
      merchantId
    });

    await tochkaPaymentRepository.createPaymentRecord({
      orderId,
      operationId: operation.operationId,
      paymentLink: operation.paymentLink,
      amount,
      status: getTochkaPayloadStatus(operation.raw),
      rawPayload: operation.raw
    });

    await pool.query(
      `UPDATE orders
       SET payment_status = $1,
           status = $2,
           payment_provider = 'tochka',
           updated_at = NOW()
       WHERE id = $3`,
      [mapToInternalPaymentStatus(getTochkaPayloadStatus(operation.raw)), mapToInternalOrderStatus(getTochkaPayloadStatus(operation.raw)), orderId]
    );

    return res.json({
      success: true,
      operationId: operation.operationId,
      paymentLink: operation.paymentLink,
      status: getTochkaPayloadStatus(operation.raw) || 'CREATED'
    });
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
      ...(error instanceof TochkaApiError ? { details: error.details } : {})
    });
  }
});

async function handleTochkaStatusRequest(req, res) {
  try {
    const operationId = String(req.params.operationId || '').trim();
    if (!operationId) {
      return res.status(400).json({ success: false, error: 'operationId is required.' });
    }

    const operation = await getPaymentStatus(operationId);
    const status = operation.status || 'UNKNOWN';
    const internalPaymentStatus = mapToInternalPaymentStatus(status);
    const internalOrderStatus = mapToInternalOrderStatus(status);
    const isPaid = internalPaymentStatus === 'paid';

    const current = await tochkaPaymentRepository.getPaymentByOperationId(operationId);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Платеж не найден по operationId.' });
    }

    await tochkaPaymentRepository.updatePaymentStatus({
      operationId,
      status,
      rawPayload: operation.raw
    });

    const updated = await pool.query(
      `UPDATE orders
       SET payment_status = $1,
           status = $2,
           payment_provider = COALESCE(payment_provider, 'tochka'),
           paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
           updated_at = NOW()
       WHERE tochka_operation_id = $3
       RETURNING id, payment_status, status`,
      [internalPaymentStatus, internalOrderStatus, operationId]
    );

    if (isPaid && updated.rows[0]) {
      const hasReceipt = await pool.query(
        `SELECT receipt_path FROM orders WHERE id = $1 LIMIT 1`,
        [updated.rows[0].id]
      );
      if (!hasReceipt.rows[0]?.receipt_path) {
        try {
          await markOrderAsPaidAndNotify(updated.rows[0].id);
        } catch (notifyError) {
          // eslint-disable-next-line no-console
          console.error('Tochka paid status post-processing failed:', notifyError);
        }
      }
    }

    return res.json({
      success: true,
      operationId,
      status
    });
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
      ...(error instanceof TochkaApiError ? { details: error.details } : {})
    });
  }
}

app.get('/api/payments/tochka/status/:operationId', authOptional, handleTochkaStatusRequest);
app.get('/api/payments/tochka/:operationId/status', authOptional, handleTochkaStatusRequest);

app.post('/api/payments/tochka/webhook', async (req, res) => {
  try {
    const token = getTochkaWebhookToken(req);
    let payload = null;
    if (token) {
      // TODO: enforce strict signature verification according to Tochka webhook docs in production.
      payload = process.env.TOCHKA_WEBHOOK_PUBLIC_KEY ? verifyWebhookJwt(token) : decodeWebhookJwtUnsafe(token);
    } else if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      payload = req.body;
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload.' });
    }

    const webhookType = String(payload.webhookType || '').trim();
    if (webhookType && webhookType !== 'acquiringInternetPayment') {
      return res.status(200).json({ success: true, ignored: true, reason: webhookType });
    }

    const operationId = getTochkaOperationId(payload);
    if (!operationId) {
      return res.status(400).json({ success: false, error: 'operationId is required in webhook payload.' });
    }

    const rawStatus = getTochkaPayloadStatus(payload) || 'UNKNOWN';
    const paymentStatus = mapToInternalPaymentStatus(rawStatus);
    const orderStatus = mapToInternalOrderStatus(rawStatus);

    const current = await tochkaPaymentRepository.getPaymentByOperationId(operationId);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Order not found for Tochka operationId.' });
    }

    await tochkaPaymentRepository.updatePaymentStatus({
      operationId,
      status: rawStatus,
      rawPayload: payload
    });

    const updated = await pool.query(
      `UPDATE orders
       SET payment_provider = COALESCE(payment_provider, 'tochka'),
           payment_status = $1,
           status = $2,
           paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
           updated_at = NOW()
       WHERE tochka_operation_id = $3
       RETURNING *`,
      [paymentStatus, orderStatus, operationId]
    );

    const order = updated.rows[0];
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found for Tochka operationId.' });
    }

    if (paymentStatus === 'paid' && !order.receipt_path) {
      try {
        await markOrderAsPaidAndNotify(order.id);
      } catch (notifyError) {
        // eslint-disable-next-line no-console
        console.error('Tochka webhook post-processing failed:', notifyError);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
      ...(error instanceof TochkaApiError ? { details: error.details } : {})
    });
  }
});

app.post('/api/payments/create', authOptional, async (req, res) => {
  try {
    const {
      payer,
      recipient,
      recipientMode,
      items,
      total,
      deliveryAmount,
      promoCode,
      deliveryAddress,
      orderComment,
      consents,
      extras
    } = req.body ?? {};
    const normalizedExtras = normalizeOrderExtrasInput(extras);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'РљРѕСЂР·РёРЅР° РїСѓСЃС‚Р°.' });
    }

    if (!deliveryAddress || !String(deliveryAddress).trim()) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ Р°РґСЂРµСЃ РґРѕСЃС‚Р°РІРєРё.' });
    }

    if (!payer?.name || !payer?.phone) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ РґР°РЅРЅС‹Рµ РїР»Р°С‚РµР»СЊС‰РёРєР°.' });
    }

    if (recipientMode === 'other' && (!recipient?.name || !recipient?.phone)) {
      return res.status(400).json({ ok: false, error: 'РЈРєР°Р¶РёС‚Рµ РґР°РЅРЅС‹Рµ РїРѕР»СѓС‡Р°С‚РµР»СЏ.' });
    }

    if (!isAcceptedConsent(consents?.offerAccepted) || !isAcceptedConsent(consents?.personalDataAccepted)) {
      return res.status(400).json({ ok: false, error: 'Р”Р»СЏ РѕС„РѕСЂРјР»РµРЅРёСЏ Р·Р°РєР°Р·Р° РЅРµРѕР±С…РѕРґРёРјРѕ РїРѕРґС‚РІРµСЂРґРёС‚СЊ РѕС„РµСЂС‚Сѓ Рё СЃРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С….' });
    }

    if (normalizedExtras.postcardText.length > 500) {
      return res.status(400).json({ ok: false, error: 'РўРµРєСЃС‚ РѕС‚РєСЂС‹С‚РєРё РЅРµ РґРѕР»Р¶РµРЅ РїСЂРµРІС‹С€Р°С‚СЊ 500 СЃРёРјРІРѕР»РѕРІ.' });
    }

    const safeItems = sanitizeOrderItems(items);
    if (safeItems.length === 0) {
      return res.status(400).json({ ok: false, error: 'Корзина пуста.' });
    }

    const subtotal = calculateSubtotal(safeItems);
    const normalizedDeliveryAmount = normalizeMoney(deliveryAmount);
    const totalBeforeDiscount = normalizeMoney(subtotal + normalizedDeliveryAmount);
    const requestedTotal = normalizeMoney(total);

    let promo = {
      valid: false,
      code: null,
      discountPercent: 0,
      discountAmount: 0,
      promoId: null
    };

    const normalizedPromoCode = normalizePromoCode(promoCode);
    if (normalizedPromoCode) {
      const promoValidation = await validatePromoCodeForOrder({
        code: normalizedPromoCode,
        subtotal,
        userId: req.user?.userId || null
      });
      if (!promoValidation.valid) {
        return res.status(400).json({ ok: false, error: promoValidation.reason || 'Промокод недействителен.' });
      }
      promo = {
        valid: true,
        code: promoValidation.code,
        discountPercent: promoValidation.discountPercent,
        discountAmount: promoValidation.discountAmount,
        promoId: promoValidation.promo.id
      };
    }

    const totalAfterDiscount = normalizeMoney(totalBeforeDiscount - promo.discountAmount);
    if (totalAfterDiscount <= 0) {
      return res.status(400).json({ ok: false, error: 'Некорректная итоговая сумма заказа.' });
    }
    if (requestedTotal > 0 && Math.abs(requestedTotal - totalAfterDiscount) > 1) {
      // eslint-disable-next-line no-console
      console.warn('Client total mismatch, using server total', {
        requestedTotal,
        totalAfterDiscount
      });
    }

    const orderId = `SF-${Date.now()}`;
    const firstImage = safeItems.find((item) => item.image)?.image || null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO orders (
          id, user_id, status, payment_status,
          payer_name, payer_phone, payer_email,
          recipient_mode, recipient_name, recipient_phone, recipient_email,
          delivery_address, gift_wrap, ribbon, gift_wrap_type, gift_wrap_color, ribbon_color, postcard_text, comment, items_json, total, first_image,
          promo_code, promo_discount_percent, promo_discount_amount, subtotal, delivery_amount, total_before_discount, total_after_discount
        ) VALUES (
          $1, $2, 'received', 'pending',
          $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20,
          $21, $22, $23, $24, $25, $26, $27
        )`,
        [
          orderId,
          req.user?.userId || null,
          String(payer.name).trim(),
          normalizePhone(payer.phone),
          normalizeEmail(payer.email),
          recipientMode === 'other' ? 'other' : 'self',
          recipientMode === 'other' ? String(recipient.name || '').trim() : null,
          recipientMode === 'other' ? normalizePhone(recipient.phone) : null,
          recipientMode === 'other' ? normalizeEmail(recipient.email) : null,
          String(deliveryAddress).trim(),
          normalizedExtras.giftWrap,
          normalizedExtras.ribbon,
          normalizedExtras.giftWrapType,
          normalizedExtras.giftWrapColor,
          normalizedExtras.ribbonColor,
          normalizedExtras.postcardText || null,
          String(orderComment || '').trim(),
          JSON.stringify(safeItems),
          toRubAmount(totalAfterDiscount),
          firstImage,
          promo.code,
          promo.discountPercent,
          toRubAmount(promo.discountAmount),
          toRubAmount(subtotal),
          toRubAmount(normalizedDeliveryAmount),
          toRubAmount(totalBeforeDiscount),
          toRubAmount(totalAfterDiscount)
        ]
      );
      if (promo.valid && promo.promoId) {
        await client.query(
          `INSERT INTO promo_code_usages (id, promo_code_id, order_id, user_id, used_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [crypto.randomUUID(), promo.promoId, orderId, req.user?.userId || null]
        );
        await client.query(
          `UPDATE promo_codes
           SET uses_total = uses_total + 1, updated_at = NOW()
           WHERE id = $1`,
          [promo.promoId]
        );
      }
      await client.query('COMMIT');
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

    const operation = await createTochkaPaymentForExistingOrder({
      orderId,
      amount: Number(toRubAmount(totalAfterDiscount)),
      description: `Оплата заказа ${orderId} (MossyBloom)`
    });

    return res.json({
      ok: true,
      orderId,
      subtotal,
      delivery: normalizedDeliveryAmount,
      discountAmount: promo.discountAmount,
      discountPercent: promo.discountPercent,
      grandTotal: totalAfterDiscount,
      promoApplied: promo.valid,
      promoCode: promo.code,
      paymentId: operation.operationId,
      operationId: operation.operationId,
      confirmationUrl: operation.paymentLink,
      paymentLink: operation.paymentLink
    });
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    return res.status(statusCode).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Internal error',
      ...(error instanceof TochkaApiError ? { details: error.details } : {})
    });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  try {
    const event = req.body?.event;
    const paymentObject = req.body?.object ?? {};
    if (event !== 'payment.succeeded') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const orderId = paymentObject?.metadata?.order_id;
    if (!orderId) {
      return res.status(400).json({ ok: false, error: 'Missing order id in metadata.' });
    }

    const updatedOrder = await pool.query(
      `UPDATE orders
       SET payment_status = 'paid', status = 'paid', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );

    const order = updatedOrder.rows[0];
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const receiptPath = await createReceiptPdf(order);
    await pool.query(`UPDATE orders SET receipt_path = $1, updated_at = NOW() WHERE id = $2`, [receiptPath, orderId]);

    try {
      await sendOrderConfirmationEmail(order, { paid: true, receiptPath });
    } catch (emailError) {
      // eslint-disable-next-line no-console
      console.error('Order confirmation email failed (legacy webhook):', emailError);
    }

    const message = buildTelegramOrderMessage(order, { paid: true });
    await sendOrderTelegramNotification(order, message);
    const receiptFilePath = path.join(RECEIPTS_DIR, path.basename(receiptPath));
    await sendTelegramDocument(receiptFilePath, `<b>PDF-С‡РµРє</b> РїРѕ Р·Р°РєР°Р·Сѓ ${escapeHtml(order.id)}`);
    await notifyCustomerOrderStatus(order.id, 'paid', order.updated_at);

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
  }
});

async function start() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for account/order features.');
    }
    validateTochkaEnv();

    await migrate();
    if (!String(process.env.UNISENDER_API_KEY || '').trim() || !String(process.env.UNISENDER_SENDER_EMAIL || '').trim()) {
      // eslint-disable-next-line no-console
      console.warn('Email verification is enabled by code, but Unisender env is incomplete (UNISENDER_API_KEY / UNISENDER_SENDER_EMAIL).');
    }

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`API server started on http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start API:', error);
    process.exit(1);
  }
}

start();



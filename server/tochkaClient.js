import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export class TochkaApiError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'TochkaApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const TOCHKA_REQUIRED_ENV = ['TOCHKA_API_BASE', 'TOCHKA_JWT', 'TOCHKA_CUSTOMER_CODE', 'TOCHKA_CLIENT_ID'];

export function validateTochkaEnv() {
  const missing = TOCHKA_REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    return !value || !String(value).trim();
  });
  if (missing.length > 0) {
    throw new Error(`Missing Tochka env vars: ${missing.join(', ')}`);
  }
}

function getTochkaConfig() {
  validateTochkaEnv();
  const rawBaseUrl = process.env.TOCHKA_API_BASE.trim().replace(/\/+$/, '');
  let requestBase = rawBaseUrl;
  let basePrefix = '';

  try {
    const parsed = new URL(rawBaseUrl);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    const uapiIndex = pathname.toLowerCase().indexOf('/uapi');

    requestBase = parsed.origin;
    if (uapiIndex !== -1) {
      basePrefix = pathname.slice(0, uapiIndex + '/uapi'.length);
    }
  } catch {
    // Keep raw value when TOCHKA_API_BASE is not a full URL.
  }

  return {
    requestBase,
    basePrefix,
    jwt: process.env.TOCHKA_JWT.trim(),
    customerCode: process.env.TOCHKA_CUSTOMER_CODE.trim(),
    clientId: process.env.TOCHKA_CLIENT_ID.trim()
  };
}

function normalizeTochkaStatus(statusCode) {
  if (statusCode === 400) return 'Validation error in Tochka API request.';
  if (statusCode === 401) return 'Unauthorized in Tochka API.';
  if (statusCode === 403) return 'Forbidden in Tochka API.';
  if (statusCode === 404) return 'Tochka API resource not found.';
  if (statusCode >= 500) return 'Tochka API internal server error.';
  return `Tochka API request failed with HTTP ${statusCode}.`;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeOperationId(payload) {
  return String(
    payload?.operationId ??
      payload?.paymentId ??
      payload?.id ??
      payload?.data?.operationId ??
      payload?.data?.paymentId ??
      payload?.Data?.operationId ??
      payload?.Data?.paymentId ??
      ''
  ).trim();
}

function normalizePaymentLink(payload) {
  return String(
    payload?.paymentLink ??
      payload?.paymentUrl ??
      payload?.paymentURL ??
      payload?.url ??
      payload?.data?.paymentLink ??
      payload?.data?.paymentUrl ??
      payload?.Data?.paymentLink ??
      payload?.Data?.paymentUrl ??
      ''
  ).trim();
}

function normalizeStatus(payload) {
  return String(
    payload?.status ?? payload?.paymentStatus ?? payload?.data?.status ?? payload?.Data?.status ?? 'CREATED'
  ).trim();
}

function normalizeRetailersCustomerCode(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.customerCode === 'string' && payload.customerCode.trim()) {
    return payload.customerCode.trim();
  }
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = normalizeRetailersCustomerCode(item);
      if (found) return found;
    }
    return '';
  }
  for (const nested of Object.values(payload)) {
    const found = normalizeRetailersCustomerCode(nested);
    if (found) return found;
  }
  return '';
}

async function tochkaHttpRequest(pathname, { method = 'GET', body } = {}) {
  const config = getTochkaConfig();
  let normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (config.basePrefix.toLowerCase().endsWith('/uapi') && normalizedPath.startsWith('/uapi/')) {
    normalizedPath = normalizedPath.slice('/uapi'.length);
  }
  const url = `${config.requestBase}${config.basePrefix}${normalizedPath}`;

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${config.jwt}`,
    'X-Client-Id': config.clientId
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch (networkError) {
    throw new TochkaApiError(
      `Network error while calling Tochka API ${method} ${pathname}`,
      500,
      networkError instanceof Error ? networkError.message : String(networkError)
    );
  }

  const rawText = await response.text();
  const parsed = safeJsonParse(rawText);

  if (!response.ok) {
    const apiMessage =
      parsed && typeof parsed === 'object'
        ? parsed.message || parsed.error || parsed.description || null
        : null;
    throw new TochkaApiError(
      apiMessage || normalizeTochkaStatus(response.status),
      response.status,
      parsed ?? rawText
    );
  }

  return parsed ?? {};
}

async function tochkaHttpRequestWithFallback(pathnames, options) {
  const uniquePathnames = [...new Set(pathnames)];
  let lastError = null;

  for (let i = 0; i < uniquePathnames.length; i += 1) {
    try {
      return await tochkaHttpRequest(uniquePathnames[i], options);
    } catch (error) {
      if (!(error instanceof TochkaApiError)) {
        throw error;
      }

      const canTryNext = (error.statusCode === 404 || error.statusCode === 501) && i < uniquePathnames.length - 1;
      if (!canTryNext) {
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new TochkaApiError('Tochka API request failed.', 500);
}

function isMissingDataFieldError(error) {
  if (!(error instanceof TochkaApiError)) return false;
  if (error.statusCode !== 400) return false;

  const message = String(error.message || '').toLowerCase();
  if (message.includes('field data') && message.includes('required')) {
    return true;
  }

  const detailsText = JSON.stringify(error.details || {}).toLowerCase();
  return detailsText.includes('field data') && detailsText.includes('required');
}

export async function getRetailers() {
  const raw = await tochkaHttpRequestWithFallback(
    ['/acquiring/v1.0/retailers', '/uapi/acquiring/v1.0/retailers'],
    { method: 'GET' }
  );
  return {
    success: true,
    customerCode: normalizeRetailersCustomerCode(raw),
    raw
  };
}

export async function createPaymentLink(input) {
  const config = getTochkaConfig();
  const amount = Number(input?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TochkaApiError('amount must be a positive number.', 400);
  }

  const purpose = String(input?.purpose || '').trim();
  if (!purpose) {
    throw new TochkaApiError('purpose must be a non-empty string.', 400);
  }

  const paymentMode =
    Array.isArray(input?.paymentMode) && input.paymentMode.length > 0 ? input.paymentMode : ['card', 'sbp'];
  const paymentLinkId = String(input?.paymentLinkId || `order_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`).trim();

  const payload = {
    amount: Number(amount.toFixed(2)),
    customerCode: String(input?.customerCode || config.customerCode).trim(),
    purpose,
    paymentMode,
    paymentLinkId,
    redirectUrl: input?.redirectUrl,
    failRedirectUrl: input?.failRedirectUrl,
    ttl: input?.ttl,
    ...(input?.merchantId ? { merchantId: String(input.merchantId).trim() } : {})
  };

  if (!payload.customerCode) {
    throw new TochkaApiError('customerCode is required.', 400);
  }

  // NOTE: if your Tochka cabinet requires a different schema (e.g. wrapped payload),
  // adjust this body mapping according to the production API contract.
  const pathnames = ['/acquiring/v1.0/payments', '/uapi/acquiring/v1.0/payments'];
  let raw;

  try {
    raw = await tochkaHttpRequestWithFallback(pathnames, {
      method: 'POST',
      body: payload
    });
  } catch (error) {
    if (!isMissingDataFieldError(error)) {
      throw error;
    }

    try {
      raw = await tochkaHttpRequestWithFallback(pathnames, {
        method: 'POST',
        body: { data: payload }
      });
    } catch (wrappedError) {
      if (!isMissingDataFieldError(wrappedError)) {
        throw wrappedError;
      }
      raw = await tochkaHttpRequestWithFallback(pathnames, {
        method: 'POST',
        body: { Data: payload }
      });
    }
  }

  const operationId = normalizeOperationId(raw);
  const paymentLink = normalizePaymentLink(raw);
  if (!operationId || !paymentLink) {
    throw new TochkaApiError('Tochka response does not contain operationId/paymentLink.', 502, raw);
  }

  return {
    success: true,
    operationId,
    paymentLink,
    raw
  };
}

export async function getPaymentStatus(operationId) {
  const normalizedOperationId = String(operationId || '').trim();
  if (!normalizedOperationId) {
    throw new TochkaApiError('operationId is required.', 400);
  }

  const raw = await tochkaHttpRequestWithFallback(
    [
      `/acquiring/v1.0/payments/${encodeURIComponent(normalizedOperationId)}`,
      `/uapi/acquiring/v1.0/payments/${encodeURIComponent(normalizedOperationId)}`
    ],
    { method: 'GET' }
  );

  return {
    success: true,
    operationId: normalizeOperationId(raw) || normalizedOperationId,
    status: normalizeStatus(raw),
    raw
  };
}

export function decodeWebhookJwtUnsafe(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object') {
    throw new TochkaApiError('Invalid Tochka webhook JWT payload.', 400);
  }
  return decoded;
}

export function verifyWebhookJwt(token) {
  const publicKey = process.env.TOCHKA_WEBHOOK_PUBLIC_KEY?.trim();
  if (!publicKey) {
    throw new TochkaApiError('Missing TOCHKA_WEBHOOK_PUBLIC_KEY.', 500);
  }
  const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
  if (!decoded || typeof decoded !== 'object') {
    throw new TochkaApiError('Invalid Tochka webhook JWT payload.', 400);
  }
  return decoded;
}

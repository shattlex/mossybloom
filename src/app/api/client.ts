import { type OrderExtras } from '../types/orderExtras';

export interface ContactPayload {
  name: string;
  phone: string;
  email: string;
  message: string;
  consentPersonalData: boolean;
  consentTerms: boolean;
}

export interface CheckoutPerson {
  name: string;
  phone: string;
  email: string;
}

export interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface CheckoutConsentPayload {
  offerAccepted: boolean;
  personalDataAccepted: boolean;
  marketingAccepted?: boolean;
  acceptedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  last_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  default_delivery_address: string | null;
  email_verified: boolean;
  auth_provider: string;
  created_at: string;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram_connected_at?: string | null;
}

export interface OrderHistoryItem {
  id: string;
  status: 'received' | 'paid' | 'assembled' | 'out_for_delivery' | 'delivered' | string;
  status_label: string;
  payment_status: string;
  total: string | number;
  subtotal?: string | number;
  delivery_amount?: string | number;
  promo_code?: string | null;
  promo_discount_percent?: string | number;
  promo_discount_amount?: string | number;
  total_before_discount?: string | number;
  total_after_discount?: string | number;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  receipt_path: string | null;
  items_json: CheckoutItem[];
  payer_name: string;
  recipient_mode: 'self' | 'other';
  recipient_name: string | null;
  gift_wrap: boolean;
  ribbon: boolean;
  postcard_text: string | null;
}

interface ApiError {
  ok?: boolean;
  error?: string;
  details?: unknown;
  devCode?: string;
  requiresEmailVerification?: boolean;
  message?: string;
  email?: string;
  retryAfterSeconds?: number;
  resendAvailableIn?: number;
}

const AUTH_TOKEN_KEY = 'sf_auth_token';

export function getAuthToken(): string {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export class ApiRequestError extends Error {
  status: number;
  payload: ApiError & Record<string, unknown>;

  constructor(status: number, payload: ApiError & Record<string, unknown>) {
    super(payload.error || payload.message || `Request failed: ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.payload = payload;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const token = getAuthToken();
  const mergedHeaders = new Headers(init.headers || {});
  if (!mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }
  if (token && !mergedHeaders.has('Authorization')) {
    mergedHeaders.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(url, {
    ...init
    ,
    headers: mergedHeaders
  });

  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok || (typeof data === 'object' && data !== null && 'ok' in data && data.ok === false)) {
    throw new ApiRequestError(response.status, data as ApiError & Record<string, unknown>);
  }

  return data;
}

export async function submitContact(payload: ContactPayload): Promise<void> {
  await request('/api/contact', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createPayment(payload: CheckoutPayload): Promise<
  CheckoutPricingResult & { confirmationUrl: string | null; operationId?: string; paymentUrl?: string }
> {
  return request('/api/payments/create', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createCashOrder(payload: CheckoutPayload): Promise<CheckoutPricingResult> {
  return request('/api/orders/create-cash', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function register(payload: {
  name: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  consentPersonalData: boolean;
  consentTerms: boolean;
}): Promise<
  | { token: string; user: UserProfile }
  | { success: true; requiresEmailVerification: true; email: string; message?: string }
> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function login(payload: {
  login: string;
  password: string;
}): Promise<{ token: string; user: UserProfile }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function verifyEmailCode(payload: {
  email: string;
  code: string;
}): Promise<{ success: true; emailVerified: true }> {
  return request('/api/auth/verify-email-code', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function resendEmailCode(payload: {
  email: string;
}): Promise<{ success: true; message?: string; emailVerified?: boolean; resendAvailableIn?: number }> {
  return request('/api/auth/resend-email-code', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function requestSmsCode(
  phone: string,
  consentPersonalData: boolean,
  consentTerms: boolean
): Promise<{ message: string; devCode?: string }> {
  return request('/api/auth/sms/request', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      consentPersonalData,
      consentTerms
    })
  });
}

export async function verifySmsCode(payload: {
  phone: string;
  code: string;
  name?: string;
}): Promise<{ token: string; user: UserProfile }> {
  return request('/api/auth/sms/verify', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function me(): Promise<{ user: UserProfile }> {
  return request('/api/auth/me', { method: 'GET' });
}

export async function updateProfile(payload: {
  name: string;
  lastName: string;
  username: string;
  phone: string;
  email: string;
  defaultDeliveryAddress: string;
}): Promise<{ user: UserProfile }> {
  return request('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function changePassword(payload: {
  newPassword: string;
  confirmPassword: string;
}): Promise<{ message: string }> {
  return request('/api/auth/password', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function myOrders(): Promise<{ orders: OrderHistoryItem[] }> {
  return request('/api/orders/my', { method: 'GET' });
}

export async function getTelegramLink(): Promise<{
  botUsername: string;
  deepLink: string;
  expiresAt: string;
  connected: boolean;
  telegramUsername: string | null;
}> {
  return request('/api/telegram/link', { method: 'GET' });
}

export async function getOAuthStartUrl(provider: 'google' | 'yandex'): Promise<string> {
  const response = await request<{ url: string }>(`/api/auth/oauth/${provider}/start`, { method: 'GET' });
  return response.url;
}

export interface DadataAddressSuggestion {
  value: string;
  unrestricted_value: string;
  data: Record<string, unknown>;
}

export interface DeliveryCalculation {
  beltwayHit: string | null;
  beltwayDistanceKm: number | null;
  freeRadiusKm: number;
  pricePerKm: number;
  chargeableDistanceKm: number;
  deliveryPrice: number;
}

export interface PromoValidationResult {
  valid: boolean;
  code: string;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  message?: string;
}

export interface CheckoutPricingResult {
  orderId: string;
  subtotal: number;
  delivery: number;
  discountAmount: number;
  discountPercent: number;
  grandTotal: number;
  promoApplied: boolean;
  promoCode?: string | null;
}

export interface CheckoutPayload {
  payer: CheckoutPerson;
  recipient: CheckoutPerson;
  recipientMode: 'self' | 'other';
  items: CheckoutItem[];
  total: number;
  deliveryAmount?: number;
  promoCode?: string;
  deliveryAddress: string;
  orderComment?: string;
  extras: OrderExtras;
  consents: CheckoutConsentPayload;
}

export interface PromoCodeAdminPayload {
  code: string;
  discountPercent: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUsesTotal?: number | null;
  maxUsesPerUser?: number | null;
  minOrderAmount?: number | null;
}

export interface PromoCodeAdminRecord {
  id: string;
  code: string;
  discount_percent: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses_total: number | null;
  uses_total: number;
  max_uses_per_user: number | null;
  min_order_amount: number;
  created_at: string;
  updated_at: string;
}

export async function suggestAddresses(query: string): Promise<DadataAddressSuggestion[]> {
  const response = await request<{ suggestions: DadataAddressSuggestion[] }>('/api/dadata/address-suggestions', {
    method: 'POST',
    body: JSON.stringify({ query })
  });
  return Array.isArray(response.suggestions) ? response.suggestions : [];
}

export async function calculateDelivery(address: string): Promise<DeliveryCalculation> {
  return request<DeliveryCalculation>('/api/dadata/delivery-calculation', {
    method: 'POST',
    body: JSON.stringify({ address })
  });
}

export async function validatePromoCode(payload: {
  code: string;
  subtotal: number;
}): Promise<PromoValidationResult> {
  return request('/api/promo-codes/validate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function adminListPromoCodes(adminToken: string): Promise<{ promoCodes: PromoCodeAdminRecord[] }> {
  return request('/api/admin/promo-codes', {
    method: 'GET',
    headers: { 'x-admin-token': adminToken }
  });
}

export async function adminCreatePromoCode(
  adminToken: string,
  payload: PromoCodeAdminPayload
): Promise<{ promoCode: PromoCodeAdminRecord }> {
  return request('/api/admin/promo-codes', {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: JSON.stringify(payload)
  });
}

export async function adminUpdatePromoCode(
  adminToken: string,
  promoCodeId: string,
  payload: Partial<PromoCodeAdminPayload>
): Promise<{ promoCode: PromoCodeAdminRecord }> {
  return request(`/api/admin/promo-codes/${encodeURIComponent(promoCodeId)}`, {
    method: 'PATCH',
    headers: { 'x-admin-token': adminToken },
    body: JSON.stringify(payload)
  });
}

export async function createTochkaPayment(payload: {
  amount: number;
  description: string;
  orderId: string;
  redirectUrl?: string;
  failRedirectUrl?: string;
  paymentMode?: string[];
  ttl?: number;
  merchantId?: string;
}): Promise<{ success: true; operationId: string; paymentLink: string; status: string }> {
  return request('/api/payments/tochka/create', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getTochkaPaymentStatus(operationId: string): Promise<{
  success: true;
  operationId: string;
  status: string;
}> {
  return request(`/api/payments/tochka/status/${encodeURIComponent(operationId)}`, {
    method: 'GET'
  });
}

export async function redirectToTochkaPayment(payload: {
  amount: number;
  description: string;
  orderId: string;
}): Promise<void> {
  const result = await createTochkaPayment(payload);
  window.location.href = result.paymentLink;
}

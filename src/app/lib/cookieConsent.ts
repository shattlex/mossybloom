export type CookieConsentChoice = "all" | "necessary";

export interface CookieConsentState {
  version: number;
  choice: CookieConsentChoice;
  analytics: boolean;
  updatedAt: string;
}

export const COOKIE_CONSENT_VERSION = 2;
export const COOKIE_CONSENT_STORAGE_KEY = "sf_cookie_consent_v2";

export function getCookieConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (!parsed || parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (parsed.choice !== "all" && parsed.choice !== "necessary") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCookieConsent(choice: CookieConsentChoice): CookieConsentState {
  const state: CookieConsentState = {
    version: COOKIE_CONSENT_VERSION,
    choice,
    analytics: choice === "all",
    updatedAt: new Date().toISOString()
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(state));
  }
  return state;
}

export function canUseAnalyticsCookies(): boolean {
  return Boolean(getCookieConsent()?.analytics);
}


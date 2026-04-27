import { CmsContent, EMPTY_CONTENT } from './content';

function normalizeContent(value: unknown): CmsContent {
  if (!value || typeof value !== 'object') return EMPTY_CONTENT;
  const record = value as Record<string, unknown>;

  const siteName = typeof record.siteName === 'string' && record.siteName.trim()
    ? record.siteName
    : EMPTY_CONTENT.siteName;

  return {
    siteName,
    pages: Array.isArray(record.pages) ? record.pages as CmsContent['pages'] : [],
    media: Array.isArray(record.media) ? record.media as CmsContent['media'] : [],
  };
}

function getStrapiBaseUrl(): string {
  const url = import.meta.env.VITE_STRAPI_URL;
  return typeof url === 'string' && url.trim() ? url.replace(/\/+$/, '') : 'http://127.0.0.1:1337';
}

export async function fetchStrapiCmsContent(): Promise<CmsContent> {
  const baseUrl = getStrapiBaseUrl();
  const response = await fetch(`${baseUrl}/api/public-cms`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Strapi CMS request failed: ${response.status}`);
  }

  const data = await response.json().catch(() => ({})) as { content?: unknown };
  return normalizeContent(data.content);
}

export const CMS_STORAGE_KEY = 'sara_flowers_cms_v1';

export interface CmsMedia {
  id: string;
  name?: string;
  url: string;
}

export interface CmsBlock {
  id?: string;
  type: string;
  [key: string]: unknown;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  type?: string;
  inNav?: boolean;
  blocks: CmsBlock[];
}

export interface CmsContent {
  siteName: string;
  pages: CmsPage[];
  media: CmsMedia[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const EMPTY_CONTENT: CmsContent = {
  siteName: 'MossyBloom',
  pages: [],
  media: []
};

export function loadCmsContent(): CmsContent {
  if (typeof window === 'undefined') return EMPTY_CONTENT;

  try {
    const raw = window.localStorage.getItem(CMS_STORAGE_KEY);
    if (!raw) return EMPTY_CONTENT;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_CONTENT;

    const pages = Array.isArray(parsed.pages) ? parsed.pages.filter(isRecord).map((page) => ({
      id: String(page.id ?? ''),
      slug: String(page.slug ?? ''),
      title: String(page.title ?? ''),
      type: String(page.type ?? ''),
      inNav: Boolean(page.inNav),
      blocks: Array.isArray(page.blocks) ? page.blocks.filter(isRecord).map((block) => ({ ...block, type: String(block.type ?? '') })) : []
    })) : [];

    const media = Array.isArray(parsed.media)
      ? parsed.media.filter(isRecord).map((item) => ({
          id: String(item.id ?? ''),
          name: typeof item.name === 'string' ? item.name : '',
          url: String(item.url ?? '')
        }))
      : [];

    return {
      siteName: typeof parsed.siteName === 'string' && parsed.siteName.trim() ? parsed.siteName : 'MossyBloom',
      pages,
      media
    };
  } catch {
    return EMPTY_CONTENT;
  }
}

export function findCmsPage(content: CmsContent, slug: string): CmsPage | null {
  return content.pages.find((page) => page.slug === slug) ?? null;
}

export function resolveCmsImage(content: CmsContent, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return '';
  if (!value.startsWith('media:')) return value;

  const id = value.slice('media:'.length);
  return content.media.find((m) => m.id === id)?.url ?? '';
}

export function parsePriceToNumber(value: string | number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const numeric = value.replace(/[^\d]/g, '');
  return numeric ? Number(numeric) : 0;
}


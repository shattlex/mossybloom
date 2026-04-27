export type LegalDocumentKey = 'oferta' | 'privacy' | 'consent' | 'terms';

export interface LegalDocumentMeta {
  key: LegalDocumentKey;
  route: string;
  title: string;
  revisionDate: string;
  sourcePath: string;
  footerLabel: string;
}

export const COMPANY_DETAILS = {
  legalName: 'ИП Глебова Наталья Игоревна',
  inn: '911104302915',
  ogrnip: '325911200017412',
  address: '298312, Россия, Республика Крым, г. Керчь',
  email: 'sales@mossybloom.ru',
  phone: '+7 915 337-76-90',
  bank: 'ООО «Банк Точка»',
  account: '40802810120000564875',
  bik: '044525104'
};

export const LEGAL_DOCUMENTS: LegalDocumentMeta[] = [
  {
    key: 'oferta',
    route: '/oferta',
    title: 'Публичная оферта',
    revisionDate: '01.04.2026',
    sourcePath: '/Публичная оферта.txt',
    footerLabel: 'Публичная оферта'
  },
  {
    key: 'privacy',
    route: '/privacy',
    title: 'Политика конфиденциальности',
    revisionDate: '01.04.2026',
    sourcePath: '/Политика Конфиденциальности.txt',
    footerLabel: 'Политика конфиденциальности'
  },
  {
    key: 'consent',
    route: '/consent',
    title: 'Согласие на обработку персональных данных',
    revisionDate: '01.04.2026',
    sourcePath: '/Согласие на обработку ПДн.txt',
    footerLabel: 'Согласие на обработку ПДн'
  },
  {
    key: 'terms',
    route: '/terms',
    title: 'Пользовательское соглашение',
    revisionDate: '01.04.2026',
    sourcePath: '/Пользовательское соглашение.txt',
    footerLabel: 'Пользовательское соглашение'
  }
];

export function getLegalDocumentByKey(key: LegalDocumentKey): LegalDocumentMeta {
  const doc = LEGAL_DOCUMENTS.find((item) => item.key === key);
  if (!doc) {
    throw new Error(`Unknown legal document key: ${key}`);
  }
  return doc;
}


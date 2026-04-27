import { motion } from 'motion/react';
import { Mail, Clock, Instagram, Send, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { findCmsPage, type CmsBlock } from '../cms/content';
import { useCmsContent } from '../cms/useCmsContent';
import { submitContact } from '../api/client';

interface ContactItem {
  icon: LucideIcon;
  title: string;
  content: string;
  link: string | null;
}

const iconMap: Record<string, LucideIcon> = {
  mail: Mail,
  instagram: Instagram,
  clock: Clock
};

const fallbackContactInfo: ContactItem[] = [
  { icon: Mail, title: 'Email', content: 'sales@mossybloom.ru', link: 'mailto:sales@mossybloom.ru' },
  { icon: Instagram, title: 'Instagram', content: '@sara_flowers', link: 'https://instagram.com' }
];

function findTextBlock(blocks: CmsBlock[], title: string): CmsBlock | undefined {
  return blocks.find(
    (block) =>
      block.type === 'text' &&
      typeof block.title === 'string' &&
      block.title.trim().toLowerCase() === title.toLowerCase()
  );
}

function readSectionTitle(blocks: CmsBlock[]): string {
  const block = blocks.find((item) => item.type === 'sectionTitle' && typeof item.text === 'string' && item.text.trim());
  return typeof block?.text === 'string' && block.text.trim() ? block.text : 'Контакты';
}

function readSubtitle(blocks: CmsBlock[]): string {
  const block = findTextBlock(blocks, 'subtitle');
  return typeof block?.body === 'string' && block.body.trim()
    ? block.body
    : 'Свяжитесь с нами любым удобным способом. Мы всегда рады помочь!';
}

function readContacts(blocks: CmsBlock[]): ContactItem[] {
  const block = blocks.find(
    (item) =>
      item.type === 'products' &&
      typeof item.title === 'string' &&
      item.title.trim().toLowerCase() === 'contact-items'
  );
  if (!block || !Array.isArray(block.items)) return [];

  return block.items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.name === 'string' ? record.name.trim() : '';
      const content = typeof record.price === 'string' ? record.price.trim() : '';
      if (!title || !content) return null;

      const iconKey = typeof record.meta === 'string' ? record.meta.trim().toLowerCase() : '';
      const link = typeof record.description === 'string' && record.description.trim() ? record.description : null;

      return {
        icon: iconMap[iconKey] ?? Mail,
        title,
        content,
        link
      } satisfies ContactItem;
    })
    .filter((item): item is ContactItem => item !== null);
}

function normalizeContactInfo(items: ContactItem[]): ContactItem[] {
  const withoutPhoneOrAddress = items.filter((item) => {
    const title = item.title.trim().toLowerCase();
    return !title.includes('телефон') && !title.includes('адрес');
  });

  const hasEmail = withoutPhoneOrAddress.some((item) => item.title.trim().toLowerCase().includes('email'));
  const normalized = withoutPhoneOrAddress.map((item) =>
    item.title.trim().toLowerCase().includes('email')
      ? { ...item, content: 'sales@mossybloom.ru', link: 'mailto:sales@mossybloom.ru' }
      : item
  );

  if (hasEmail) return normalized;

  return [{ icon: Mail, title: 'Email', content: 'sales@mossybloom.ru', link: 'mailto:sales@mossybloom.ru' }, ...normalized];
}

export function Contacts() {
  const cmsContent = useCmsContent();
  const cmsPage = findCmsPage(cmsContent, 'contacts');
  const blocks = cmsPage?.blocks ?? [];

  const pageTitle = readSectionTitle(blocks);
  const pageSubtitle = readSubtitle(blocks);
  const workHoursBlock = findTextBlock(blocks, 'Режим работы');
  const formBlock = findTextBlock(blocks, 'Форма');
  const workHours = typeof workHoursBlock?.body === 'string' && workHoursBlock.body.trim() ? workHoursBlock.body : 'Ежедневно с 9:00 до 21:00';
  const formButtonText = typeof formBlock?.body === 'string' && formBlock.body.trim() ? formBlock.body : 'Отправить сообщение';
  const cmsContacts = readContacts(blocks);
  const contactInfo = normalizeContactInfo(cmsContacts.length > 0 ? cmsContacts : fallbackContactInfo);

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consents, setConsents] = useState({
    personalData: false,
    terms: false
  });
  const [consentError, setConsentError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!consents.personalData || !consents.terms) {
      setConsentError('Для отправки формы нужно подтвердить согласие на обработку персональных данных и пользовательское соглашение.');
      return;
    }

    try {
      setIsSubmitting(true);
      setConsentError('');
      await submitContact({
        ...formData,
        consentPersonalData: consents.personalData,
        consentTerms: consents.terms
      });
      alert('Спасибо! Заявка отправлена, менеджер скоро свяжется с вами.');
      setFormData({ name: '', phone: '', email: '', message: '' });
      setConsents({ personalData: false, terms: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось отправить форму';
      alert(`Ошибка отправки: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-16 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-light italic mb-6" style={{ fontFamily: 'var(--font-script)' }}>{pageTitle}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
            {pageSubtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-200">
              <h2 className="text-3xl font-light italic mb-8" style={{ fontFamily: 'var(--font-script)' }}>Наши контакты</h2>

              <div className="space-y-6">
                {contactInfo.map((info, index) => (
                  <div key={`${info.title}-${index}`} className="flex items-start gap-4">
                    <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                      <info.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'var(--font-sans)' }}>{info.title}</p>
                      {info.link ? (
                        <a href={info.link} target={info.link.startsWith('http') ? '_blank' : undefined} rel={info.link.startsWith('http') ? 'noopener noreferrer' : undefined} className="text-lg font-medium hover:text-primary transition-colors" style={{ fontFamily: 'var(--font-sans)' }}>
                          {info.content}
                        </a>
                      ) : (
                        <p className="text-lg font-medium" style={{ fontFamily: 'var(--font-sans)' }}>{info.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'var(--font-sans)' }}>Режим работы</p>
                    <p className="text-lg font-medium" style={{ fontFamily: 'var(--font-sans)' }}>{workHours}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-200">
              <h2 className="text-3xl font-light italic mb-8" style={{ fontFamily: 'var(--font-script)' }}>Напишите нам</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-sans)' }}>Ваше имя</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary transition-colors bg-white/50" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-sans)' }}>Телефон</label>
                  <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+7 (___) ___-__-__" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary transition-colors bg-white/50" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-sans)' }}>Email</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary transition-colors bg-white/50" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-sans)' }}>Сообщение</label>
                  <textarea required rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary transition-colors bg-white/50 resize-none" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>

                <div className="space-y-2 text-sm">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={consents.personalData}
                      onChange={(e) => {
                        setConsents((prev) => ({ ...prev, personalData: e.target.checked }));
                        setConsentError('');
                      }}
                      className="mt-1"
                    />
                    <span>
                      Я даю <Link to="/consent" className="text-primary hover:underline">согласие на обработку персональных данных</Link> и подтверждаю ознакомление с <Link to="/privacy" className="text-primary hover:underline">Политикой конфиденциальности</Link>.
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={consents.terms}
                      onChange={(e) => {
                        setConsents((prev) => ({ ...prev, terms: e.target.checked }));
                        setConsentError('');
                      }}
                      className="mt-1"
                    />
                    <span>
                      Я принимаю условия <Link to="/terms" className="text-primary hover:underline">Пользовательского соглашения</Link>.
                    </span>
                  </label>
                </div>

                {consentError && (
                  <p className="text-sm text-red-600" role="alert">
                    {consentError}
                  </p>
                )}

                <button type="submit" disabled={isSubmitting || !consents.personalData || !consents.terms} className="w-full bg-primary text-white py-4 rounded-xl hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2" style={{ fontFamily: 'var(--font-sans)' }}>
                  <Send className="w-5 h-5" />
                  {isSubmitting ? 'Отправляем...' : formButtonText}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}








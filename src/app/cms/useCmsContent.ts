import { useEffect, useState } from 'react';
import { CmsContent, loadCmsContent, CMS_STORAGE_KEY, EMPTY_CONTENT } from './content';
import { fetchStrapiCmsContent } from './strapi';

const CMS_PROVIDER = import.meta.env.VITE_CMS_PROVIDER === 'legacy' ? 'legacy' : 'strapi';

export function useCmsContent(): CmsContent {
  const [content, setContent] = useState<CmsContent>(() => (CMS_PROVIDER === 'legacy' ? loadCmsContent() : EMPTY_CONTENT));

  useEffect(() => {
    if (CMS_PROVIDER === 'strapi') {
      let cancelled = false;

      const pull = async () => {
        try {
          const data = await fetchStrapiCmsContent();
          if (!cancelled) {
            setContent(data);
          }
        } catch {
          // Keep previous content on transient errors to avoid UI flicker.
        }
      };

      void pull();
      const interval = window.setInterval(() => {
        void pull();
      }, 4000);

      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== CMS_STORAGE_KEY) return;
      setContent(loadCmsContent());
    };

    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(() => {
      setContent(loadCmsContent());
    }, 2000);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, []);

  return content;
}

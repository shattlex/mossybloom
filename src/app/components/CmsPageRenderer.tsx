import { Link } from 'react-router';
import { motion } from 'motion/react';
import { findCmsPage, resolveCmsImage, type CmsBlock } from '../cms/content';
import { useCmsContent } from '../cms/useCmsContent';

interface CmsPageRendererProps {
  slug: string;
  fallbackTitle: string;
  fallbackBlocks?: CmsBlock[];
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function isPlaceholder(blocks: CmsBlock[] | undefined): boolean {
  if (!Array.isArray(blocks) || blocks.length !== 1) return false;
  const block = blocks[0];
  if (block.type !== 'text') return false;
  const body = asText(block.body);
  return body.includes('Заполните контент этой страницы через админку');
}

export function CmsPageRenderer({ slug, fallbackTitle, fallbackBlocks = [] }: CmsPageRendererProps) {
  const cmsContent = useCmsContent();
  const page = findCmsPage(cmsContent, slug);
  const blocks = page?.blocks?.length && !isPlaceholder(page.blocks) ? page.blocks : fallbackBlocks;

  return (
    <div className="min-h-screen pb-16 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-5xl sm:text-6xl font-light italic" style={{ fontFamily: 'var(--font-script)' }}>
            {page?.title?.trim() || fallbackTitle}
          </h1>
        </motion.div>

        {blocks.map((block, idx) => {
          if (block.type === 'hero') {
            const image = resolveCmsImage(cmsContent, block.image);
            const title = asText(block.title, fallbackTitle);
            const subtitle = asText(block.subtitle);
            const buttonText = asText(block.buttonText);
            const buttonLink = asText(block.buttonLink, '/catalog');

            return (
              <section key={block.id || idx} className="relative rounded-3xl overflow-hidden min-h-[420px] border border-gray-200">
                {image ? (
                  <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#e7eef5] to-[#f7f2ec]" />
                )}
                <div className="absolute inset-0 bg-white/45" />
                <div className="relative z-10 p-10 md:p-14 max-w-2xl">
                  <h2 className="text-4xl md:text-5xl font-light italic mb-4" style={{ fontFamily: 'var(--font-script)' }}>{title}</h2>
                  {subtitle && <p className="text-lg text-gray-700 mb-6" style={{ fontFamily: 'var(--font-sans)' }}>{subtitle}</p>}
                  {buttonText && (
                    <Link to={buttonLink} className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors" style={{ fontFamily: 'var(--font-sans)' }}>
                      {buttonText}
                    </Link>
                  )}
                </div>
              </section>
            );
          }

          if (block.type === 'sectionTitle') {
            return (
              <section key={block.id || idx} className="text-center">
                <h2 className="text-4xl font-light italic" style={{ fontFamily: 'var(--font-script)' }}>
                  {asText(block.text, fallbackTitle)}
                </h2>
              </section>
            );
          }

          if (block.type === 'text') {
            return (
              <section key={block.id || idx} className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-10 border border-gray-200">
                {asText(block.title) && <h3 className="text-3xl font-light italic mb-4" style={{ fontFamily: 'var(--font-script)' }}>{asText(block.title)}</h3>}
                <p className="text-gray-700 whitespace-pre-line" style={{ fontFamily: 'var(--font-sans)' }}>{asText(block.body)}</p>
              </section>
            );
          }

          if (block.type === 'textImage') {
            const image = resolveCmsImage(cmsContent, block.image);
            const imageLeft = block.imageSide === 'left';
            return (
              <section key={block.id || idx} className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 md:p-10 border border-gray-200">
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-center ${imageLeft ? '' : 'lg:[&>*:first-child]:order-1'}`}>
                  <div>
                    {asText(block.title) && <h3 className="text-3xl font-light italic mb-4" style={{ fontFamily: 'var(--font-script)' }}>{asText(block.title)}</h3>}
                    <p className="text-gray-700 whitespace-pre-line" style={{ fontFamily: 'var(--font-sans)' }}>{asText(block.text)}</p>
                    {asText(block.buttonText) && (
                      <Link to={asText(block.buttonLink, '/')} className="inline-flex mt-6 px-6 py-3 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors" style={{ fontFamily: 'var(--font-sans)' }}>
                        {asText(block.buttonText)}
                      </Link>
                    )}
                  </div>
                  <div>
                    {image ? <img src={image} alt={asText(block.title, 'Изображение')} className="w-full h-[320px] object-cover rounded-2xl" /> : <div className="w-full h-[320px] rounded-2xl bg-gray-100" />}
                  </div>
                </div>
              </section>
            );
          }

          if (block.type === 'products' && Array.isArray(block.items)) {
            const title = asText(block.title, 'Товары');
            return (
              <section key={block.id || idx}>
                <h2 className="text-4xl font-light italic text-center mb-8" style={{ fontFamily: 'var(--font-script)' }}>{title}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {block.items.map((item, itemIdx) => {
                    const image = resolveCmsImage(cmsContent, item.image);
                    return (
                      <article key={item.id || itemIdx} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        {image ? <img src={image} alt={asText(item.name, 'Товар')} className="w-full h-64 object-cover" /> : <div className="w-full h-64 bg-gray-100" />}
                        <div className="p-5 space-y-2">
                          <h3 className="text-xl" style={{ fontFamily: 'var(--font-sans)' }}>{asText(item.name, 'Товар')}</h3>
                          <p className="text-primary text-lg font-medium" style={{ fontFamily: 'var(--font-sans)' }}>{asText(item.price, '0 ₽')}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          }

          if (block.type === 'image') {
            const image = resolveCmsImage(cmsContent, block.image);
            if (!image) return null;
            return (
              <figure key={block.id || idx} className="bg-white rounded-3xl p-4 border border-gray-200">
                <img src={image} alt={asText(block.alt, 'Изображение')} className="w-full rounded-2xl object-cover max-h-[540px]" />
                {asText(block.caption) && <figcaption className="mt-3 text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>{asText(block.caption)}</figcaption>}
              </figure>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}


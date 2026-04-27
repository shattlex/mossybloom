import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { COMPANY_DETAILS, getLegalDocumentByKey, type LegalDocumentKey } from '../legal/legalDocuments';

interface LegalDocumentPageProps {
  documentKey: LegalDocumentKey;
}

interface ParsedBlock {
  type: 'h2' | 'paragraph' | 'list-item';
  text: string;
}

function parseDocument(content: string): ParsedBlock[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('## ')) {
        return { type: 'h2', text: line.replace(/^##\s*/, '') } satisfies ParsedBlock;
      }
      if (line.startsWith('* ')) {
        return { type: 'list-item', text: line.replace(/^\*\s*/, '') } satisfies ParsedBlock;
      }
      return { type: 'paragraph', text: line.replace(/^\*\*|\*\*$/g, '') } satisfies ParsedBlock;
    });
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const label = match[1];
    const href = match[2];

    nodes.push(
      <a
        key={`${href}-${match.index}`}
        href={href}
        className="text-primary hover:underline"
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {label}
      </a>
    );

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function LegalDocumentPage({ documentKey }: LegalDocumentPageProps) {
  const docMeta = useMemo(() => getLegalDocumentByKey(documentKey), [documentKey]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(encodeURI(docMeta.sourcePath));
        if (!response.ok) {
          throw new Error(`Не удалось загрузить документ (${response.status})`);
        }
        const text = await response.text();
        if (active) {
          setContent(text);
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить документ');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [docMeta.sourcePath]);

  const parsedBlocks = useMemo(() => parseDocument(content), [content]);

  return (
    <div className="min-h-screen pb-16 md:pb-24" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-10">
          <h1 className="text-4xl sm:text-5xl font-light italic mb-3" style={{ fontFamily: 'var(--font-script)' }}>
            {docMeta.title}
          </h1>
          <p className="text-sm text-gray-500 mb-8">Редакция от {docMeta.revisionDate}</p>

          {loading && <p className="text-gray-600">Загрузка документа...</p>}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
              {error}
            </div>
          )}

          {!loading && !error && (
            <article className="space-y-4 text-gray-800 leading-relaxed">
              {parsedBlocks.map((block, index) => {
                if (block.type === 'h2') {
                  return (
                    <h2 key={`${block.type}-${index}`} className="text-2xl font-medium mt-7">
                      {renderInlineMarkdown(block.text)}
                    </h2>
                  );
                }
                if (block.type === 'list-item') {
                  return (
                    <p key={`${block.type}-${index}`} className="pl-4 before:content-['•'] before:mr-2">
                      {renderInlineMarkdown(block.text)}
                    </p>
                  );
                }
                return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
              })}
            </article>
          )}

          <section className="mt-10 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-medium mb-4">Реквизиты компании</h2>
            <div className="space-y-1 text-sm text-gray-700">
              <p>{COMPANY_DETAILS.legalName}</p>
              <p>ИНН: {COMPANY_DETAILS.inn}</p>
              <p>ОГРНИП: {COMPANY_DETAILS.ogrnip}</p>
              <p>Адрес: {COMPANY_DETAILS.address}</p>
              <p>Email: {COMPANY_DETAILS.email}</p>
              <p>Телефон: {COMPANY_DETAILS.phone}</p>
              <p>Банк: {COMPANY_DETAILS.bank}</p>
              <p>Р/с: {COMPANY_DETAILS.account}</p>
              <p>БИК: {COMPANY_DETAILS.bik}</p>
            </div>
          </section>

          <div className="mt-8">
            <Link to="/" className="text-primary hover:underline">
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


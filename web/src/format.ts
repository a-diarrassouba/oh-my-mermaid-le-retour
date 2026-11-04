import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** "4 nov. 2026, 15:18" in the interface language. */
export function formatDate(iso: string | undefined, lang: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Markdown written by the AI, cleaned before it reaches the page. */
export function markdown(text: string): { __html: string } {
  return {
    __html: DOMPurify.sanitize(marked.parse(text, { async: false }) as string, {
      FORBID_TAGS: ['img', 'style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'svg', 'math'],
      FORBID_ATTR: ['style'],
    }),
  };
}

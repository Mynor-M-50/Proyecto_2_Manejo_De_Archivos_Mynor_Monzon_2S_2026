import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

// Convierte texto Markdown a HTML. Este HTML siempre se muestra con [innerHTML], donde Angular
// elimina por su cuenta scripts, eventos (onerror...) y direcciones peligrosas (javascript:).
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false }) as string;
  // Los enlaces se abren en otra pestana para no sacar al usuario de la aplicacion
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

import { marked } from 'marked';

export function md(text: string): string {
  return marked.parse(text, { async: false }) as string;
}

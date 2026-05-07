import type { ClientIntent } from '@kebi-app/shared';

const URL_PATTERN = /https?:\/\/\S+/i;

const MEMORY_PATTERN =
  /\b(that|the one|i saved|from tiktok|from instagram|from ig|from tt|i remember|that place|that spot|that restaurant|that café|that cafe|that bar)\b/i;

export function classifyIntent(message: string): ClientIntent {
  const trimmed = message.trim();
  if (URL_PATTERN.test(trimmed)) return 'save';
  if (MEMORY_PATTERN.test(trimmed)) return 'recall';
  return 'consult';
}

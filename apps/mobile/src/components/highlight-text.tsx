import type { ReactNode } from 'react';
import { Text } from 'react-native';

/**
 * Renders `text` with every case-insensitive occurrence of `query` wrapped in a
 * tinted highlight (kebi-search-mockup.html `<mark>`). With no query it's a plain
 * `Text`. `query` is expected pre-lowercased (the Library passes the normalized
 * search term); truncation via `numberOfLines` still applies.
 */
export function HighlightText({
  text,
  query,
  className,
  numberOfLines,
}: {
  text: string;
  query?: string;
  className?: string;
  numberOfLines?: number;
}) {
  if (!query) {
    return (
      <Text className={className} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const lower = text.toLowerCase();
  const nodes: ReactNode[] = [];
  let from = 0;
  let key = 0;
  for (let idx = lower.indexOf(query); idx !== -1; idx = lower.indexOf(query, from)) {
    if (idx > from) nodes.push(text.slice(from, idx));
    nodes.push(
      <Text key={key++} className="bg-pill-warm-bg text-like">
        {text.slice(idx, idx + query.length)}
      </Text>,
    );
    from = idx + query.length;
  }
  nodes.push(text.slice(from));

  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {nodes}
    </Text>
  );
}

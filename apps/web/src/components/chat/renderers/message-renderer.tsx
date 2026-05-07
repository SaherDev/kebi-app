import type { SseMessage } from '@kebi-app/shared';

export function MessageRenderer({ data }: { data: SseMessage }) {
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
}

import type { SseDone } from '@kebi-app/shared';

export function DoneRenderer({ data }: { data: SseDone }) {
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
}

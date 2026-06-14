import {
  buildDetailSegments,
  type ConsultCandidate,
  type ConsultCandidateSource,
  type PlaceCore,
  type SseToolResult,
} from '@kebi-app/shared';
import { ConsultResultSchema } from '../api/models/chat';
import type { PlaceCardDetailRow, PlaceCardPill } from './place-card-body';

/**
 * Pure data helpers for the chat place card — kept out of the component so they
 * can be unit-tested without rendering.
 */

/**
 * Flatten the turn's tool results into a single ordered candidate list. Each
 * `tool_result` frame carries a raw payload (the SSE parser leaves it a record);
 * validate it into a `ConsultResult` at this boundary (ADR-046) and concatenate
 * its candidates in arrival order. A payload that fails validation is skipped
 * (render-safe — never throws). `candidates[0]` is the primary pick, the rest
 * are swaps.
 */
export function flattenCandidates(toolResults: readonly SseToolResult[]): ConsultCandidate[] {
  const out: ConsultCandidate[] = [];
  for (const tr of toolResults) {
    if (!tr.payload) continue;
    const parsed = ConsultResultSchema.safeParse(tr.payload);
    if (parsed.success) out.push(...parsed.data.candidates);
  }
  return out;
}

/**
 * The card's meta rows, icon-per-row to match kebi-chat-mockup: the neighborhood
 * (📍) on its own line, then the category · facet · ¥ line (🌐). Built from the
 * shared {@link buildDetailSegments} — the area segment is split out onto the
 * first row, the rest forms the second. Travel time / hours aren't in the data,
 * so the first row is area only (ADR-083 covers server-side geo).
 */
export function chatDetailRows(
  place: PlaceCore,
  t: (key: string) => string,
): PlaceCardDetailRow[] {
  const rows: PlaceCardDetailRow[] = [];
  const area = place.location?.neighborhood ?? place.location?.city ?? null;
  if (area) rows.push({ icon: 'pin', text: area });

  // The category row only earns its place when there's a price or facet to add —
  // a bare category alone (e.g. "landmark") is already shown by the avatar emoji.
  const rest = buildDetailSegments(place).filter((s) => !(s.kind === 'text' && s.value === area));
  if (rest.length > 1) {
    rows.push({
      icon: 'globe',
      text: rest
        .map((s) => (s.kind === 'price' ? t(`library.price.${s.value}`) : s.value))
        .join(' · '),
    });
  }

  return rows;
}

/**
 * A swap row's meta line — the detail line minus the leading category descriptor
 * (the avatar already conveys it, and the design's swaps don't repeat it). Reads
 * `facet · ¥ · area`, shorter than the full line so it doesn't truncate.
 */
export function swapMetaLine(place: PlaceCore, t: (key: string) => string): string {
  return buildDetailSegments(place)
    .slice(1)
    .map((s) => (s.kind === 'price' ? t(`library.price.${s.value}`) : s.value))
    .join(' · ');
}

/**
 * The header pill — only a saved pick gets one ("saved", green); discovered /
 * suggested picks show no pill (the "new" chip was dropped as noise).
 */
export function sourcePill(
  source: ConsultCandidateSource,
  t: (key: string) => string,
): PlaceCardPill | null {
  return source === 'saved' ? { tone: 'green', label: t('chat.placeCard.saved') } : null;
}

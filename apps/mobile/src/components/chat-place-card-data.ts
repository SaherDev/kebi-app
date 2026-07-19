import {
  buildDetailSegments,
  isConsultTool,
  type ConsultCandidate,
  type ConsultEmptyReason,
  type PlaceCore,
  type SseToolResult,
} from '@kebi-app/shared';
import { ConsultResultSchema } from '../api/models/chat';
import type { PlaceCardDetailRow } from './place-card-body';

/**
 * Pure data helpers for the chat place card — kept out of the component so they
 * can be unit-tested without rendering.
 */

/**
 * A candidate paired with the `recommendation_id` of the consult result it came
 * from. The card echoes that id back when the user accepts/rejects/saves the
 * candidate, so each candidate must carry its own result's id (a turn can run
 * several consult tools, each minting a distinct id).
 */
export interface RecommendedCandidate {
  candidate: ConsultCandidate;
  recommendationId: string;
}

/**
 * Flatten the turn's tool results into a single ordered candidate list.
 * Consult results are picked by **tool name first** (ADR-050 — never by payload
 * shape; a `research` result is skipped outright even if it ever grew
 * consult-looking fields). Each surviving payload arrives raw (the SSE parser
 * leaves it a record); validate it into a `ConsultResult` at this boundary
 * (ADR-046) and concatenate its candidates in arrival order, each tagged with
 * that result's `recommendation_id`. A payload that fails validation is skipped
 * (render-safe — never throws). `[0]` is the primary pick, the rest are swaps.
 */
export function flattenCandidates(
  toolResults: readonly SseToolResult[],
): RecommendedCandidate[] {
  const out: RecommendedCandidate[] = [];
  for (const tr of toolResults) {
    if (!isConsultTool(tr.tool)) continue;
    if (!tr.payload) continue;
    const parsed = ConsultResultSchema.safeParse(tr.payload);
    if (parsed.success) {
      const recommendationId = parsed.data.recommendation_id;
      for (const candidate of parsed.data.candidates) {
        out.push({ candidate, recommendationId });
      }
    }
  }
  return out;
}

/**
 * Why the turn produced no candidates, for the no-result line. Scans the turn's
 * **consult** tool results (tool-name gate first, ADR-050 — a research
 * `empty_reason` uses a different vocabulary and must never reach this line;
 * then validate at this boundary, ADR-046) and returns the most actionable
 * `empty_reason`: `no_location` (the user can fix it) wins over `no_match`.
 * Returns `null` when none is present — the caller then shows a generic line.
 * Only meaningful once {@link flattenCandidates} comes back empty.
 */
export function resolveEmptyReason(
  toolResults: readonly SseToolResult[],
): ConsultEmptyReason | null {
  const reasons: ConsultEmptyReason[] = [];
  for (const tr of toolResults) {
    if (!isConsultTool(tr.tool)) continue;
    if (!tr.payload) continue;
    const parsed = ConsultResultSchema.safeParse(tr.payload);
    if (parsed.success && parsed.data.empty_reason) reasons.push(parsed.data.empty_reason);
  }
  if (reasons.length === 0) return null;
  return reasons.find((r) => r === 'no_location') ?? reasons[0];
}

/**
 * Whether the turn ran any consult-family tool at all — candidates or not.
 * Decides whether an answer-less turn still owns the place-card empty line
 * (a consult that found nothing) vs. nothing (a research/unknown-tool turn,
 * whose answer is the prose).
 */
export function hasConsultResults(toolResults: readonly SseToolResult[]): boolean {
  return toolResults.some((tr) => isConsultTool(tr.tool));
}

/**
 * Whether the turn produced at least one place candidate — the single gate for
 * the place-card surface (card + streaming skeleton, ADR-050). Everything else
 * renders as prose.
 */
export function hasPlaceCandidates(toolResults: readonly SseToolResult[]): boolean {
  return flattenCandidates(toolResults).length > 0;
}

/**
 * The localized no-result line for an {@link resolveEmptyReason} verdict.
 * `no_location` gets its own actionable copy; `no_match`, an unknown forward-compat
 * reason, and `null` all fall back to the generic line.
 */
export function emptyMessage(
  reason: ConsultEmptyReason | null,
  t: (key: string) => string,
): string {
  return reason === 'no_location'
    ? t('chat.placeCard.noLocation')
    : t('chat.placeCard.noMatch');
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


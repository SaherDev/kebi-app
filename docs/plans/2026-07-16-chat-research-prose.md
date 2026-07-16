# Bug: chat turns with tool results swallow kebi's prose answer

Handoff from the kebi (AI repo) side. This describes the problem and the required behavior — how to implement it is this repo's call.

## The problem

kebi's agent gained a fourth tool, `research` (kebi ADR-129/130, live on the AI side since 2026-07-16). It answers knowledge questions ("any tips for Vietnam?", "do I tip here?", "is My Khe safe at night?"). Like every tool, its structured payload arrives in a `tool_result` SSE frame — but the payload is a `ResearchResult` (`{entity_name, entity_key, notes: [...], empty_reason, clarification}`), **not** a `ConsultResult`, and it never contains place candidates. The user-facing answer for a research turn is the prose in the `message` frame.

The mobile chat rendering predates this tool and assumes *any* tool result means the turn's answer is a place card. Observed on device (2026-07-16, Đà Nẵng): a research turn renders the reasoning steps and then the literal line **"couldn't find a match"** — kebi's actual prose answer is streamed but never shown. This happens on **every** research turn, including fully successful ones with insider notes; the payload just isn't a consult shape, so the card logic treats it as an empty result.

## Required behavior (product decision, already made)

- The place card appears **only** when a turn actually produced place candidates (a parseable consult payload with at least one candidate). When it does, the card remains the whole answer — prose stays suppressed, exactly as today.
- On every other turn — plain chat, research/knowledge (success or empty), consult that returned nothing — **kebi's `message` prose carries the conversation** and must be rendered.
- Loading affordances shouldn't promise a place card on turns that won't produce one (a research turn shouldn't show a place-card skeleton).
- Keep a sensible fallback for the edge where a place-tool turn produced neither candidates nor prose — the existing empty-reason copy (`no_location` is actionable) still has a home there.
- Research payloads must never be misread as an empty consult result. Note the two shapes share an `empty_reason` field name with different value sets — don't match on field presence alone.

## Acceptance criteria

1. A research turn with notes + prose → the prose is shown; no card, no skeleton, no "couldn't find a match".
2. A research turn that came back empty → kebi's prose (an honest "no intel yet" / clarifying question, authored by the model) is shown, not a generic no-match line.
3. A consult turn with candidates → unchanged from today (card, skeleton while streaming, prose suppressed).
4. A consult turn with zero candidates and no prose → still surfaces the empty-reason line rather than a blank turn.
5. Verified live in the app: a knowledge question ("any tips for Da Nang?") shows prose; a place question ("coffee near me") shows the card.

## Context

The kebi side shipped its own half the same day (kebi ADR-131: research keeps the conversation's asked-about area, so "I'm in Vietnam … any tips?" researches Vietnam at country scope). No SSE contract change — `message` and `tool_result` frames are exactly as before. Record this repo's decision as an ADR per house rules.

import type { AtmosphereTag } from "./place-taxonomy.js";

/**
 * Atmosphere tag → vibe emoji, for the emoji-prefixed atmosphere chips on place
 * pages (design-system.md §Chips: `🕯️ intimate`, `💘 romantic`). Typed as
 * `Record<AtmosphereTag, string>` so it stays exhaustive against the
 * {@link AtmosphereTag} enum — a missing or extra key is a compile error.
 *
 * Mirrors {@link CATEGORY_EMOJI}: a design-system data source of truth, not a
 * backend field. Feature tags are practical attributes and carry no emoji.
 */
export const ATMOSPHERE_EMOJI: Record<AtmosphereTag, string> = {
  cozy: "🧣",
  romantic: "💘",
  trendy: "😎",
  quiet: "🤫",
  lively: "🎉",
  intimate: "🕯️",
  spacious: "🌿",
  vibrant: "🌈",
  laid_back: "🛋️",
  luxurious: "💎",
  casual: "👕",
  upscale: "🥂",
  hidden_gem: "💠",
  instagram_worthy: "📸",
  vintage: "🕰️",
  industrial: "🏭",
  minimalist: "⬜",
  bohemian: "🪶",
  traditional: "🏮",
  modern: "🏙️",
};

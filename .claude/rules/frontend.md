# Frontend Standards — Kebi

## RTL Support (not active — reserved for future Hebrew locale)

- When re-enabling Hebrew: set `dir` attribute on the `<html>` element based on locale.
- Use logical property utilities: `ms`/`me`, `ps`/`pe`, `start`/`end`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s`/`rounded-e`.
- Avoid physical direction utilities (`ml`/`mr`, `pl`/`pr`, `left`/`right`, `text-left`/`text-right`) for layout spacing and positioning.
- No RTL plugins needed — Tailwind handles this natively.

## Theming and Dark Mode

- CSS variables for all colors. Define tokens in `globals.css` using `:root` (light) and `.dark` (dark).
- Map tokens to Tailwind via `tailwind.config.js` theme extension. Semantic names: `primary`, `foreground`, `background`, `muted`, `border`, `accent`.
- `next-themes` for system preference detection and theme toggle. No custom dark mode JS.
- Components use semantic classes only (`bg-primary`, `text-foreground`). Never use raw Tailwind colors like `bg-blue-500` directly.
- To swap palette, change CSS variable values only. Components stay untouched.

## Runtime Validation

- Zod for runtime schema validation of AI responses. Each flow defines its own schema in a `*.schema.ts` file (e.g., `consult.schema.ts`, `save.schema.ts`).
- Parse AI response `data` payloads through the relevant Zod schema before passing to components. Do not trust the shape of `data` from the server.
- Shared TypeScript types in `libs/shared` remain the canonical type definitions; Zod schemas are `satisfies z.ZodType<SharedType>` to stay in sync.

## Internationalization

- `next-intl` for UI string translations. No other i18n library.
- URL-based routing: `/en/` prefix only. English is the only locale.
- All UI strings go through translation functions. Never hardcode user-facing text in components.
- Translation file: `apps/web/messages/en.json`.

/**
 * The read state of a settings form (about you, getting around) — ADR-056.
 *
 * `failed` exists so the two writable profile screens can tell "you have not
 * filled this in" apart from "we could not read what you filled in". They save
 * the block whole (an omitted field is cleared server-side), so a form that
 * rendered empty after a failed read could overwrite a real profile with blanks
 * on one tap. Only `ready` may draw inputs and a save button.
 */
export type FormStatus = 'loading' | 'ready' | 'failed';

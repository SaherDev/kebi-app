/**
 * Identifier of the background `URLSession` the share extension hands its
 * uploads to, and that the app must re-create to receive their responses.
 *
 * iOS routes a background session's completion by this string. If the extension
 * and the app disagree, the upload still happens but nobody is told the result —
 * every share sits as "still working" forever, which is the worst of both
 * worlds. The extension's copy is a literal in
 * `plugins/with-silent-share.js`; the plugin spec asserts the two match.
 *
 * Its own module so importing it costs nothing — the extension-facing storage
 * layer pulls in the native App Group bridge, which the session owner does not
 * need just to know the identifier.
 */
export const SHARE_SESSION_ID = 'app.kebi.share.upload';

/** Header the extension stamps so a delivered upload maps back to its pending record. */
export const SHARE_ID_HEADER = 'X-Kebi-Share-Id';

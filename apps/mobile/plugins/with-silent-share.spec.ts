import { SHARE_KEYS } from '../src/lib/share-storage';
import { SHARE_SESSION_ID } from '../src/lib/share-session-id';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shareViewController } = require('./with-silent-share');

/**
 * The extension's Swift is generated from a JS template, which makes two
 * failures invisible until a device rejects a request: a broken `\(…)`
 * interpolation that ships a literal "Bearer \(token)", and an App Group key
 * that drifts from the TypeScript side so the two processes write past each
 * other. Both are asserted here rather than discovered in a build.
 */
describe('generated ShareViewController.swift', () => {
  const swift: string = shareViewController('group.app.kebi');

  it('interpolates the token into the Authorization header', () => {
    expect(swift).toContain('"Bearer \\(token)"');
    // The failure mode: a literal backslash, sent verbatim as the credential.
    expect(swift).not.toContain('\\\\(token)');
  });

  it('interpolates the share id into the body filename', () => {
    expect(swift).toContain('share-\\(id).json');
  });

  it('reads and writes exactly the App Group keys the app uses', () => {
    expect(swift).toContain(`"${SHARE_KEYS.token}"`);
    expect(swift).toContain(`"${SHARE_KEYS.apiBaseUrl}"`);
    expect(swift).toContain(`"${SHARE_KEYS.pending}"`);
    expect(swift).toContain(`"${SHARE_KEYS.queue}"`);
  });

  it('uses the same background session identifier the app listens on', () => {
    // Different identifiers means iOS delivers the response to nobody and every
    // share sits as "still working" forever.
    expect(swift).toContain(`"${SHARE_SESSION_ID}"`);
  });

  it('bakes in the App Group it was configured with', () => {
    expect(swift).toContain('"group.app.kebi"');
  });

  it('never opens the host app', () => {
    // The whole point: the stock controller opens `mobile://dataUrl=…`, which
    // cold-boots the app on every share.
    expect(swift).not.toContain('openURL');
    expect(swift).not.toContain('dataUrl');
  });

  it('completes the extension request rather than lingering', () => {
    expect(swift).toContain('completeRequest');
  });

  it('uploads from a file, which is what background sessions require', () => {
    expect(swift).toContain('uploadTask(with: request, fromFile:');
    expect(swift).toContain('sharedContainerIdentifier');
  });

  it('refuses to be configured without an App Group', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const plugin = require('./with-silent-share');
    expect(() => plugin({}, { extensionName: 'SavetoKebi' })).toThrow();
    expect(() => plugin({}, { appGroup: 'group.app.kebi' })).toThrow();
  });
});

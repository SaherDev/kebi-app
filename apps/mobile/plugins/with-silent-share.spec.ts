import { SHARE_KEYS } from '../src/lib/share-storage';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shareViewController } = require('./with-silent-share');

/**
 * The extension's Swift is generated from a JS template, so an App Group key
 * that drifts from the TypeScript side would have the two processes writing
 * past each other with nothing to catch it until a device test. Asserted here
 * instead.
 */
describe('generated ShareViewController.swift', () => {
  const swift: string = shareViewController('group.app.kebi');

  it('reads and writes exactly the App Group keys the app uses', () => {
    // The extension only ever writes the queue now — the app owns everything
    // else, and a key it does not touch is a key that cannot drift.
    expect(swift).toContain(`"${SHARE_KEYS.queue}"`);
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

  it('never sends anything itself — the app drains the queue', () => {
    // The background upload was removed: on iOS 26.6 it handed uploads to the
    // system and the app was never called back. Queueing has no moving parts.
    expect(swift).not.toContain('URLSession');
    expect(swift).not.toContain('uploadTask');
    expect(swift).toContain('queue.append');
  });

  it('completes the extension request rather than lingering', () => {
    expect(swift).toContain('completeRequest');
  });

  it('fills the panel iOS presents rather than leaving it blank', () => {
    // iOS presents this view controller whether or not it draws anything. An
    // empty one reads as a glitch — a box that opened and closed and said
    // nothing — so the presentation is filled instead of fought.
    expect(swift).toContain('saving this');
    expect(swift).toContain('buildCard()');
    // Work starts in viewDidLoad: viewDidAppear fires only after the
    // presentation animation, which is exactly when the blank box was visible.
    expect(swift).toContain('override func viewDidLoad()');
    expect(swift).not.toContain('override func viewDidAppear');
  });

  it('never claims the place is saved, because at that instant it is not', () => {
    // We hold a link and have handed it to iOS. "saved" is a claim that would
    // have to be retracted in "while you were away" when a link is unsupported,
    // and that card is the only trust a silent flow has.
    expect(swift).not.toContain('"saved to kebi"');
    expect(swift).not.toMatch(/cardTitle\.text = "[^"]*\bsaved\b/);
  });

  it('refuses to be configured without an App Group', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const plugin = require('./with-silent-share');
    expect(() => plugin({}, { extensionName: 'SavetoKebi' })).toThrow();
    expect(() => plugin({}, { appGroup: 'group.app.kebi' })).toThrow();
  });
});

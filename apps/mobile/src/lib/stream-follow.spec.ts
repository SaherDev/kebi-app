import { shouldFollow, FOLLOW_THRESHOLD_PX } from './stream-follow';

describe('shouldFollow', () => {
  it('keeps following while the answer grows under a still finger', () => {
    // The regression this guards: a token lands, the content is suddenly 300px
    // taller than the viewport, and a position-only test reads that as "user
    // scrolled up" — after which the rest of the answer types out of sight.
    expect(shouldFollow({ fromBottom: 300, dragging: false, following: true })).toBe(true);
  });

  it('stops following when the user actually drags away', () => {
    expect(shouldFollow({ fromBottom: 300, dragging: true, following: true })).toBe(false);
  });

  it('re-arms as soon as the user returns to the bottom, drag or not', () => {
    expect(shouldFollow({ fromBottom: 0, dragging: true, following: false })).toBe(true);
    expect(shouldFollow({ fromBottom: 0, dragging: false, following: false })).toBe(true);
  });

  it('treats the threshold as still at the bottom', () => {
    expect(
      shouldFollow({ fromBottom: FOLLOW_THRESHOLD_PX, dragging: true, following: false }),
    ).toBe(true);
    expect(
      shouldFollow({ fromBottom: FOLLOW_THRESHOLD_PX + 1, dragging: true, following: true }),
    ).toBe(false);
  });

  it('stays away once the user has scrolled up, through later growth', () => {
    // Reading an earlier turn must not be interrupted by the stream below.
    expect(shouldFollow({ fromBottom: 900, dragging: false, following: false })).toBe(false);
  });
});

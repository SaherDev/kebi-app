import type { SavedPlaceView } from '@kebi-app/shared';
import { LIBRARY_LOOKUP_MAX_PAGES } from '../lib/library-config';
import { findSavedPlace } from './use-open-chat-venue';

const view = (id: string) => ({ place: { id }, user_data: {}, claims: [] }) as SavedPlaceView;

/** A paged library: `pages[n]` is the nth page's places. */
function pager(pages: SavedPlaceView[][]) {
  const calls: (string | undefined)[] = [];
  const fetchPage = async (cursor?: string) => {
    calls.push(cursor);
    const index = cursor ? Number(cursor) : 0;
    return {
      places: pages[index] ?? [],
      next_cursor: index + 1 < pages.length ? String(index + 1) : null,
    };
  };
  return { fetchPage, calls };
}

describe('findSavedPlace', () => {
  it('finds a place on the first page without paging further', async () => {
    const { fetchPage, calls } = pager([[view('a'), view('b')], [view('c')]]);

    await expect(findSavedPlace(fetchPage, 'b')).resolves.toMatchObject({ place: { id: 'b' } });
    expect(calls).toEqual([undefined]); // one request, no cursor follow-up
  });

  it('follows the cursor to a later page', async () => {
    const { fetchPage, calls } = pager([[view('a')], [view('b')], [view('c')]]);

    await expect(findSavedPlace(fetchPage, 'c')).resolves.toMatchObject({ place: { id: 'c' } });
    expect(calls).toEqual([undefined, '1', '2']);
  });

  it('returns null when the library runs out', async () => {
    const { fetchPage } = pager([[view('a')], [view('b')]]);
    await expect(findSavedPlace(fetchPage, 'missing')).resolves.toBeNull();
  });

  it('stops at the page cap instead of sweeping a large stash', async () => {
    // More pages than the cap; the target sits past it.
    const pages = Array.from({ length: LIBRARY_LOOKUP_MAX_PAGES + 3 }, (_, i) => [view(`p${i}`)]);
    const { fetchPage, calls } = pager(pages);

    await expect(findSavedPlace(fetchPage, `p${LIBRARY_LOOKUP_MAX_PAGES + 2}`)).resolves.toBeNull();
    expect(calls).toHaveLength(LIBRARY_LOOKUP_MAX_PAGES);
  });
});

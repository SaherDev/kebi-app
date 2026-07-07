import { detectSource, isLinkSource } from './detect-source';

describe('detectSource', () => {
  it('maps known link hosts to their PlaceSource', () => {
    expect(detectSource('https://www.tiktok.com/@x/video/1')).toBe('tiktok');
    expect(detectSource('look at instagram.com/p/abc')).toBe('instagram');
    expect(detectSource('https://youtu.be/abc')).toBe('youtube');
    expect(detectSource('https://www.youtube.com/watch?v=x')).toBe('youtube');
    expect(detectSource('https://maps.app.goo.gl/xyz')).toBe('google_maps_list');
  });

  it('falls back to manual for plain names, empty, and unknown URLs', () => {
    expect(detectSource('coco tam in koh samui')).toBe('manual');
    expect(detectSource('')).toBe('manual');
    expect(detectSource('   ')).toBe('manual');
    expect(detectSource('https://example.com/place')).toBe('manual');
  });

  it('isLinkSource is true only for detectable link sources', () => {
    expect(isLinkSource('tiktok')).toBe(true);
    expect(isLinkSource('instagram')).toBe(true);
    expect(isLinkSource('youtube')).toBe(true);
    expect(isLinkSource('google_maps_list')).toBe(true);
    expect(isLinkSource('manual')).toBe(false);
    expect(isLinkSource('kebi')).toBe(false);
  });
});

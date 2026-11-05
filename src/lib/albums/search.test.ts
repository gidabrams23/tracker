import { describe, expect, it } from 'vitest';
import { artAt } from './search';

describe('artAt', () => {
  it('resizes Apple covers', () => {
    expect(artAt('https://is1-ssl.mzstatic.com/image/thumb/Music/x/abc.jpg/600x600bb.jpg', 120)).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/Music/x/abc.jpg/120x120bb.jpg',
    );
  });
  it('resizes Deezer covers', () => {
    expect(artAt('https://cdn-images.dzcdn.net/images/cover/f798a8/1000x1000-000000-80-0-0.jpg', 200)).toBe(
      'https://cdn-images.dzcdn.net/images/cover/f798a8/200x200-000000-80-0-0.jpg',
    );
  });
  it('leaves other URLs alone', () => {
    expect(artAt('https://example.com/cover.jpg', 200)).toBe('https://example.com/cover.jpg');
    expect(artAt(undefined, 200)).toBeUndefined();
  });
});

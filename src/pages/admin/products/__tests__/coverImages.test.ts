import { describe, expect, it } from 'vitest'
import {
  coverImagesForDb,
  draftCoverImagesFromVariant,
  normalizeVariantCoverImages,
  primaryCoverFromGallery,
} from '../coverImages'

describe('normalizeVariantCoverImages', () => {
  it('reads gallery json', () => {
    expect(
      normalizeVariantCoverImages(
        [{ url: 'https://a', path: 'covers/a' }, { url: 'https://b', path: 'covers/b' }],
        null,
        null,
      ),
    ).toEqual([
      { url: 'https://a', path: 'covers/a' },
      { url: 'https://b', path: 'covers/b' },
    ])
  })

  it('falls back to legacy single cover', () => {
    expect(
      normalizeVariantCoverImages([], 'https://legacy', 'covers/legacy'),
    ).toEqual([{ url: 'https://legacy', path: 'covers/legacy' }])
  })

  it('primary sync helpers', () => {
    const gallery = coverImagesForDb([
      { url: 'https://a', path: 'a' },
      { url: 'https://b', path: 'b' },
    ])
    expect(primaryCoverFromGallery(gallery)).toEqual({ url: 'https://a', path: 'a' })
    expect(draftCoverImagesFromVariant(gallery).map((x) => x.url)).toEqual([
      'https://a',
      'https://b',
    ])
  })
})

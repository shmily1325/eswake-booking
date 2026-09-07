import { describe, expect, it } from 'vitest'
import {
  formatPantoneSelection,
  normalizePreviewHex,
  parsePantoneSelection,
} from '../pantoneSelection'

describe('Pantone selection snapshot', () => {
  it('stores the Pantone code and screen reference color together', () => {
    expect(formatPantoneSelection(' 485 c ', '#da291c')).toBe('485 C · #DA291C')
    expect(parsePantoneSelection('485 C · #DA291C')).toEqual({
      code: '485 C',
      previewHex: '#DA291C',
    })
  })

  it('rejects incomplete screen color values', () => {
    expect(normalizePreviewHex('#fff')).toBeNull()
    expect(parsePantoneSelection('485 C')).toBeNull()
  })
})

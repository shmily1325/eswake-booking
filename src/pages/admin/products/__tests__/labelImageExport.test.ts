import { describe, expect, it } from 'vitest'
import { buildLabelPngFilename } from '../labelImageExport'

describe('buildLabelPngFilename', () => {
  it('normalizes code in filename', () => {
    expect(buildLabelPngFilename('  eswb001  ')).toBe('ES-label-ESWB001.png')
  })
})

import { describe, expect, it } from 'vitest'
import { buildBoardDateEditDescription } from '../boardOperations'

describe('board operation memo wording', () => {
  it('describes general date corrections as a memo, not a renewal', () => {
    const description = buildBoardDateEditDescription({
      slotNumber: 56,
      oldStartDate: '2025-05-08',
      newStartDate: '2025-05-08',
      oldExpiresAt: '2026-05-08',
      newExpiresAt: '2027-05-08',
      memoText: '修正年份',
    })

    expect(description).toBe('置板 #56 修改：到期日 2026-05-08 → 2027-05-08（修正年份）')
    expect(description).not.toContain('續約')
  })

  it('returns no memo for an unchanged correction form', () => {
    expect(buildBoardDateEditDescription({
      slotNumber: 56,
      oldStartDate: null,
      newStartDate: null,
      oldExpiresAt: '2027-05-08',
      newExpiresAt: '2027-05-08',
    })).toBeNull()
  })

  it('keeps the established wording for a memo-only entry', () => {
    expect(buildBoardDateEditDescription({
      slotNumber: 56,
      oldStartDate: null,
      newStartDate: null,
      oldExpiresAt: null,
      newExpiresAt: null,
      memoText: '現場確認',
    })).toBe('置板 #56：現場確認')
  })
})

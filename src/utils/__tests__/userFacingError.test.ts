import { describe, it, expect, vi } from 'vitest'
import {
  userFacingError,
  isUserFacingErrorMessage,
  COACH_REPORT_USER_ERRORS,
} from '../userFacingError'

describe('userFacingError', () => {
  it('回傳白話訊息並記錄技術細節', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = userFacingError('測試', 'JWT expired', '請稍後再試')
    expect(err.message).toBe('請稍後再試')
    expect(spy).toHaveBeenCalledWith('測試', 'JWT expired')
    spy.mockRestore()
  })

  it('可辨識教練回報白話訊息', () => {
    expect(isUserFacingErrorMessage(COACH_REPORT_USER_ERRORS.loadExisting)).toBe(true)
    expect(isUserFacingErrorMessage('duplicate key value violates')).toBe(false)
  })
})

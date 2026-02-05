/**
 * participantValidation.ts 測試
 * 測試參與者驗證相關功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateParticipants,
  checkPossibleMembers,
  confirmPossibleMembers,
  calculateIsTeaching,
  calculateParticipantStatus
} from '../participantValidation'
import type { Participant, Member } from '../../types/booking'

describe('participantValidation.ts - 參與者驗證工具', () => {
  describe('validateParticipants', () => {
    it('✅ 應該通過有效的參與者列表', () => {
      const participants: Participant[] = [
        {
          participant_name: 'John',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        },
        {
          participant_name: 'Jane',
          duration_min: 30,
          member_id: 'member-1',
          lesson_type: 'designated_free',
          is_teaching: true,
          status: 'pending',
          notes: ''
        }
      ]

      const result = validateParticipants(participants)
      expect(result).toHaveLength(2)
      expect(result[0].participant_name).toBe('John')
      expect(result[1].participant_name).toBe('Jane')
    })

    it('✅ 應該過濾掉名字為空的參與者', () => {
      const participants: Participant[] = [
        {
          participant_name: 'John',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        },
        {
          participant_name: '   ',
          duration_min: 30,
          member_id: null,
          lesson_type: 'undesignated',
          is_teaching: false,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = validateParticipants(participants)
      expect(result).toHaveLength(1)
      expect(result[0].participant_name).toBe('John')
    })

    it('❌ 應該拋出錯誤：參與者不是陣列', () => {
      expect(() => validateParticipants(null as any)).toThrow('participants 必須是陣列')
      expect(() => validateParticipants(undefined as any)).toThrow('participants 必須是陣列')
      expect(() => validateParticipants({} as any)).toThrow('participants 必須是陣列')
      expect(() => validateParticipants('test' as any)).toThrow('participants 必須是陣列')
    })

    it('❌ 應該拋出錯誤：沒有參與者', () => {
      expect(() => validateParticipants([])).toThrow('請至少新增一位參與者')
    })

    it('❌ 應該拋出錯誤：所有參與者名字都是空的', () => {
      const participants: Participant[] = [
        {
          participant_name: '   ',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        },
        {
          participant_name: '',
          duration_min: 30,
          member_id: null,
          lesson_type: 'undesignated',
          is_teaching: false,
          status: 'not_applicable',
          notes: ''
        }
      ]

      expect(() => validateParticipants(participants)).toThrow('請至少新增一位參與者')
    })

    it('❌ 應該拋出錯誤：時數小於等於 0', () => {
      const participants: Participant[] = [
        {
          participant_name: 'John',
          duration_min: 0,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      expect(() => validateParticipants(participants)).toThrow('時數必須大於 0')
    })

    it('❌ 應該拋出錯誤：部分參與者時數小於等於 0', () => {
      const participants: Participant[] = [
        {
          participant_name: 'John',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        },
        {
          participant_name: 'Jane',
          duration_min: -10,
          member_id: null,
          lesson_type: 'undesignated',
          is_teaching: false,
          status: 'not_applicable',
          notes: ''
        }
      ]

      expect(() => validateParticipants(participants)).toThrow('時數必須大於 0')
    })

    it('✅ 應該保留名字有空白但不是完全空白的參與者', () => {
      const participants: Participant[] = [
        {
          participant_name: '  John  ',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = validateParticipants(participants)
      expect(result).toHaveLength(1)
      expect(result[0].participant_name).toBe('  John  ')
    })
  })

  describe('checkPossibleMembers', () => {
    const mockMembers: Member[] = [
      { id: '1', name: '張小明', nickname: '小明', phone: '0912345678' },
      { id: '2', name: '李大華', nickname: 'David', phone: '0923456789' },
      { id: '3', name: '王美麗', nickname: null, phone: '0934567890' }
    ]

    it('✅ 應該檢測到可能的會員匹配（完全匹配）', () => {
      const participants: Participant[] = [
        {
          participant_name: '小明',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = checkPossibleMembers(participants, mockMembers)
      expect(result).toHaveLength(1)
      expect(result[0].inputName).toBe('小明')
      expect(result[0].matches).toContain('小明')
    })

    it('✅ 應該檢測到可能的會員匹配（部分匹配 nickname）', () => {
      const participants: Participant[] = [
        {
          participant_name: '小',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = checkPossibleMembers(participants, mockMembers)
      expect(result).toHaveLength(1)
      expect(result[0].matches).toContain('小明')
    })

    it('✅ 應該檢測到可能的會員匹配（不分大小寫）', () => {
      const participants: Participant[] = [
        {
          participant_name: 'david',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = checkPossibleMembers(participants, mockMembers)
      expect(result).toHaveLength(1)
      expect(result[0].matches).toContain('David')
    })

    it('✅ 應該使用 name 當 nickname 為 null', () => {
      const participants: Participant[] = [
        {
          participant_name: '王美麗',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = checkPossibleMembers(participants, mockMembers)
      expect(result).toHaveLength(1)
      expect(result[0].matches).toContain('王美麗')
    })

    it('✅ 已選擇會員的參與者不應該被檢測', () => {
      const participants: Participant[] = [
        {
          participant_name: '小明',
          duration_min: 60,
          member_id: '1',
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'pending',
          notes: ''
        }
      ]

      const result = checkPossibleMembers(participants, mockMembers)
      expect(result).toHaveLength(0)
    })

    it('✅ 沒有匹配的會員時應該返回空陣列', () => {
      const participants: Participant[] = [
        {
          participant_name: '陳小華',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = checkPossibleMembers(participants, mockMembers)
      expect(result).toHaveLength(0)
    })

    it('✅ 應該檢測到多個可能的會員匹配', () => {
      const members: Member[] = [
        { id: '1', name: '張小明', nickname: '小明', phone: '0912345678' },
        { id: '2', name: '張小華', nickname: '小華', phone: '0923456789' }
      ]

      const participants: Participant[] = [
        {
          participant_name: '小',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }
      ]

      const result = checkPossibleMembers(participants, members)
      expect(result).toHaveLength(1)
      expect(result[0].matches).toHaveLength(2)
      expect(result[0].matches).toContain('小明')
      expect(result[0].matches).toContain('小華')
    })

    it('❌ 應該拋出錯誤：participants 不是陣列', () => {
      expect(() => checkPossibleMembers(null as any, mockMembers)).toThrow('participants 必須是陣列')
      expect(() => checkPossibleMembers(undefined as any, mockMembers)).toThrow('participants 必須是陣列')
    })

    it('❌ 應該拋出錯誤：members 不是陣列', () => {
      const participants: Participant[] = []
      expect(() => checkPossibleMembers(participants, null as any)).toThrow('members 必須是陣列')
      expect(() => checkPossibleMembers(participants, undefined as any)).toThrow('members 必須是陣列')
    })

    it('✅ 空的參與者或會員列表應該返回空陣列', () => {
      expect(checkPossibleMembers([], mockMembers)).toHaveLength(0)
      expect(checkPossibleMembers(
        [{
          participant_name: '測試',
          duration_min: 60,
          member_id: null,
          lesson_type: 'designated_paid',
          is_teaching: true,
          status: 'not_applicable',
          notes: ''
        }],
        []
      )).toHaveLength(0)
    })
  })

  describe('confirmPossibleMembers', () => {
    let confirmSpy: any

    beforeEach(() => {
      // 清除之前的 spy
      if (confirmSpy) {
        confirmSpy.mockRestore()
      }
      confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)
    })

    it('✅ 應該顯示正確的確認訊息', () => {
      confirmSpy.mockClear()
      confirmSpy.mockReturnValue(true)

      const possibleMembers = [
        { inputName: '小明', matches: ['張小明'] }
      ]

      confirmPossibleMembers(possibleMembers)

      expect(confirmSpy).toHaveBeenCalled()
      const message = confirmSpy.mock.calls[0][0]
      expect(message).toContain('⚠️ 偵測到以下參與者可能是會員')
      expect(message).toContain('"小明"')
      expect(message).toContain('張小明')
    })

    it('✅ 應該返回用戶的選擇（確認）', () => {
      confirmSpy.mockClear()
      confirmSpy.mockReturnValue(true)

      const possibleMembers = [
        { inputName: '小明', matches: ['張小明'] }
      ]

      const result = confirmPossibleMembers(possibleMembers)
      expect(result).toBe(true)
    })

    it('✅ 應該返回用戶的選擇（取消）', () => {
      confirmSpy.mockClear()
      confirmSpy.mockReturnValue(false)

      const possibleMembers = [
        { inputName: '小明', matches: ['張小明'] }
      ]

      const result = confirmPossibleMembers(possibleMembers)
      expect(result).toBe(false)
    })

    it('✅ 應該正確顯示多個匹配的會員', () => {
      confirmSpy.mockClear()
      confirmSpy.mockReturnValue(true)

      const possibleMembers = [
        { inputName: '小', matches: ['小明', '小華'] }
      ]

      const result = confirmPossibleMembers(possibleMembers)

      expect(result).toBe(true)
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      const message = confirmSpy.mock.calls[0][0]
      expect(message).toContain('⚠️ 偵測到以下參與者可能是會員')
      expect(message).toContain('"小"')
      expect(message).toContain('可能是會員：小明、小華')
    })

    it('✅ 應該正確顯示多個參與者', () => {
      confirmSpy.mockClear()
      confirmSpy.mockReturnValue(false)

      const possibleMembers = [
        { inputName: '小明', matches: ['張小明'] },
        { inputName: 'David', matches: ['李大華'] }
      ]

      const result = confirmPossibleMembers(possibleMembers)

      expect(result).toBe(false)
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      const message = confirmSpy.mock.calls[0][0]
      // 驗證兩個參與者都出現在訊息中
      expect(message).toContain('"小明" 可能是會員：張小明')
      expect(message).toContain('"David" 可能是會員：李大華')
    })

    it('❌ 應該拋出錯誤：possibleMembers 不是陣列', () => {
      expect(() => confirmPossibleMembers(null as any)).toThrow('possibleMembers 必須是陣列')
      expect(() => confirmPossibleMembers(undefined as any)).toThrow('possibleMembers 必須是陣列')
      expect(() => confirmPossibleMembers({} as any)).toThrow('possibleMembers 必須是陣列')
    })
  })

  describe('calculateIsTeaching', () => {
    it('✅ designated_paid 應該計入教學時數', () => {
      expect(calculateIsTeaching('designated_paid')).toBe(true)
    })

    it('✅ designated_free 應該計入教學時數', () => {
      expect(calculateIsTeaching('designated_free')).toBe(true)
    })

    it('✅ undesignated 不應該計入教學時數', () => {
      expect(calculateIsTeaching('undesignated')).toBe(false)
    })

    it('✅ 彈簧床：不管什麼類型都計入教學時數', () => {
      expect(calculateIsTeaching('undesignated', '彈簧床')).toBe(true)
      expect(calculateIsTeaching('designated_paid', '彈簧床')).toBe(true)
      expect(calculateIsTeaching('designated_free', '彈簧床')).toBe(true)
    })

    it('✅ 彈簧床：名稱包含「彈簧床」即可', () => {
      expect(calculateIsTeaching('undesignated', '彈簧床01')).toBe(true)
      expect(calculateIsTeaching('undesignated', '室內彈簧床')).toBe(true)
    })

    it('✅ 非彈簧床：undesignated 不計入教學時數', () => {
      expect(calculateIsTeaching('undesignated', 'G23')).toBe(false)
      expect(calculateIsTeaching('undesignated', 'SUP板')).toBe(false)
    })

    it('❌ 應該拋出錯誤：lessonType 不是字串', () => {
      expect(() => calculateIsTeaching(null as any)).toThrow('lessonType 必須是字串')
      expect(() => calculateIsTeaching(undefined as any)).toThrow('lessonType 必須是字串')
      expect(() => calculateIsTeaching(123 as any)).toThrow('lessonType 必須是字串')
      expect(() => calculateIsTeaching({} as any)).toThrow('lessonType 必須是字串')
    })

    it('✅ 空字串 lessonType 應該返回 false', () => {
      expect(calculateIsTeaching('')).toBe(false)
    })

    it('✅ 未知的 lessonType 應該返回 false', () => {
      expect(calculateIsTeaching('unknown')).toBe(false)
      expect(calculateIsTeaching('other')).toBe(false)
    })
  })

  describe('calculateParticipantStatus', () => {
    it('✅ 有會員 ID 應該返回 pending', () => {
      const result = calculateParticipantStatus('member-123')
      expect(result).toBe('pending')
    })

    it('✅ 沒有會員 ID 應該返回 not_applicable', () => {
      const result = calculateParticipantStatus(null)
      expect(result).toBe('not_applicable')
    })

    it('✅ 空字串會員 ID 應該返回 not_applicable', () => {
      const result = calculateParticipantStatus('')
      expect(result).toBe('not_applicable')
    })

    it('✅ 任何非空字串會員 ID 都應該返回 pending', () => {
      expect(calculateParticipantStatus('1')).toBe('pending')
      expect(calculateParticipantStatus('abc')).toBe('pending')
      expect(calculateParticipantStatus('uuid-123-456')).toBe('pending')
    })
  })
})

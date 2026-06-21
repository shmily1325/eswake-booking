import { describe, it, expect } from 'vitest'
import {
  memberIdsMatchingKeyword,
  formatSelectedMemberHint,
} from '../searchBookingMemberQuery'

const members = [
  { id: 'a', name: '王小明', nickname: '小明', phone: '0911111111' },
  { id: 'b', name: '王小明', nickname: null, phone: '0922222222' },
  { id: 'c', name: '李大華', nickname: 'David', phone: '0933333333' },
]

describe('memberIdsMatchingKeyword', () => {
  it('依姓名匹配（可有多筆同名）', () => {
    expect(memberIdsMatchingKeyword(members, '王小明')).toEqual(['a', 'b'])
  })

  it('依暱稱匹配', () => {
    expect(memberIdsMatchingKeyword(members, 'David')).toEqual(['c'])
  })

  it('依電話匹配', () => {
    expect(memberIdsMatchingKeyword(members, '0911')).toEqual(['a'])
  })

  it('空關鍵字回傳空陣列', () => {
    expect(memberIdsMatchingKeyword(members, '  ')).toEqual([])
  })
})

describe('formatSelectedMemberHint', () => {
  it('有暱稱時顯示暱稱與本名', () => {
    expect(formatSelectedMemberHint(members[0])).toBe('小明（王小明）')
  })

  it('無暱稱時只顯示姓名', () => {
    expect(formatSelectedMemberHint(members[1])).toBe('王小明')
  })
})

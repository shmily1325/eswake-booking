import { describe, it, expect } from 'vitest'
import {
  memberIdsMatchingKeyword,
  formatSelectedMemberHint,
  parseNotesSearchKeywords,
  escapeIlikePattern,
  notesContainAllKeywords,
  splitTextByKeywords,
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

describe('parseNotesSearchKeywords', () => {
  it('空白分隔多個關鍵字並 trim', () => {
    expect(parseNotesSearchKeywords('  Dexter   ZOE  ')).toEqual(['Dexter', 'ZOE'])
  })

  it('空字串回傳空陣列', () => {
    expect(parseNotesSearchKeywords('   ')).toEqual([])
  })

  it('保留 + 等符號為單一關鍵字', () => {
    expect(parseNotesSearchKeywords('dexter+zoe')).toEqual(['dexter+zoe'])
  })
})

describe('escapeIlikePattern', () => {
  it('跳脫 % 與 _', () => {
    expect(escapeIlikePattern('100%_off')).toBe('100\\%\\_off')
  })
})

describe('notesContainAllKeywords', () => {
  it('不分大小寫匹配單一關鍵字', () => {
    expect(notesContainAllKeywords('Dexter+澤澤-ED', ['dexter'])).toBe(true)
    expect(notesContainAllKeywords('DEXTER', ['Dexter'])).toBe(true)
  })

  it('多關鍵字需全部出現', () => {
    expect(notesContainAllKeywords('dexter+zoe', ['dexter', 'zoe'])).toBe(true)
    expect(notesContainAllKeywords('DEXTER only', ['dexter', 'zoe'])).toBe(false)
  })

  it('無關鍵字時一律通過', () => {
    expect(notesContainAllKeywords(null, [])).toBe(true)
    expect(notesContainAllKeywords('anything', [])).toBe(true)
  })

  it('有關鍵字但註解為空則不通過', () => {
    expect(notesContainAllKeywords(null, ['zoe'])).toBe(false)
    expect(notesContainAllKeywords('', ['zoe'])).toBe(false)
  })
})

describe('splitTextByKeywords', () => {
  it('高亮不分大小寫的命中片段', () => {
    expect(splitTextByKeywords('Dexter+ZOE-ED', ['zoe', 'dexter'])).toEqual([
      { text: 'Dexter', match: true },
      { text: '+', match: false },
      { text: 'ZOE', match: true },
      { text: '-ED', match: false },
    ])
  })
})

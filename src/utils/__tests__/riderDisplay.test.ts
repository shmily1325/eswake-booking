import { describe, expect, it } from 'vitest'
import {
  appendActualRiderSeparator,
  formatActualRider,
  getActualRiderGroupKey,
  normalizeActualRiderForSave,
  parseActualRiders,
} from '../riderDisplay'

describe('riderDisplay', () => {
  it('統一不同分隔符並移除重複姓名', () => {
    expect(parseActualRiders(' 澤 + 甯，澤 / Zoe ')).toEqual(['澤', '甯', 'Zoe'])
    expect(formatActualRider(' 澤 + 甯，澤 / Zoe ')).toBe('澤＋甯＋Zoe')
  })

  it('空白內容儲存為 null', () => {
    expect(normalizeActualRiderForSave('   ')).toBeNull()
  })

  it('分組不受姓名順序影響，但不猜測相似名字', () => {
    expect(getActualRiderGroupKey('澤＋甯')).toBe(getActualRiderGroupKey('甯+澤'))
    expect(getActualRiderGroupKey('澤')).not.toBe(getActualRiderGroupKey('澤澤'))
  })

  it('加號按鈕加入全形分隔符', () => {
    expect(appendActualRiderSeparator('澤')).toBe('澤＋')
    expect(appendActualRiderSeparator('澤＋')).toBe('澤＋')
  })
})

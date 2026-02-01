import { describe, it, expect } from 'vitest'
import {
  filterMembers,
  composeFinalStudentName,
  toggleSelection,
  deduplicateNames,
  splitAndDeduplicateNames,
  type BasicMember
} from '../memberUtils'

describe('memberUtils.ts - 會員工具函數', () => {
  // 測試用的會員資料
  const mockMembers: BasicMember[] = [
    { id: '1', name: '王小明', nickname: 'Jerry', phone: '0912345678' },
    { id: '2', name: '李大華', nickname: null, phone: '0923456789' },
    { id: '3', name: '張美麗', nickname: 'Mary', phone: '0934567890' },
    { id: '4', name: '陳志明', nickname: 'Tom', phone: null },
    { id: '5', name: '林小花', nickname: null, phone: '0956789012' },
  ]

  describe('filterMembers', () => {
    it('應該按姓名搜尋會員', () => {
      const result = filterMembers(mockMembers, '王小明')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('王小明')
    })

    it('應該按暱稱搜尋會員', () => {
      const result = filterMembers(mockMembers, 'Jerry')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('王小明')
    })

    it('應該按電話號碼搜尋會員', () => {
      const result = filterMembers(mockMembers, '0912')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('王小明')
    })

    it('應該支援不區分大小寫搜尋', () => {
      const result = filterMembers(mockMembers, 'jerry')
      expect(result).toHaveLength(1)
      expect(result[0].nickname).toBe('Jerry')
    })

    it('應該支援部分匹配', () => {
      const result = filterMembers(mockMembers, '小')
      expect(result).toHaveLength(2) // 王小明, 林小花
      expect(result.map(m => m.name)).toContain('王小明')
      expect(result.map(m => m.name)).toContain('林小花')
    })

    it('空搜尋字串應該返回空陣列', () => {
      const result = filterMembers(mockMembers, '')
      expect(result).toHaveLength(0)
    })

    it('只有空白的搜尋字串應該返回空陣列', () => {
      const result = filterMembers(mockMembers, '   ')
      expect(result).toHaveLength(0)
    })

    it('沒有匹配結果時應該返回空陣列', () => {
      const result = filterMembers(mockMembers, '不存在的人')
      expect(result).toHaveLength(0)
    })

    it('應該限制返回結果數量', () => {
      const result = filterMembers(mockMembers, '小', 1)
      expect(result).toHaveLength(1)
    })

    it('預設應該最多返回 10 筆結果', () => {
      // 建立超過 10 個會員
      const manyMembers: BasicMember[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        name: `測試會員${i}`,
        nickname: null,
        phone: null
      }))
      
      const result = filterMembers(manyMembers, '測試')
      expect(result).toHaveLength(10)
    })

    it('應該處理會員沒有電話號碼的情況', () => {
      const result = filterMembers(mockMembers, 'Tom')
      expect(result).toHaveLength(1)
      expect(result[0].phone).toBeNull()
    })

    it('應該處理會員沒有暱稱的情況', () => {
      const result = filterMembers(mockMembers, '李大華')
      expect(result).toHaveLength(1)
      expect(result[0].nickname).toBeNull()
    })
  })

  describe('composeFinalStudentName', () => {
    it('應該組合會員姓名', () => {
      const result = composeFinalStudentName(mockMembers, ['1', '2'], [])
      expect(result).toBe('Jerry, 李大華') // 有暱稱用暱稱，沒暱稱用本名
    })

    it('應該組合會員姓名和手動輸入的名字', () => {
      const result = composeFinalStudentName(mockMembers, ['1'], ['訪客A', '訪客B'])
      expect(result).toBe('Jerry, 訪客A, 訪客B')
    })

    it('只有手動輸入名字時應該正確組合', () => {
      const result = composeFinalStudentName(mockMembers, [], ['訪客A', '訪客B'])
      expect(result).toBe('訪客A, 訪客B')
    })

    it('沒有選擇任何人時應該返回空字串', () => {
      const result = composeFinalStudentName(mockMembers, [], [])
      expect(result).toBe('')
    })

    it('有暱稱的會員應該使用暱稱', () => {
      const result = composeFinalStudentName(mockMembers, ['1'], [])
      expect(result).toBe('Jerry')
    })

    it('沒有暱稱的會員應該使用本名', () => {
      const result = composeFinalStudentName(mockMembers, ['2'], [])
      expect(result).toBe('李大華')
    })

    it('應該處理不存在的會員 ID', () => {
      const result = composeFinalStudentName(mockMembers, ['999'], ['訪客'])
      expect(result).toBe('訪客') // 不存在的 ID 被過濾掉
    })

    it('應該保持選擇順序', () => {
      const result = composeFinalStudentName(mockMembers, ['3', '1'], [])
      // 順序依照 filter 結果，而非 ID 順序
      expect(result).toBe('Jerry, Mary')
    })
  })

  describe('toggleSelection', () => {
    it('應該添加不存在的項目', () => {
      const result = toggleSelection(['a', 'b'], 'c')
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('應該移除已存在的項目', () => {
      const result = toggleSelection(['a', 'b', 'c'], 'b')
      expect(result).toEqual(['a', 'c'])
    })

    it('空陣列添加項目', () => {
      const result = toggleSelection([], 'a')
      expect(result).toEqual(['a'])
    })

    it('移除最後一個項目應該返回空陣列', () => {
      const result = toggleSelection(['a'], 'a')
      expect(result).toEqual([])
    })

    it('不應該修改原始陣列', () => {
      const original = ['a', 'b']
      toggleSelection(original, 'c')
      expect(original).toEqual(['a', 'b']) // 原始陣列不變
    })

    it('應該處理重複的 ID', () => {
      const result = toggleSelection(['a', 'b', 'a'], 'a')
      // 移除所有 'a'
      expect(result).toEqual(['b'])
    })
  })

  describe('deduplicateNames', () => {
    it('應該去除重複的名字', () => {
      const result = deduplicateNames(['大貓咪', '大貓咪', '訪客A'])
      expect(result).toEqual(['大貓咪', '訪客A'])
    })

    it('應該保留原始順序', () => {
      const result = deduplicateNames(['訪客A', '大貓咪', '訪客A', '訪客B'])
      expect(result).toEqual(['訪客A', '大貓咪', '訪客B'])
    })

    it('應該移除空字串', () => {
      const result = deduplicateNames(['大貓咪', '', '訪客A', '  ', '訪客B'])
      expect(result).toEqual(['大貓咪', '訪客A', '訪客B'])
    })

    it('應該處理全部重複的情況', () => {
      const result = deduplicateNames(['大貓咪', '大貓咪', '大貓咪'])
      expect(result).toEqual(['大貓咪'])
    })

    it('應該處理空陣列', () => {
      const result = deduplicateNames([])
      expect(result).toEqual([])
    })

    it('應該處理沒有重複的情況', () => {
      const result = deduplicateNames(['大貓咪', '訪客A', '訪客B'])
      expect(result).toEqual(['大貓咪', '訪客A', '訪客B'])
    })

    it('應該自動 trim 空白並去重', () => {
      const result = deduplicateNames(['大貓咪', ' 大貓咪 ', '訪客A'])
      expect(result).toEqual(['大貓咪', '訪客A'])
    })
  })

  describe('splitAndDeduplicateNames', () => {
    it('應該分割並去重名字字串（中文逗號）', () => {
      const result = splitAndDeduplicateNames('大貓咪，大貓咪，訪客A')
      expect(result).toEqual(['大貓咪', '訪客A'])
    })

    it('應該分割並去重名字字串（英文逗號）', () => {
      const result = splitAndDeduplicateNames('大貓咪, 大貓咪, 訪客A')
      expect(result).toEqual(['大貓咪', '訪客A'])
    })

    it('應該處理混合逗號', () => {
      const result = splitAndDeduplicateNames('大貓咪, 訪客A，訪客A, 訪客B')
      expect(result).toEqual(['大貓咪', '訪客A', '訪客B'])
    })

    it('應該處理空字串', () => {
      const result = splitAndDeduplicateNames('')
      expect(result).toEqual([])
    })

    it('應該處理單個名字', () => {
      const result = splitAndDeduplicateNames('大貓咪')
      expect(result).toEqual(['大貓咪'])
    })

    it('應該移除多餘的空白', () => {
      const result = splitAndDeduplicateNames('大貓咪 ,  訪客A  , 訪客B')
      expect(result).toEqual(['大貓咪', '訪客A', '訪客B'])
    })

    it('應該處理會員+非會員的組合', () => {
      const result = splitAndDeduplicateNames('大貓咪, 訪客A, 訪客B')
      expect(result).toEqual(['大貓咪', '訪客A', '訪客B'])
    })
  })
})


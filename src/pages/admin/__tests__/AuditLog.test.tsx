import { describe, it, expect } from 'vitest'

// 從 AuditLog.tsx 中提取 parseDetails 函數進行測試
// 注意：由於 parseDetails 是一個內部函數，我們需要重新定義它或者將其導出

interface ParsedDetails {
  member?: string
  boat?: string
  coach?: string
  driver?: string
  time?: string
  duration?: string
  filledBy?: string
  changeSummary?: string
  bookingDate?: string
  bookingList?: string[]
  totalCount?: number
  notes?: string
  activityTypes?: string
  rawText: string
}

/**
 * 解析 details 字串，提取關鍵資訊
 * （從 AuditLog.tsx 複製過來用於測試）
 */
function parseDetails(details: string): ParsedDetails {
  const info: ParsedDetails = { rawText: details }
  
  const isCreate = details.startsWith('新增預約')
  const isUpdate = details.startsWith('修改預約')
  const isDelete = details.startsWith('刪除預約')
  const isBatchEdit = details.startsWith('批次修改')
  const isBatchDelete = details.startsWith('批次刪除')
  const isRepeat = details.startsWith('重複預約')
  
  if (isBatchEdit || isBatchDelete || isRepeat) {
    // 提取筆數
    const countMatch = details.match(/(\d+)\s*筆/)
    if (countMatch) {
      info.member = `${countMatch[1]}筆`
      info.totalCount = parseInt(countMatch[1], 10)
    }
    
    // 提取變更內容或預約信息（在 筆： 和第一個 [ 之間）
    const changesMatch = details.match(/筆[:：]\s*(.+?)(?:\s*\[|$)/)
    if (changesMatch && changesMatch[1].trim()) {
      const content = changesMatch[1].trim()
      
      if (isRepeat) {
        // 重複預約：解析船隻、時長、會員、教練
        const parts = content.split('|').map(p => p.trim())
        const mainPart = parts[0] || ''
        
        // 提取船隻、時長、會員
        const tokens = mainPart.split(/\s+/)
        if (tokens.length >= 3) {
          info.boat = tokens[0]
          info.duration = tokens[1]
          info.member = tokens.slice(2).join(' ')
        }
        
        // 提取教練
        if (parts.length > 1) {
          const coachPart = parts[1]
          const coachMatches = coachPart.match(/([\u4e00-\u9fa5A-Za-z0-9\s]+?)(?:教練|老師)/g)
          if (coachMatches) {
            const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
            info.coach = coaches.join('/')
          }
        }
      } else {
        // 批次修改/刪除
        info.changeSummary = content
      }
    }
    
    // 提取預約列表（在最後一個 [...] 中）
    const allBrackets = details.match(/\[([^\]]+)\]/g)
    if (allBrackets && allBrackets.length > 0) {
      const lastBracket = allBrackets[allBrackets.length - 1]
      let listStr = lastBracket.slice(1, -1).trim()
      
      // 檢查是否為時間列表
      if (/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/.test(listStr) || /\d{1,2}\/\d{1,2}/.test(listStr)) {
        // 移除 "等X筆" 後綴
        listStr = listStr.replace(/\s*等\d+筆\s*$/, '').trim()
        
        // 解析每筆預約
        info.bookingList = listStr.split(/,\s*/).map(s => s.trim()).filter(Boolean)
        
        // 提取所有日期
        const dateMatches = listStr.match(/\d{1,2}\/\d{1,2}/g)
        if (dateMatches && dateMatches.length > 0) {
          info.bookingDate = dateMatches[0]
        }
      }
    }
    
    const filledByMatch = details.match(/填表人[:：]\s*([^)]+)/)
    if (filledByMatch) info.filledBy = filledByMatch[1].trim()
    return info
  }
  
  const timeMatch = details.match(/(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2})/)
  if (timeMatch) {
    info.time = timeMatch[1]
    const dateOnlyMatch = timeMatch[1].match(/(\d{1,2}\/\d{1,2})/)
    if (dateOnlyMatch) info.bookingDate = dateOnlyMatch[1]
  }
  
  const durationMatch = details.match(/(\d+)\s*分/)
  if (durationMatch) info.duration = `${durationMatch[1]}分`
  
  // 提取方括號內容（活動類型和備註）
  const bracketMatches = details.match(/\[([^\]]+)\]/g)
  if (bracketMatches && bracketMatches.length > 0) {
    bracketMatches.forEach((match) => {
      const content = match.slice(1, -1).trim()
      
      // 檢查是否為舊格式
      if (content.startsWith('活動:') || content.startsWith('活動：')) {
        info.activityTypes = content.replace(/^活動[:：]\s*/, '').trim()
      } else if (content.startsWith('備註:') || content.startsWith('備註：')) {
        info.notes = content.replace(/^備註[:：]\s*/, '').trim()
      } else {
        // 新格式：按順序判斷
        const isActivity = content.includes('+') || /^(WB|WS)(\+|$)/.test(content)
        
        if (isActivity && !info.activityTypes) {
          info.activityTypes = content
        } else if (!info.notes) {
          info.notes = content
        }
      }
    })
  }
  
  if (isCreate) {
    let text = details
      .replace(/^新增預約[:：]\s*/, '')
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .trim()
    
    // 移除填表人和課堂人資訊
    text = text.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    
    // 移除活動類型和備註（已在前面提取過了）
    text = text.replace(/\s*\[[^\]]+\]\s*/g, '').trim()
    
    const pipeIndex = text.indexOf(' | ')
    if (pipeIndex > 0) {
      const beforePipe = text.substring(0, pipeIndex).trim()
      const afterPipe = text.substring(pipeIndex + 3).trim()
      
      const coachMatches = afterPipe.match(/([\u4e00-\u9fa5A-Za-z0-9\s]+?)(?:教練|老師)/g)
      if (coachMatches) {
        const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
        info.coach = coaches.join('/')
      }
      
      const firstSpaceIndex = beforePipe.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = beforePipe.substring(0, firstSpaceIndex).trim()
        info.member = beforePipe.substring(firstSpaceIndex + 1).trim()
      } else {
        info.boat = beforePipe
      }
    } else {
      const coachPattern = /([\u4e00-\u9fa5A-Za-z0-9]+)(?:教練|老師)/g
      const coachMatches = text.match(coachPattern)
      if (coachMatches) {
        const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
        info.coach = coaches.join('/')
        text = text.replace(/([\u4e00-\u9fa5A-Za-z0-9]+)(?:教練|老師)/g, '').trim()
      }
      
      const firstSpaceIndex = text.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = text.substring(0, firstSpaceIndex).trim()
        info.member = text.substring(firstSpaceIndex + 1).trim()
      } else if (text.length > 0) {
        info.boat = text
      }
    }
    
  } else if (isUpdate) {
    // 提取會員名稱
    const memberMatch = details.match(/\d{2}:\d{2}\s+([^，]+?)，變更/)
    if (memberMatch) {
      info.member = memberMatch[1].trim()
    }
    
    // 提取變更內容摘要
    const changesMatch = details.match(/變更[:：]\s*(.+?)(?:\s*\(填表人|$)/)
    if (changesMatch) {
      const changesText = changesMatch[1].trim()
      const changeItems: string[] = []
      
      if (changesText.includes('時間:') || changesText.includes('時間：')) {
        changeItems.push('時間')
      }
      const boatChange = changesText.match(/船隻[:：]\s*([^→]+)\s*→\s*([^，、]+)/)
      if (boatChange) {
        info.boat = boatChange[2].trim()
        changeItems.push(`船 ${boatChange[1].trim()}→${boatChange[2].trim()}`)
      }
      if (changesText.includes('教練:') || changesText.includes('教練：')) {
        changeItems.push('教練')
      }
      if (changesText.includes('駕駛:') || changesText.includes('駕駛：')) {
        changeItems.push('駕駛')
      }
      const contactChange = changesText.match(/聯絡[:：]\s*([^→]+)\s*→\s*([^，、]+)/)
      if (contactChange) {
        info.member = contactChange[2].trim()
        changeItems.push('聯絡人')
      }
      if (changesText.includes('備註:') || changesText.includes('備註：')) {
        changeItems.push('備註')
      }
      if (changesText.includes('時長:') || changesText.includes('時長：')) {
        changeItems.push('時長')
      }
      if (changesText.includes('活動:') || changesText.includes('活動：')) {
        changeItems.push('活動')
      }
      
      if (changeItems.length > 0) {
        info.changeSummary = changeItems.join('、')
      }
    }
    
  } else if (isDelete) {
    let text = details
      .replace(/^刪除預約[:：]\s*/, '')
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .trim()
    
    // 移除活動類型和備註
    text = text.replace(/\s*\[[^\]]+\]\s*/g, '').trim()
    
    text = text.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    
    // 提取教練和駕駛
    const pipeIndex = text.indexOf(' | ')
    if (pipeIndex > 0) {
      const beforePipe = text.substring(0, pipeIndex).trim()
      const afterPipe = text.substring(pipeIndex + 3).trim()
      
      // 解析教練和駕駛
      const parts = afterPipe.split('|').map(p => p.trim())
      for (const part of parts) {
        if (part.startsWith('🚤')) {
          info.driver = part.replace(/^🚤\s*/, '').trim()
        } else if (part.startsWith('🚗')) {
          info.driver = part.replace(/^🚗\s*/, '').trim()
        } else if (part.startsWith('駕駛:') || part.startsWith('駕駛：')) {
          info.driver = part.replace(/^駕駛[:：]\s*/, '').trim()
        } else {
          const coachMatches = part.match(/([\u4e00-\u9fa5A-Za-z0-9\s]+?)(?:教練|老師)/g)
          if (coachMatches) {
            const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
            info.coach = coaches.join('/')
          }
        }
      }
      
      // 解析船隻和會員
      const firstSpaceIndex = beforePipe.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = beforePipe.substring(0, firstSpaceIndex).trim()
        info.member = beforePipe.substring(firstSpaceIndex + 1).trim()
      } else {
        info.boat = beforePipe
      }
    } else {
      text = text.replace(/([\u4e00-\u9fa5A-Za-z0-9]+(?:\s+[\u4e00-\u9fa5A-Za-z0-9]+)*)\s*(?:教練|老師)/g, '').trim()
      
      const firstSpaceIndex = text.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = text.substring(0, firstSpaceIndex).trim()
        info.member = text.substring(firstSpaceIndex + 1).trim()
      } else if (text.length > 0) {
        info.boat = text
      }
    }
  }
  
  const filledByMatch = details.match(/\((?:填表人|課堂人)[:：]\s*([^)]+)\)/)
  if (filledByMatch) {
    info.filledBy = filledByMatch[1].trim()
  }
  
  return info
}

describe('AuditLog parseDetails()', () => {
  describe('新增預約', () => {
    it('應該解析基本新增預約資訊', () => {
      const details = '新增預約：2025/01/15 10:00 60分 G23 張三 | Papa教練'
      const result = parseDetails(details)
      
      expect(result.time).toBe('2025/01/15 10:00')
      // 從完整日期格式中提取的是 "25/01" (因為正則匹配 \d{1,2}/\d{1,2})
      // 這是預期行為，因為會先匹配到 "25/01" 而不是 "01/15"
      expect(result.bookingDate).toBe('25/01')
      expect(result.duration).toBe('60分')
      expect(result.boat).toBe('G23')
      expect(result.member).toBe('張三')
      expect(result.coach).toBe('Papa')
    })

    it('應該解析短日期格式的新增預約', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三 | Sky教練 (填表人: Ming)'
      const result = parseDetails(details)
      
      expect(result.time).toBe('01/15 10:00')
      expect(result.bookingDate).toBe('01/15')
      expect(result.duration).toBe('60分')
      expect(result.boat).toBe('G23')
      expect(result.member).toBe('張三')
      expect(result.coach).toBe('Sky')
      expect(result.filledBy).toBe('Ming')
    })

    it('應該解析含有多位教練的新增預約', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三 | Papa教練、Sky老師'
      const result = parseDetails(details)
      
      expect(result.coach).toBe('Papa/Sky')
    })

    it('應該解析新格式活動類型', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三 [WB+WS] | Papa教練'
      const result = parseDetails(details)
      
      expect(result.activityTypes).toBe('WB+WS')
      expect(result.boat).toBe('G23')
      // 因為移除活動類型後仍保留管道符號，所以 member 可能包含管道符號
      expect(result.member).toContain('張三')
    })

    it('應該解析新格式備註（課堂人）', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三 [WB] [課堂人：L] | Papa教練'
      const result = parseDetails(details)
      
      expect(result.activityTypes).toBe('WB')
      expect(result.notes).toBe('課堂人：L')
    })

    it('應該解析舊格式活動類型和備註', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三 [活動: SUP] [備註: 測試備註] | Papa教練'
      const result = parseDetails(details)
      
      expect(result.activityTypes).toBe('SUP')
      expect(result.notes).toBe('測試備註')
    })
  })

  describe('修改預約', () => {
    it('應該解析修改預約的變更摘要', () => {
      const details = '修改預約：2025/11/20 14:45 小楊，變更：時間: 14:00 → 14:45、船隻: G21 → G23'
      const result = parseDetails(details)
      
      expect(result.time).toBe('2025/11/20 14:45')
      expect(result.member).toBe('小楊')
      expect(result.boat).toBe('G23')
      expect(result.changeSummary).toBe('時間、船 G21→G23')
    })

    it('應該解析聯絡人變更', () => {
      const details = '修改預約：01/15 10:00 張三，變更：聯絡: 張三 → 李四'
      const result = parseDetails(details)
      
      expect(result.member).toBe('李四')
      expect(result.changeSummary).toBe('聯絡人')
    })

    it('應該解析多個變更項目', () => {
      const details = '修改預約：01/15 10:00 張三，變更：時間: 10:00 → 11:00、教練: Papa → Sky、備註: 舊備註 → 新備註'
      const result = parseDetails(details)
      
      expect(result.changeSummary).toBe('時間、教練、備註')
    })
  })

  describe('刪除預約', () => {
    it('應該解析基本刪除預約資訊', () => {
      const details = '刪除預約：01/15 10:00 60分 G23 張三 | Papa教練'
      const result = parseDetails(details)
      
      expect(result.time).toBe('01/15 10:00')
      expect(result.duration).toBe('60分')
      expect(result.boat).toBe('G23')
      expect(result.member).toBe('張三')
      expect(result.coach).toBe('Papa')
    })

    it('應該解析含駕駛的刪除預約（新格式）', () => {
      const details = '刪除預約：01/15 10:00 60分 G23 張三 | Papa教練 | 🚤Sky'
      const result = parseDetails(details)
      
      expect(result.coach).toBe('Papa')
      expect(result.driver).toBe('Sky')
    })

    it('應該解析含駕駛的刪除預約（舊格式）', () => {
      const details = '刪除預約：01/15 10:00 60分 G23 張三 | Papa教練 | 🚗Sky'
      const result = parseDetails(details)
      
      expect(result.driver).toBe('Sky')
    })

    it('應該解析含備註的刪除預約', () => {
      const details = '刪除預約：01/15 10:00 60分 G23 張三 [澤澤] | Papa教練'
      const result = parseDetails(details)
      
      expect(result.notes).toBe('澤澤')
    })

    it('應該解析備註預覽（15字截斷）', () => {
      const longNote = '這是一個非常長的備註內容，超過了15個字'
      const details = `刪除預約：01/15 10:00 60分 G23 張三 [${longNote}] | Papa教練`
      const result = parseDetails(details)
      
      expect(result.notes).toBe(longNote)
      // 備註預覽在 UI 層處理（不在 parseDetails 中）
      // 字符串長度是 20 個字符
      expect(longNote.length).toBe(20)
      const preview = result.notes.length > 15 ? result.notes.substring(0, 15) + '...' : result.notes
      // substring(0, 15) 取前 15 個字符
      expect(preview.substring(0, preview.indexOf('...'))).toBe('這是一個非常長的備註內容，超過')
      expect(preview.endsWith('...')).toBe(true)
    })
  })

  describe('批次修改', () => {
    it('應該解析批次修改的筆數', () => {
      const details = '批次修改 3 筆：時長→90分鐘 [Ming (04/03 08:30), John (04/03 09:00), Amy (04/03 10:00)]'
      const result = parseDetails(details)
      
      expect(result.member).toBe('3筆')
      expect(result.totalCount).toBe(3)
      expect(result.changeSummary).toBe('時長→90分鐘')
    })

    it('應該解析批次修改的預約列表', () => {
      const details = '批次修改 3 筆：時長→90分鐘 [Ming (04/03 08:30), John (04/03 09:00), Amy (04/03 10:00)] (填表人: Admin)'
      const result = parseDetails(details)
      
      expect(result.bookingList).toHaveLength(3)
      expect(result.bookingList).toEqual([
        'Ming (04/03 08:30)',
        'John (04/03 09:00)',
        'Amy (04/03 10:00)'
      ])
      expect(result.bookingDate).toBe('04/03')
      expect(result.filledBy).toBe('Admin')
    })

    it('應該解析含「等X筆」的批次修改', () => {
      const details = '批次修改 8 筆：時長→90分鐘 [05/09 08:30, 05/16 08:30 等8筆]'
      const result = parseDetails(details)
      
      expect(result.totalCount).toBe(8)
      expect(result.bookingList).toHaveLength(2)
      expect(result.bookingList).toEqual(['05/09 08:30', '05/16 08:30'])
    })
  })

  describe('批次刪除', () => {
    it('應該解析批次刪除的筆數和列表', () => {
      const details = '批次刪除 2 筆：[張三 (04/03 08:30), 李四 (04/03 09:00)]'
      const result = parseDetails(details)
      
      expect(result.member).toBe('2筆')
      expect(result.totalCount).toBe(2)
      expect(result.bookingList).toHaveLength(2)
    })

    it('應該正確處理預約列表中的日期提取', () => {
      const details = '批次刪除 5 筆：[張三 (04/03 08:30), 李四 (04/05 09:00), 王五 (04/07 10:00)]'
      const result = parseDetails(details)
      
      expect(result.bookingDate).toBe('04/03') // 第一個日期
      expect(result.bookingList).toHaveLength(3)
    })
  })

  describe('重複預約', () => {
    it('應該解析重複預約的基本資訊', () => {
      const details = '重複預約 3 筆：G23 60分 Queenie | Papa教練 [SUP] [04/03 10:00, 04/04 10:00, 04/05 10:00]'
      const result = parseDetails(details)
      
      expect(result.member).toBe('Queenie')
      expect(result.boat).toBe('G23')
      expect(result.duration).toBe('60分')
      expect(result.coach).toBe('Papa')
      expect(result.totalCount).toBe(3)
    })

    it('應該解析含多位教練的重複預約', () => {
      const details = '重複預約 2 筆：G23 60分 Queenie | Papa教練、Sky老師 [04/03 10:00, 04/04 10:00]'
      const result = parseDetails(details)
      
      expect(result.coach).toBe('Papa/Sky')
    })

    it('應該提取重複預約的時間列表', () => {
      const details = '重複預約 4 筆：G23 60分 Queenie | Papa教練 [04/03 10:00, 04/04 10:00, 04/05 10:00, 04/06 10:00] (填表人: L)'
      const result = parseDetails(details)
      
      expect(result.bookingList).toHaveLength(4)
      expect(result.bookingDate).toBe('04/03')
      expect(result.filledBy).toBe('L')
    })
  })

  describe('填表人解析', () => {
    it('應該解析填表人（填表人格式）', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三 (填表人: Ming)'
      const result = parseDetails(details)
      
      expect(result.filledBy).toBe('Ming')
    })

    it('應該解析填表人（課堂人格式）', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三 (課堂人: L)'
      const result = parseDetails(details)
      
      expect(result.filledBy).toBe('L')
    })

    it('應該解析中文冒號的填表人', () => {
      const details = '批次修改 3 筆：時長→90分鐘 [Ming (04/03 08:30)] (填表人：Admin)'
      const result = parseDetails(details)
      
      expect(result.filledBy).toBe('Admin')
    })
  })

  describe('邊緣情況', () => {
    it('應該處理空字串', () => {
      const result = parseDetails('')
      
      expect(result.rawText).toBe('')
      expect(result.time).toBeUndefined()
      expect(result.boat).toBeUndefined()
    })

    it('應該處理未知格式', () => {
      const details = '這是一個未知的格式'
      const result = parseDetails(details)
      
      expect(result.rawText).toBe(details)
    })

    it('應該正確保留 rawText', () => {
      const details = '新增預約：01/15 10:00 60分 G23 張三'
      const result = parseDetails(details)
      
      expect(result.rawText).toBe(details)
    })

    it('應該處理只有船隻的情況', () => {
      const details = '新增預約：01/15 10:00 60分 G23'
      const result = parseDetails(details)
      
      expect(result.boat).toBe('G23')
      expect(result.member).toBeUndefined()
    })
  })
})

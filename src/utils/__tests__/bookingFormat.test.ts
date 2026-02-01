import { describe, it, expect } from 'vitest'
import {
  formatBookingForLine,
  formatSingleBookingWithName,
  formatBookingsForLine,
  getDisplayContactName
} from '../bookingFormat'

describe('bookingFormat.ts - 預約格式化工具', () => {
  describe('formatBookingForLine', () => {
    it('應該格式化基本預約資訊', () => {
      const booking = {
        start_at: '2025-11-24T10:30:00',
        duration_min: 60,
        contact_name: '王小明',
        boats: { name: 'G23' },
        coaches: [{ name: 'ED' }],
        activity_types: ['SUP']
      }

      const result = formatBookingForLine(booking)
      expect(result).toBe('11/24 10:00抵達, 10:30下水, 60分鐘, G23, ED教練')
    })

    it('應該處理多個教練', () => {
      const booking = {
        start_at: '2025-11-24T14:00:00',
        duration_min: 90,
        boats: { name: 'G23' },
        coaches: [{ name: 'ED' }, { name: 'John' }]
      }

      const result = formatBookingForLine(booking)
      expect(result).toBe('11/24 13:30抵達, 14:00下水, 90分鐘, G23, ED教練/John教練')
    })

    it('應該處理多個活動類型', () => {
      const booking = {
        start_at: '2025-11-24T09:00:00',
        duration_min: 60,
        boats: { name: 'G23' },
        coaches: [{ name: 'ED' }],
        activity_types: ['SUP', 'Wakeboard']
      }

      const result = formatBookingForLine(booking)
      expect(result).toBe('11/24 08:30抵達, 09:00下水, 60分鐘, G23, ED教練')
    })

    it('沒有教練時不應該顯示教練資訊', () => {
      const booking = {
        start_at: '2025-11-24T10:00:00',
        duration_min: 60,
        boats: { name: 'G23' },
        coaches: []
      }

      const result = formatBookingForLine(booking)
      expect(result).toBe('11/24 09:30抵達, 10:00下水, 60分鐘, G23')
    })

    it('沒有活動類型時不應該顯示活動類型', () => {
      const booking = {
        start_at: '2025-11-24T10:00:00',
        duration_min: 60,
        boats: { name: 'G23' },
        coaches: [{ name: 'ED' }],
        activity_types: []
      }

      const result = formatBookingForLine(booking)
      expect(result).toBe('11/24 09:30抵達, 10:00下水, 60分鐘, G23, ED教練')
    })

    it('沒有船隻資訊時應該顯示「?」', () => {
      const booking = {
        start_at: '2025-11-24T10:00:00',
        duration_min: 60,
        boats: null,
        coaches: [{ name: 'ED' }]
      }

      const result = formatBookingForLine(booking)
      expect(result).toBe('11/24 09:30抵達, 10:00下水, 60分鐘, ?, ED教練')
    })

    it('應該正確補零月份和日期', () => {
      const booking = {
        start_at: '2025-01-05T09:05:00',
        duration_min: 60,
        boats: { name: 'G23' },
        coaches: [{ name: 'ED' }]
      }

      const result = formatBookingForLine(booking)
      expect(result).toBe('01/05 08:35抵達, 09:05下水, 60分鐘, G23, ED教練')
    })
  })

  describe('formatSingleBookingWithName', () => {
    it('應該包含人名和預約資訊', () => {
      const booking = {
        start_at: '2025-11-24T10:30:00',
        duration_min: 60,
        contact_name: '王小明',
        boats: { name: 'G23' },
        coaches: [{ name: 'ED' }],
        activity_types: ['SUP']
      }

      const result = formatSingleBookingWithName(booking)
      expect(result).toBe('王小明的預約\n11/24 10:00抵達, 10:30下水, 60分鐘, G23, ED教練')
    })

    it('沒有聯絡人名稱時應該顯示「客人」', () => {
      const booking = {
        start_at: '2025-11-24T10:30:00',
        duration_min: 60,
        boats: { name: 'G23' },
        coaches: [{ name: 'ED' }]
      }

      const result = formatSingleBookingWithName(booking)
      expect(result).toBe('客人的預約\n11/24 10:00抵達, 10:30下水, 60分鐘, G23, ED教練')
    })
  })

  describe('formatBookingsForLine', () => {
    it('應該格式化多個預約', () => {
      const bookings = [
        {
          start_at: '2025-11-24T10:00:00',
          duration_min: 60,
          boats: { name: 'G23' },
          coaches: [{ name: 'ED' }]
        },
        {
          start_at: '2025-11-24T11:30:00',
          duration_min: 90,
          boats: { name: 'G24' },
          coaches: [{ name: 'John' }]
        }
      ]

      const result = formatBookingsForLine(bookings, '今日預約')
      expect(result).toBe('今日預約\n11/24 09:30抵達, 10:00下水, 60分鐘, G23, ED教練\n11/24 11:00抵達, 11:30下水, 90分鐘, G24, John教練')
    })

    it('空列表應該返回空字串', () => {
      const result = formatBookingsForLine([], '今日預約')
      expect(result).toBe('')
    })

    it('應該包含自訂標題', () => {
      const bookings = [
        {
          start_at: '2025-11-24T10:00:00',
          duration_min: 60,
          boats: { name: 'G23' },
          coaches: [{ name: 'ED' }]
        }
      ]

      const result = formatBookingsForLine(bookings, '明日預約提醒')
      expect(result).toBe('明日預約提醒\n11/24 09:30抵達, 10:00下水, 60分鐘, G23, ED教練')
    })
  })

  describe('getDisplayContactName', () => {
    it('有會員且有暱稱時應該顯示暱稱', () => {
      const booking = {
        contact_name: '王小明',
        booking_members: [
          {
            members: {
              name: '王小明',
              nickname: 'Jerry'
            }
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('Jerry')
    })

    it('有會員但沒有暱稱時應該顯示姓名', () => {
      const booking = {
        contact_name: '王小明',
        booking_members: [
          {
            members: {
              name: '王小明',
              nickname: null
            }
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('王小明')
    })

    it('多個會員且暱稱不同時應該用逗號分隔', () => {
      const booking = {
        contact_name: '王小明, 李大華',
        booking_members: [
          {
            members: {
              name: '王小明',
              nickname: 'Jerry'
            }
          },
          {
            members: {
              name: '李大華',
              nickname: 'David'
            }
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('Jerry, David')
    })

    it('多個會員且暱稱相同時應該只顯示一個', () => {
      const booking = {
        contact_name: '王小明, 王大明',
        booking_members: [
          {
            members: {
              name: '王小明',
              nickname: 'Jerry'
            }
          },
          {
            members: {
              name: '王大明',
              nickname: 'Jerry'
            }
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('Jerry')
    })

    it('沒有會員資料時應該使用 contact_name', () => {
      const booking = {
        contact_name: '非會員客人',
        booking_members: []
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('非會員客人')
    })

    it('沒有任何名稱時應該返回「未命名」', () => {
      const booking = {
        booking_members: []
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('未命名')
    })

    it('會員資料中有 null 或 undefined 時應該過濾掉', () => {
      const booking = {
        contact_name: '王小明',
        booking_members: [
          {
            members: null
          },
          {
            members: {
              name: '王小明',
              nickname: 'Jerry'
            }
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('Jerry')
    })

    it('混合會員和非會員時應該同時顯示會員暱稱和非會員名稱', () => {
      const booking = {
        contact_name: '王小明, 張三',
        booking_members: [
          {
            members: {
              name: '王小明',
              nickname: 'Jerry'
            }
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('Jerry, 張三')
    })

    it('所有會員都是 null 時應該回退到 contact_name', () => {
      const booking = {
        contact_name: '非會員客人',
        booking_members: [
          {
            members: null
          },
          {
            members: null
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('非會員客人')
    })

    it('所有會員都是 null 且沒有 contact_name 時應該返回「未命名」', () => {
      const booking = {
        booking_members: [
          {
            members: null
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('未命名')
    })

    it('booking_members 存在但會員被刪除（members 為 null）應該使用 contact_name', () => {
      const booking = {
        contact_name: '張三',
        booking_members: [
          {
            member_id: 'deleted-member-id',
            members: null  // 會員已被刪除，資料庫 LEFT JOIN 返回 null
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('張三')
    })

    it('部分會員被刪除時應該顯示存在的會員和標記為已刪除的名稱', () => {
      const booking = {
        contact_name: '王小明, 已刪除會員',
        booking_members: [
          {
            member_id: 'valid-member-id',
            members: {
              name: '王小明',
              nickname: 'Jerry'
            }
          },
          {
            member_id: 'deleted-member-id',
            members: null  // 會員已被刪除
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('Jerry, 已刪除會員')
    })

    it('會員名稱為空字串時應該過濾掉', () => {
      const booking = {
        contact_name: '有效客人',
        booking_members: [
          {
            members: {
              name: '',
              nickname: null
            }
          },
          {
            members: {
              name: '有效客人',
              nickname: 'Valid'
            }
          }
        ]
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('Valid')
    })

    it('booking_members 為 undefined 時應該使用 contact_name', () => {
      const booking = {
        contact_name: '非會員客人'
        // booking_members 完全不存在
      }

      const result = getDisplayContactName(booking)
      expect(result).toBe('非會員客人')
    })
  })
})


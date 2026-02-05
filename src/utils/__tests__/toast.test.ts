import { describe, it, expect, beforeEach, vi } from 'vitest'
import { toast, ToastEvent } from '../toast'

describe('toast', () => {
  let events: ToastEvent[] = []
  let unsubscribe: (() => void) | null = null

  beforeEach(() => {
    events = []
    // 清理之前的訂閱
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  })

  describe('訂閱機制', () => {
    it('應該能夠訂閱 toast 事件', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      toast.success('測試訊息')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('success')
      expect(events[0].message).toBe('測試訊息')
    })

    it('應該能夠取消訂閱', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      toast.success('訊息 1')
      expect(events).toHaveLength(1)

      unsubscribe()
      toast.success('訊息 2')
      
      // 取消訂閱後不應該收到新訊息
      expect(events).toHaveLength(1)
    })

    it('應該支援多個訂閱者', () => {
      const events1: ToastEvent[] = []
      const events2: ToastEvent[] = []

      const unsub1 = toast.subscribe((event) => {
        events1.push(event)
      })

      const unsub2 = toast.subscribe((event) => {
        events2.push(event)
      })

      toast.info('測試訊息')

      expect(events1).toHaveLength(1)
      expect(events2).toHaveLength(1)
      expect(events1[0].message).toBe('測試訊息')
      expect(events2[0].message).toBe('測試訊息')

      unsub1()
      unsub2()
    })

    it('取消訂閱不應該影響其他訂閱者', () => {
      const events1: ToastEvent[] = []
      const events2: ToastEvent[] = []

      const unsub1 = toast.subscribe((event) => {
        events1.push(event)
      })

      const unsub2 = toast.subscribe((event) => {
        events2.push(event)
      })

      toast.success('訊息 1')
      
      unsub1()
      
      toast.success('訊息 2')

      expect(events1).toHaveLength(1)
      expect(events2).toHaveLength(2)

      unsub2()
    })
  })

  describe('success', () => {
    beforeEach(() => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })
    })

    it('應該發送 success toast', () => {
      toast.success('成功訊息')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('success')
      expect(events[0].message).toBe('成功訊息')
      expect(events[0].duration).toBeUndefined()
    })

    it('應該支援自訂持續時間', () => {
      toast.success('成功訊息', 5000)

      expect(events).toHaveLength(1)
      expect(events[0].duration).toBe(5000)
    })
  })

  describe('error', () => {
    beforeEach(() => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })
    })

    it('應該發送 error toast', () => {
      toast.error('錯誤訊息')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('error')
      expect(events[0].message).toBe('錯誤訊息')
      expect(events[0].duration).toBeUndefined()
    })

    it('應該支援自訂持續時間', () => {
      toast.error('錯誤訊息', 3000)

      expect(events).toHaveLength(1)
      expect(events[0].duration).toBe(3000)
    })
  })

  describe('warning', () => {
    beforeEach(() => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })
    })

    it('應該發送 warning toast', () => {
      toast.warning('警告訊息')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('warning')
      expect(events[0].message).toBe('警告訊息')
      expect(events[0].duration).toBeUndefined()
    })

    it('應該支援自訂持續時間', () => {
      toast.warning('警告訊息', 4000)

      expect(events).toHaveLength(1)
      expect(events[0].duration).toBe(4000)
    })
  })

  describe('info', () => {
    beforeEach(() => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })
    })

    it('應該發送 info toast', () => {
      toast.info('資訊訊息')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('info')
      expect(events[0].message).toBe('資訊訊息')
      expect(events[0].duration).toBeUndefined()
    })

    it('應該支援自訂持續時間', () => {
      toast.info('資訊訊息', 2000)

      expect(events).toHaveLength(1)
      expect(events[0].duration).toBe(2000)
    })
  })

  describe('連續發送多個 toast', () => {
    beforeEach(() => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })
    })

    it('應該能夠連續發送多個不同類型的 toast', () => {
      toast.success('成功')
      toast.error('錯誤')
      toast.warning('警告')
      toast.info('資訊')

      expect(events).toHaveLength(4)
      expect(events[0].type).toBe('success')
      expect(events[1].type).toBe('error')
      expect(events[2].type).toBe('warning')
      expect(events[3].type).toBe('info')
    })

    it('應該按順序接收所有 toast', () => {
      toast.success('訊息 1')
      toast.success('訊息 2')
      toast.success('訊息 3')

      expect(events).toHaveLength(3)
      expect(events[0].message).toBe('訊息 1')
      expect(events[1].message).toBe('訊息 2')
      expect(events[2].message).toBe('訊息 3')
    })
  })

  describe('邊緣情況', () => {
    it('沒有訂閱者時不應該拋出錯誤', () => {
      expect(() => {
        toast.success('測試')
        toast.error('測試')
        toast.warning('測試')
        toast.info('測試')
      }).not.toThrow()
    })

    it('應該處理空訊息', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      toast.success('')

      expect(events).toHaveLength(1)
      expect(events[0].message).toBe('')
    })

    it('應該處理很長的訊息', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      const longMessage = 'a'.repeat(1000)
      toast.success(longMessage)

      expect(events).toHaveLength(1)
      expect(events[0].message).toBe(longMessage)
    })

    it('應該處理特殊字符', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      const specialMessage = '特殊字符 !@#$%^&*() 😀 \n\t'
      toast.success(specialMessage)

      expect(events).toHaveLength(1)
      expect(events[0].message).toBe(specialMessage)
    })

    it('應該處理 0 作為持續時間', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      toast.success('測試', 0)

      expect(events).toHaveLength(1)
      expect(events[0].duration).toBe(0)
    })

    it('應該處理負數作為持續時間', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      toast.success('測試', -100)

      expect(events).toHaveLength(1)
      expect(events[0].duration).toBe(-100)
    })
  })

  describe('多次取消訂閱', () => {
    it('應該允許多次呼叫取消訂閱函數', () => {
      unsubscribe = toast.subscribe((event) => {
        events.push(event)
      })

      expect(() => {
        unsubscribe!()
        unsubscribe!()
        unsubscribe!()
      }).not.toThrow()
    })
  })
})

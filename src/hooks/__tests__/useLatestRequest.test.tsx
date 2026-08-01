import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLatestRequest } from '../useLatestRequest'

describe('useLatestRequest', () => {
  it('同一個 key 下，較新的請求會讓較舊的請求失效', () => {
    const { result } = renderHook(() => useLatestRequest('2026-08-02'))

    const first = result.current('2026-08-02')
    const second = result.current('2026-08-02')

    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  it('換日期後，前一天的請求即使晚回來也不算目前的請求', () => {
    const { result, rerender } = renderHook(({ date }) => useLatestRequest(date), {
      initialProps: { date: '2026-08-02' },
    })

    const staleRequest = result.current('2026-08-02')
    expect(staleRequest()).toBe(true)

    rerender({ date: '2026-08-03' })

    expect(staleRequest()).toBe(false)
  })

  it('已經過期的 key 不會佔用序號，進行中的正確請求仍然有效', () => {
    const { result, rerender } = renderHook(({ date }) => useLatestRequest(date), {
      initialProps: { date: '2026-08-02' },
    })

    rerender({ date: '2026-08-03' })

    const currentRequest = result.current('2026-08-03')
    // 例如 realtime 舊 closure 觸發的重新載入，帶著前一天的日期
    const obsoleteRequest = result.current('2026-08-02')

    expect(obsoleteRequest()).toBe(false)
    expect(currentRequest()).toBe(true)
  })

  it('切回原本的日期時，先前那天的舊請求不會復活', () => {
    const { result, rerender } = renderHook(({ date }) => useLatestRequest(date), {
      initialProps: { date: '2026-08-02' },
    })

    const firstRequest = result.current('2026-08-02')

    rerender({ date: '2026-08-03' })
    result.current('2026-08-03')
    rerender({ date: '2026-08-02' })

    expect(firstRequest()).toBe(false)
  })

  it('begin 的識別不會因為重新渲染而改變', () => {
    const { result, rerender } = renderHook(({ date }) => useLatestRequest(date), {
      initialProps: { date: '2026-08-02' },
    })

    const begin = result.current
    rerender({ date: '2026-08-03' })

    expect(result.current).toBe(begin)
  })
})

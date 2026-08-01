import { useCallback, useEffect, useRef } from 'react'

/**
 * 讓非同步載入遵循「最新請求優先」，而不是「最後回來的覆蓋畫面」。
 *
 * 換日期時前一天的查詢可能還在飛，若它比新查詢晚回來就會把畫面蓋回前一天；
 * 預約表沒有輪詢或即時重抓，錯誤狀態會一直留到使用者再換一次日期。
 *
 * 用法：載入開始時呼叫 begin(該次請求的 key，通常是日期)，
 * 之後每個 setState 前先確認 isCurrent()。
 */
export function useLatestRequest<TKey>(currentKey: TKey): (requestKey: TKey) => () => boolean {
  const currentKeyRef = useRef(currentKey)
  const latestSeqRef = useRef(0)

  useEffect(() => {
    currentKeyRef.current = currentKey
  }, [currentKey])

  return useCallback((requestKey: TKey) => {
    // key 已經過期的請求不佔用序號，否則會把正在進行的正確請求誤判成過期
    if (requestKey !== currentKeyRef.current) return () => false

    const seq = ++latestSeqRef.current
    return () => seq === latestSeqRef.current && requestKey === currentKeyRef.current
  }, [])
}

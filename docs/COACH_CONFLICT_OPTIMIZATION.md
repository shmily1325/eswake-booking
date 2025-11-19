# 教練衝突檢查優化方案

## 🔴 目前的問題（N+1 查詢）

### 現狀分析

當選擇 **3 位教練**時，目前的實現會執行：

```typescript
// NewBookingDialog.tsx line 398-455
for (const coachId of selectedCoaches) {  // 循環 3 次
  // 1. 查詢教練預約
  const coachResult = await supabase
    .from('booking_coaches')
    .select('booking_id')
    .eq('coach_id', coachId)  // 查詢 1
  
  // 2. 查詢駕駛預約
  const driverResult = await supabase
    .from('booking_drivers')
    .select('booking_id')
    .eq('driver_id', coachId)  // 查詢 2
  
  // 3. 合併 booking_ids，查詢預約詳情
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .in('id', allBookingIds)
    .gte('start_at', `${dateStr}T00:00:00`)
    .lte('start_at', `${dateStr}T23:59:59`)  // 查詢 3
}
```

**總查詢次數：3 個教練 × 3 次查詢 = 9 次查詢** 😱

### 重複預約的情況更糟

如果重複預約 4 週：
- **總查詢次數：4 週 × 3 教練 × 3 查詢 = 36 次查詢** 💥

---

## ✅ 優化方案 1：批量查詢（推薦）

### 核心思路
**一次性查詢所有教練在該日期的所有預約**

### 優化後的實現

```typescript
/**
 * 批量檢查多位教練的衝突（優化版）
 * @param coachIds 教練 ID 列表
 * @param dateStr 日期字串 "YYYY-MM-DD"
 * @param startTime 開始時間 "HH:MM"
 * @param durationMin 持續時間（分鐘）
 * @returns 衝突檢查結果
 */
export async function checkCoachesConflictBatch(
  coachIds: string[],
  dateStr: string,
  startTime: string,
  durationMin: number
): Promise<{
  hasConflict: boolean
  conflictCoaches: Array<{ coachId: string; coachName: string; reason: string }>
}> {
  if (coachIds.length === 0) {
    return { hasConflict: false, conflictCoaches: [] }
  }

  const newSlot = calculateTimeSlot(startTime, durationMin)
  
  // ✅ 優化：一次性查詢所有教練的預約（使用 JOIN）
  const { data: coachBookingsData, error: coachError } = await supabase
    .from('booking_coaches')
    .select(`
      coach_id,
      bookings!inner(
        id,
        start_at,
        duration_min,
        contact_name
      )
    `)
    .in('coach_id', coachIds)
    .gte('bookings.start_at', `${dateStr}T00:00:00`)
    .lte('bookings.start_at', `${dateStr}T23:59:59`)

  // ✅ 優化：一次性查詢所有駕駛的預約
  const { data: driverBookingsData, error: driverError } = await supabase
    .from('booking_drivers')
    .select(`
      driver_id,
      bookings!inner(
        id,
        start_at,
        duration_min,
        contact_name
      )
    `)
    .in('driver_id', coachIds)
    .gte('bookings.start_at', `${dateStr}T00:00:00`)
    .lte('bookings.start_at', `${dateStr}T23:59:59`)

  if (coachError || driverError) {
    console.error('查詢教練預約時發生錯誤:', coachError || driverError)
    return { hasConflict: false, conflictCoaches: [] }
  }

  // 整理每位教練的預約
  const coachBookingsMap = new Map<string, any[]>()
  
  // 處理教練預約
  coachBookingsData?.forEach(item => {
    const coachId = item.coach_id
    const bookings = coachBookingsMap.get(coachId) || []
    bookings.push(item.bookings)
    coachBookingsMap.set(coachId, bookings)
  })
  
  // 處理駕駛預約
  driverBookingsData?.forEach(item => {
    const driverId = item.driver_id
    const bookings = coachBookingsMap.get(driverId) || []
    bookings.push(item.bookings)
    coachBookingsMap.set(driverId, bookings)
  })

  // 檢查每位教練是否有衝突
  const conflictCoaches: Array<{ coachId: string; coachName: string; reason: string }> = []
  
  for (const coachId of coachIds) {
    const bookings = coachBookingsMap.get(coachId) || []
    
    for (const booking of bookings) {
      const existingTime = booking.start_at.substring(11, 16)
      const existingSlot = calculateTimeSlot(existingTime, booking.duration_min)
      
      if (checkTimeSlotConflict(newSlot, existingSlot)) {
        conflictCoaches.push({
          coachId,
          coachName: '', // 需要外部傳入教練名稱
          reason: `與 ${booking.contact_name} 的預約時間衝突 (${existingTime}-${minutesToTime(existingSlot.endMinutes)})`
        })
        break // 找到一個衝突就跳出
      }
    }
  }

  return {
    hasConflict: conflictCoaches.length > 0,
    conflictCoaches
  }
}
```

### 查詢次數對比

| 情況 | 優化前 | 優化後 | 改善 |
|------|--------|--------|------|
| 3 位教練 | 9 次 | **2 次** | ✅ 減少 78% |
| 重複 4 週 | 36 次 | **2 次** | ✅ 減少 94% |
| 5 位教練 | 15 次 | **2 次** | ✅ 減少 87% |

---

## ✅ 優化方案 2：使用 Supabase RPC

### 適用場景
- 需要更複雜的邏輯
- 需要在資料庫層面處理

### PostgreSQL 函數

```sql
-- 創建檢查教練衝突的函數
CREATE OR REPLACE FUNCTION check_coaches_conflict(
  p_coach_ids TEXT[],
  p_date_str TEXT,
  p_start_time TEXT,
  p_duration_min INTEGER
)
RETURNS TABLE(
  coach_id TEXT,
  has_conflict BOOLEAN,
  conflict_booking_id INTEGER,
  conflict_contact_name TEXT,
  conflict_start_at TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH coach_bookings AS (
    -- 教練預約
    SELECT 
      bc.coach_id,
      b.id AS booking_id,
      b.start_at,
      b.duration_min,
      b.contact_name
    FROM booking_coaches bc
    INNER JOIN bookings b ON bc.booking_id = b.id
    WHERE bc.coach_id = ANY(p_coach_ids)
      AND b.start_at >= (p_date_str || 'T00:00:00')::TEXT
      AND b.start_at <= (p_date_str || 'T23:59:59')::TEXT
    
    UNION ALL
    
    -- 駕駛預約
    SELECT 
      bd.driver_id AS coach_id,
      b.id AS booking_id,
      b.start_at,
      b.duration_min,
      b.contact_name
    FROM booking_drivers bd
    INNER JOIN bookings b ON bd.booking_id = b.id
    WHERE bd.driver_id = ANY(p_coach_ids)
      AND b.start_at >= (p_date_str || 'T00:00:00')::TEXT
      AND b.start_at <= (p_date_str || 'T23:59:59')::TEXT
  )
  SELECT 
    cb.coach_id,
    TRUE AS has_conflict,
    cb.booking_id AS conflict_booking_id,
    cb.contact_name AS conflict_contact_name,
    cb.start_at AS conflict_start_at
  FROM coach_bookings cb
  WHERE 
    -- 在這裡實現時間衝突檢查邏輯
    -- 簡化示範：檢查時間重疊
    NOT (
      (substring(cb.start_at, 12, 5)::TIME + (cb.duration_min || ' minutes')::INTERVAL)::TIME <= p_start_time::TIME
      OR substring(cb.start_at, 12, 5)::TIME >= (p_start_time::TIME + (p_duration_min || ' minutes')::INTERVAL)::TIME
    );
END;
$$ LANGUAGE plpgsql;
```

### TypeScript 調用

```typescript
const { data, error } = await supabase.rpc('check_coaches_conflict', {
  p_coach_ids: coachIds,
  p_date_str: dateStr,
  p_start_time: startTime,
  p_duration_min: durationMin
})
```

**優點：**
- ✅ 只需 1 次查詢
- ✅ 邏輯在資料庫層執行（更快）
- ✅ 可以處理複雜的衝突規則

---

## ✅ 優化方案 3：前端快取

### 實現思路

```typescript
// 快取當天的教練預約資料
const coachBookingsCache = useMemo(() => {
  return new Map<string, Booking[]>()
}, [selectedDate])

// 首次載入時一次性獲取所有教練的預約
useEffect(() => {
  async function loadCoachesBookings() {
    const { data } = await supabase
      .from('booking_coaches')
      .select(`
        coach_id,
        bookings!inner(*)
      `)
      .gte('bookings.start_at', `${selectedDate}T00:00:00`)
      .lte('bookings.start_at', `${selectedDate}T23:59:59`)
    
    // 建立快取
    const cache = new Map()
    data?.forEach(item => {
      const bookings = cache.get(item.coach_id) || []
      bookings.push(item.bookings)
      cache.set(item.coach_id, bookings)
    })
    
    setCoachBookingsCache(cache)
  }
  
  loadCoachesBookings()
}, [selectedDate])

// 檢查衝突時使用快取
function checkConflictFromCache(coachId: string) {
  const bookings = coachBookingsCache.get(coachId) || []
  // ... 檢查邏輯
}
```

**優點：**
- ✅ 一次查詢，多次使用
- ✅ 適合連續創建多個預約的場景

---

## 📊 性能對比

### 測試場景：選擇 3 位教練，檢查衝突

| 方案 | 查詢次數 | 預估時間 | 網路往返 |
|------|---------|---------|---------|
| 目前實現 | 9 次 | ~450ms | 9 次 |
| 優化方案 1（批量查詢）| 2 次 | ~100ms | 2 次 |
| 優化方案 2（RPC）| 1 次 | ~50ms | 1 次 |
| 優化方案 3（快取）| 1 次* | ~50ms | 1 次 |

*快取方案：首次 1 次查詢，後續 0 次

### 在重複預約場景下（4 週）

| 方案 | 總查詢次數 | 預估時間 |
|------|-----------|---------|
| 目前實現 | 36 次 | ~1.8s |
| 優化方案 1 | 8 次 | ~400ms |
| 優化方案 2 | 4 次 | ~200ms |
| 優化方案 3 | 1 次 | ~50ms |

---

## 🎯 推薦實施步驟

### Phase 1：立即改善（優先級最高）⚡

**實施方案 1（批量查詢）**

1. 在 `src/utils/bookingConflict.ts` 中新增 `checkCoachesConflictBatch` 函數
2. 更新 `NewBookingDialog.tsx` 使用批量查詢
3. 更新 `EditBookingDialog.tsx` 使用批量查詢

**預估時間：** 2-3 小時  
**效果：** 立即減少 78-94% 的查詢次數

### Phase 2：進一步優化（如需要）

**實施方案 3（快取）**

適用於：
- 用戶頻繁創建預約
- 同一天內多次檢查衝突

### Phase 3：終極優化（長期）

**實施方案 2（RPC）**

適用於：
- 需要更複雜的衝突規則
- 需要最佳性能

---

## 💻 具體實施代碼

### 1. 更新 `bookingConflict.ts`

```typescript
// 在文件末尾添加
export async function checkCoachesConflictBatch(
  coachIds: string[],
  dateStr: string,
  startTime: string,
  durationMin: number,
  coachesMap: Map<string, { name: string }> // 傳入教練名稱映射
): Promise<{
  hasConflict: boolean
  conflictCoaches: Array<{ coachId: string; coachName: string; reason: string }>
}> {
  // ... (上面的實現)
}
```

### 2. 更新 `NewBookingDialog.tsx`

```typescript
// 替換原來的循環檢查（line 396-455）
if (!hasConflict && selectedCoaches.length > 0) {
  console.log(`🔍 開始批量檢查 ${selectedCoaches.length} 位教練的衝突...`)
  
  // ✅ 使用優化後的批量查詢
  const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
  const conflictResult = await checkCoachesConflictBatch(
    selectedCoaches,
    dateStr,
    timeStr,
    durationMin,
    coachesMap
  )
  
  if (conflictResult.hasConflict) {
    hasConflict = true
    const conflictNames = conflictResult.conflictCoaches
      .map(c => `${c.coachName}: ${c.reason}`)
      .join('\n')
    conflictReason = `教練衝突：\n${conflictNames}`
  }
}
```

---

## 🧪 測試計劃

### 測試案例

1. **單個教練無衝突** - 應該快速返回
2. **3 位教練，1 位有衝突** - 應該正確識別
3. **重複預約 4 週** - 總時間 < 500ms
4. **高並發場景** - 多個用戶同時創建預約

### 性能基準

- ✅ 3 位教練檢查：< 150ms
- ✅ 5 位教練檢查：< 200ms
- ✅ 重複 4 週：< 500ms

---

## ✅ 預期效果

### 用戶體驗改善
- ⚡ **響應速度提升 5-10 倍**
- ✅ 減少「等待檢查」的時間
- ✅ 重複預約更流暢

### 系統資源節省
- 📉 資料庫查詢減少 78-94%
- 📉 網路流量減少
- 📉 伺服器負載降低

### 可擴展性
- ✅ 支援更多教練同時檢查
- ✅ 支援更多重複週數
- ✅ 為未來功能打好基礎

---

## 📝 注意事項

### 向下兼容
- ✅ 不影響現有功能
- ✅ 保持相同的錯誤訊息格式
- ✅ 不需要資料庫遷移

### 測試建議
1. 先在開發環境測試
2. 使用實際資料測試性能
3. 確保所有衝突情況都能正確檢測

---

**結論：推薦立即實施優化方案 1（批量查詢），可以快速獲得顯著的性能提升！** 🚀

*文件創建日期：2025-11-19*


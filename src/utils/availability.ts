import { supabase } from '../lib/supabase'

interface AvailabilityResult {
    isUnavailable: boolean
    reason?: string
}

/**
 * 檢查船隻在指定時段是否不可用（維修/停用）
 * 
 * @param boatId 船隻 ID
 * @param date 日期 (YYYY-MM-DD)
 * @param startTime 開始時間 (HH:mm)
 * @param endTime 結束時間 (HH:mm) 或 null (代表只檢查開始時間點是否在停用範圍內，或者依賴 durationMin)
 * @param durationMin 持續時間 (分鐘)，如果提供了 endTime，則此參數可選
 * @returns {Promise<AvailabilityResult>}
 */
export async function checkBoatUnavailable(
    boatId: number,
    date: string,
    startTime: string,
    endTime?: string,
    durationMin?: number
): Promise<AvailabilityResult> {
    try {
        // 計算查詢的時間範圍（分鐘數）
        const [startHour, startMinute] = startTime.split(':').map(Number)
        const startMinutes = startHour * 60 + startMinute

        let endMinutes = startMinutes
        if (endTime) {
            const [endHour, endMinute] = endTime.split(':').map(Number)
            endMinutes = endHour * 60 + endMinute
        } else if (durationMin) {
            endMinutes = startMinutes + durationMin
        }

        // 查詢該船隻在該日期的所有停用記錄
        const { data: unavailableRecords, error } = await supabase
            .from('boat_unavailable_dates')
            .select('*')
            .eq('boat_id', boatId)
            .eq('is_active', true)
            .lte('start_date', date)
            .gte('end_date', date)

        if (error) {
            console.error('Error checking boat availability:', error)
            return { isUnavailable: false } // 發生錯誤時預設為可用，避免阻擋操作，但應記錄錯誤
        }

        if (!unavailableRecords || unavailableRecords.length === 0) {
            return { isUnavailable: false }
        }

        // 檢查是否有重疊
        for (const record of unavailableRecords) {
            // 1. 全天停用：沒有設定 start_time 和 end_time
            if (!record.start_time && !record.end_time) {
                return { isUnavailable: true, reason: record.reason }
            }

            // 2. 特定時段停用
            // 只有當日期完全匹配時才需要檢查時間
            // 如果停用跨多天，且當前日期在中間，則是全天停用
            // 如果當前日期是 start_date，則檢查 start_time 之後
            // 如果當前日期是 end_date，則檢查 end_time 之前

            let recordStartMinutes = 0
            let recordEndMinutes = 24 * 60 // 1440

            if (record.start_date === date && record.start_time) {
                const [h, m] = record.start_time.split(':').map(Number)
                recordStartMinutes = h * 60 + m
            }

            if (record.end_date === date && record.end_time) {
                const [h, m] = record.end_time.split(':').map(Number)
                recordEndMinutes = h * 60 + m
            }

            // 檢查時間重疊
            // 預約時段: [startMinutes, endMinutes)
            // 停用時段: [recordStartMinutes, recordEndMinutes)
            // 重疊條件: !(endMinutes <= recordStartMinutes || startMinutes >= recordEndMinutes)

            if (!(endMinutes <= recordStartMinutes || startMinutes >= recordEndMinutes)) {
                return { isUnavailable: true, reason: record.reason }
            }
        }

        return { isUnavailable: false }

    } catch (err) {
        console.error('Unexpected error in checkBoatUnavailable:', err)
        return { isUnavailable: false }
    }
}

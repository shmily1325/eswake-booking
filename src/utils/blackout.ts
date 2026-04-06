import { supabase } from '../lib/supabase'

interface BlackoutResult {
	isBlackout: boolean
	reason?: string
}

type BlackoutType = 'all' | 'coach'

/**
 * 檢查全局封館／全教練封館時段是否與指定時段重疊
 * 
 * - 表結構預期（Supabase）：global_blackouts
 *   - id: number
 *   - type: 'all' | 'coach'   // 封館類型：全場館、全教練
 *   - start_date: string      // YYYY-MM-DD
 *   - start_time?: string     // HH:mm（可為 null，表示當日全天從 00:00）
 *   - end_date: string        // YYYY-MM-DD
 *   - end_time?: string       // HH:mm（可為 null，表示當日全天到 24:00）
 *   - reason: string
 *   - is_active: boolean
 */
export async function checkGlobalBlackout(
	type: BlackoutType,
	date: string,
	startTime: string,
	endTime?: string,
	durationMin?: number
): Promise<BlackoutResult> {
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

		// 讀取對應類型且覆蓋此日期的封館記錄
		const { data, error } = await (supabase as any)
			.from('global_blackouts')
			.select('*')
			.eq('type', type)
			.eq('is_active', true)
			.lte('start_date', date)
			.gte('end_date', date)

		if (error) {
			console.error('Error checking global blackout:', error)
			return { isBlackout: false }
		}

		if (!data || data.length === 0) {
			return { isBlackout: false }
		}

		for (const record of data as any[]) {
			// 全天封館：沒有設定 start_time 和 end_time
			if (!record.start_time && !record.end_time) {
				return { isBlackout: true, reason: record.reason }
			}

			// 跨日處理：若當前日期在中間，視為全天封館
			let recordStartMinutes = 0
			let recordEndMinutes = 24 * 60

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
			// 封館時段: [recordStartMinutes, recordEndMinutes)
			if (!(endMinutes <= recordStartMinutes || startMinutes >= recordEndMinutes)) {
				return { isBlackout: true, reason: record.reason }
			}
		}

		return { isBlackout: false }
	} catch (err) {
		console.error('Unexpected error in checkGlobalBlackout:', err)
		return { isBlackout: false }
	}
}


import { supabase } from '../lib/supabase'

export interface ReservationRestriction {
	id: number
	announcement_id: number
	start_date: string
	start_time: string | null
	end_date: string
	end_time: string | null
	is_active: boolean
	scope: 'all' | 'coaches'
	coach_ids?: string[]
	created_at?: string
}

export interface RestrictionCheckResult {
	isRestricted: boolean
	reason?: string
	startDate?: string
	startTime?: string | null
	endDate?: string
	endTime?: string | null
	restrictedPersonIds?: string[]
}

export function restrictionAppliesToPeople(
	scope: unknown,
	restrictedPersonIds: readonly string[] | null | undefined,
	personIds: readonly string[],
): boolean {
	if (scope !== 'coaches') return true
	if (personIds.length === 0) return false
	const restricted = new Set(restrictedPersonIds ?? [])
	return personIds.some((id) => restricted.has(id))
}

export function formatRestrictionTimeLabel(
	startTime: string | null | undefined,
	endTime: string | null | undefined,
): string {
	if (!startTime && !endTime) return '全天'
	const short = (value: string | null | undefined, fallback: string) =>
		value ? value.slice(0, 5) : fallback
	return `${short(startTime, '00:00')}–${short(endTime, '23:59')}`
}

/** 取得某公告綁定的限制設定（若有） */
export async function getRestrictionByAnnouncementId(announcementId: number): Promise<ReservationRestriction | null> {
	const { data, error } = await supabase
		.from('reservation_restrictions')
		.select('*')
		.eq('announcement_id', announcementId)
		.eq('is_active', true)
		.limit(1)
		.maybeSingle()
	if (error) {
		console.error('getRestrictionByAnnouncementId error:', error)
		return null
	}
	return (data as ReservationRestriction) || null
}

/** 建立或更新某公告的限制設定（以 announcement_id 唯一） */
export async function upsertRestriction(payload: Omit<ReservationRestriction, 'id' | 'created_at'>): Promise<void> {
	const { error } = await supabase
		.from('reservation_restrictions')
		.upsert({
			announcement_id: payload.announcement_id,
			start_date: payload.start_date,
			start_time: payload.start_time,
			end_date: payload.end_date,
			end_time: payload.end_time,
			is_active: payload.is_active,
			scope: payload.scope,
		}, { onConflict: 'announcement_id' })
	if (error) throw error
}

/** 刪除（停用）某公告的限制設定 */
export async function deleteRestrictionByAnnouncementId(announcementId: number): Promise<void> {
	const { error } = await supabase
		.from('reservation_restrictions')
		.delete()
		.eq('announcement_id', announcementId)
	if (error) throw error
}

/**
 * 全域限制檢查：只要任意啟用中的限制與指定時段重疊，即回傳 true。
 * reasonText 需由呼叫端提供（通常是該限制對應的公告內容）。
 */
export async function checkGlobalRestriction(
	date: string,
	startTime: string,
	endTime?: string,
	durationMin?: number,
	personIds: string[] = [],
): Promise<RestrictionCheckResult> {
	try {
		const [h, m] = startTime.split(':').map(Number)
		const startMinutes = h * 60 + m
		let endMinutes = startMinutes
		if (endTime) {
			const [eh, em] = endTime.split(':').map(Number)
			endMinutes = eh * 60 + em
		} else if (durationMin) {
			endMinutes = startMinutes + durationMin
		}

		// 查出今日覆蓋的所有限制（活躍）
		// 這裡使用 any 以避免與型別生成器耦合（不影響執行邏輯）
		const { data, error } = await (supabase as any)
			.from('reservation_restrictions_with_announcement_view')
			.select('*')
			.eq('is_active', true)
			.lte('start_date', date)
			.gte('end_date', date)
		if (error) {
			console.error('checkGlobalRestriction error:', error)
			return { isRestricted: false }
		}
		if (!data || data.length === 0) return { isRestricted: false }

		for (const record of data as any[]) {
			const restrictedPersonIds = Array.isArray(record.coach_ids)
				? record.coach_ids.map(String)
				: []
			if (!restrictionAppliesToPeople(record.scope, restrictedPersonIds, personIds)) {
				continue
			}
			// 如果當天在中間日，視為全天
			let rStart = 0
			let rEnd = 24 * 60
			if (record.start_date === date && record.start_time) {
				const [sh, sm] = String(record.start_time).split(':').map(Number)
				rStart = sh * 60 + sm
			}
			if (record.end_date === date && record.end_time) {
				const [eh2, em2] = String(record.end_time).split(':').map(Number)
				rEnd = eh2 * 60 + em2
			}
			if (!(endMinutes <= rStart || startMinutes >= rEnd)) {
				return {
					isRestricted: true,
					reason: record.content as string | undefined,
					startDate: record.start_date,
					startTime: record.start_time,
					endDate: record.end_date,
					endTime: record.end_time,
					restrictedPersonIds,
				}
			}
		}
		return { isRestricted: false }
	} catch (e) {
		console.error('Unexpected error in checkGlobalRestriction:', e)
		return { isRestricted: false }
	}
}


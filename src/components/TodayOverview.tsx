import { useMemo } from 'react'
import type { Booking } from '../types/booking'
import { isFacility } from '../utils/facility'

interface TodayOverviewProps {
    bookings: Booking[]
    isMobile: boolean
}

export function TodayOverview({ bookings, isMobile }: TodayOverviewProps) {
    const stats = useMemo(() => {
        const safeBookings = bookings || []
        // 統計數據
        const totalBookings = safeBookings.length
        const totalDurationMinutes = safeBookings.reduce((sum, b) => sum + (b.duration_min || 0), 0)

        // 教練使用統計（筆數 + 總時長）
        const coachStats = new Map<string, { count: number, totalMinutes: number }>()
        safeBookings.forEach((booking) => {
            booking.coaches?.forEach((coach) => {
                // 安全檢查：確保 coach 不是 null 且有 name
                if (!coach || !coach.name) {
                    return
                }
                
                const current = coachStats.get(coach.name) || { count: 0, totalMinutes: 0 }
                coachStats.set(coach.name, {
                    count: current.count + 1,
                    totalMinutes: current.totalMinutes + booking.duration_min
                })
            })
        })
        const sortedCoaches = Array.from(coachStats.entries())
            .sort((a, b) =>
                b[1].totalMinutes - a[1].totalMinutes ||
                a[0].localeCompare(b[0], 'zh-Hant')
            )

        // 駕駛使用統計（筆數 + 總時長）- 排除彈簧床
        const driverStats = new Map<string, { count: number, totalMinutes: number }>()
        safeBookings.forEach(booking => {
            // 設施不需要駕駛，不計入駕駛統計
            if (isFacility(booking.boats?.name)) return

            booking.drivers?.forEach(driver => {
                // 安全檢查：確保 driver 不是 null 且有 name
                if (!driver || !driver.name) return
                
                const current = driverStats.get(driver.name) || { count: 0, totalMinutes: 0 }
                driverStats.set(driver.name, {
                    count: current.count + 1,
                    totalMinutes: current.totalMinutes + booking.duration_min
                })
            })
        })
        const sortedDrivers = Array.from(driverStats.entries())
            .sort((a, b) =>
                b[1].totalMinutes - a[1].totalMinutes ||
                a[0].localeCompare(b[0], 'zh-Hant')
            )

        // 教練 + 駕駛 合併統計（同一人同一筆只計一次）
        const combinedStats = new Map<string, { count: number, totalMinutes: number }>()
        for (const booking of safeBookings) {
            const uniquePeople = new Set<string>()
            booking.coaches?.forEach(c => { if (c?.name) uniquePeople.add(c.name) })
            if (!isFacility(booking.boats?.name)) {
                booking.drivers?.forEach(d => { if (d?.name) uniquePeople.add(d.name) })
            }
            for (const name of uniquePeople) {
                const current = combinedStats.get(name) || { count: 0, totalMinutes: 0 }
                combinedStats.set(name, {
                    count: current.count + 1,
                    totalMinutes: current.totalMinutes + booking.duration_min
                })
            }
        }
        const sortedCombined = Array.from(combinedStats.entries())
            .sort((a, b) =>
                b[1].totalMinutes - a[1].totalMinutes ||
                a[0].localeCompare(b[0], 'zh-Hant')
            )

        // 船隻使用統計（筆數 + 總時長）
        const boatStats = new Map<string, { count: number, totalMinutes: number }>()
        safeBookings.forEach(booking => {
            if (booking.boats?.name) {
                const current = boatStats.get(booking.boats.name) || { count: 0, totalMinutes: 0 }
                boatStats.set(booking.boats.name, {
                    count: current.count + 1,
                    totalMinutes: current.totalMinutes + booking.duration_min
                })
            }
        })
        const sortedBoats = Array.from(boatStats.entries())
            .sort((a, b) =>
                b[1].totalMinutes - a[1].totalMinutes ||
                a[0].localeCompare(b[0], 'zh-Hant')
            )

        return {
            totalBookings,
            totalDurationMinutes,
            sortedCoaches,
            sortedDrivers,
            sortedCombined,
            sortedBoats
        }
    }, [bookings])

    const { totalBookings, totalDurationMinutes, sortedCoaches, sortedDrivers, sortedCombined, sortedBoats } = stats

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '16px 20px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
            <div style={{
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '700',
                color: '#2c3e50',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                📊 今日總覽
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: isMobile ? '12px' : '16px',
            }}>
                {/* 總預約數 */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                }}>
                    <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '4px' }}>總預約數</div>
                    <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: '#0c4a6e' }}>
                        {totalBookings} 筆
                    </div>
                    <div style={{ fontSize: '12px', color: '#0c4a6e', marginTop: '2px' }}>合計 {totalDurationMinutes} 分</div>
                </div>

                {/* 總時長（教練＋駕駛） */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#faf5ff',
                    borderRadius: '8px',
                    border: '1px solid #e9d5ff',
                }}>
                    <div style={{ fontSize: '12px', color: '#6b21a8', marginBottom: '8px' }}>總時長（教練＋駕駛）</div>
                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#581c87', lineHeight: '1.6' }}>
                        {sortedCombined.length > 0
                            ? sortedCombined.map(([name, s]) => `${name}×${s.count}｜${s.totalMinutes}分`).join('、')
                            : '—'}
                    </div>
                </div>

                {/* 教練使用 */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                }}>
                    <div style={{ fontSize: '12px', color: '#15803d', marginBottom: '8px' }}>教練（依總分）</div>
                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#166534', lineHeight: '1.6' }}>
                        {sortedCoaches.length > 0
                            ? sortedCoaches.map(([name, s]) => `${name}×${s.count}｜${s.totalMinutes}分`).join('、')
                            : '—'}
                    </div>
                </div>

                {/* 駕駛使用 */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                }}>
                    <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '8px' }}>駕駛（依總分）</div>
                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#1e3a8a', lineHeight: '1.6' }}>
                        {sortedDrivers.length > 0
                            ? sortedDrivers.map(([name, s]) => `${name}×${s.count}｜${s.totalMinutes}分`).join('、')
                            : '—'}
                    </div>
                </div>

                {/* 船隻使用 */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '8px',
                    border: '1px solid #fde68a',
                }}>
                    <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '8px' }}>船（依總分）</div>
                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#78350f', lineHeight: '1.6' }}>
                        {sortedBoats.length > 0
                            ? sortedBoats.map(([name, s]) => `${name}×${s.count}｜${s.totalMinutes}分`).join('、')
                            : '—'}
                    </div>
                </div>
            </div>
        </div>
    )
}

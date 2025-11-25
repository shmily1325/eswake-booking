import { useMemo } from 'react'
import type { Booking } from '../types/booking'

interface TodayOverviewProps {
    bookings: Booking[]
    isMobile: boolean
}

export function TodayOverview({ bookings, isMobile }: TodayOverviewProps) {
    const stats = useMemo(() => {
        const safeBookings = bookings || []
        // 統計數據
        const totalBookings = safeBookings.length

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
        const topCoaches = Array.from(coachStats.entries())
            .sort((a, b) => b[1].count - a[1].count)

        // 駕駛使用統計（筆數 + 總時長）- 排除彈簧床
        const driverStats = new Map<string, { count: number, totalMinutes: number }>()
        safeBookings.forEach(booking => {
            // 彈簧床不需要駕駛，不計入駕駛統計
            if (booking.boats?.name === '彈簧床') return

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
        const topDrivers = Array.from(driverStats.entries())
            .sort((a, b) => b[1].count - a[1].count)

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
        const topBoats = Array.from(boatStats.entries())
            .sort((a, b) => b[1].count - a[1].count)

        return {
            totalBookings,
            topCoaches,
            topDrivers,
            topBoats
        }
    }, [bookings])

    const { totalBookings, topCoaches, topDrivers, topBoats } = stats

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
                </div>

                {/* 教練使用 */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                }}>
                    <div style={{ fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>教練</div>
                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#166534', lineHeight: '1.6' }}>
                        {topCoaches.length > 0
                            ? topCoaches.map(([name, stats]) => `${name}(${stats.count}筆, 共${stats.totalMinutes}分)`).join('、')
                            : '無'}
                    </div>
                </div>

                {/* 駕駛使用 */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                }}>
                    <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '4px' }}>駕駛</div>
                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#1e3a8a', lineHeight: '1.6' }}>
                        {topDrivers.length > 0
                            ? topDrivers.map(([name, stats]) => `${name}(${stats.count}筆, 共${stats.totalMinutes}分)`).join('、')
                            : '無'}
                    </div>
                </div>

                {/* 船隻使用 */}
                <div style={{
                    padding: '12px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '8px',
                    border: '1px solid #fde68a',
                }}>
                    <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>船</div>
                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#78350f', lineHeight: '1.6' }}>
                        {topBoats.map(([name, stats]) => `${name}(${stats.count}筆, 共${stats.totalMinutes}分)`).join('、')}
                    </div>
                </div>
            </div>
        </div>
    )
}

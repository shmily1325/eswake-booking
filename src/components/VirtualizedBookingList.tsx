import React, { useState, useCallback } from 'react'
import type { Booking, Boat } from '../types/booking'
import { getDisplayContactName, formatBookingForCopy } from '../utils/bookingFormat'
import { validateBoats, validateBookings } from '../utils/safetyHelpers'

interface VirtualizedBookingListProps {
    boats: Boat[]
    bookings: Booking[]
    isMobile: boolean
    onBookingClick: (boatId: number, timeSlot: string, booking: Booking) => void
}

export function VirtualizedBookingList({ boats, bookings, isMobile, onBookingClick }: VirtualizedBookingListProps) {
    // 複製成功的預約 ID
    const [copiedBookingId, setCopiedBookingId] = useState<number | null>(null)

    // 複製預約資訊
    const handleCopyBooking = useCallback(async (e: React.MouseEvent, booking: Booking) => {
        e.stopPropagation() // 防止觸發 onBookingClick
        
        const text = formatBookingForCopy(booking)
        
        try {
            await navigator.clipboard.writeText(text)
            setCopiedBookingId(booking.id)
            // 1.5 秒後重置
            setTimeout(() => setCopiedBookingId(null), 1500)
        } catch (err) {
            console.error('複製失敗:', err)
        }
    }, [])

    // 驗證並過濾資料，確保沒有 null/undefined
    const validBoats = React.useMemo(() => {
        return validateBoats(boats)
    }, [boats])
    
    const validBookings = React.useMemo(() => {
        return validateBookings(bookings)
    }, [bookings])

    // 預先處理數據：將預約按船隻分組並排序
    const boatBookingsMap = React.useMemo(() => {
        const map = new Map<number, Booking[]>()

        validBoats.forEach(boat => {
            const boatBookings = validBookings
                .filter(b => b.boat_id === boat.id)
                .sort((a, b) => a.start_at.localeCompare(b.start_at))
            map.set(boat.id, boatBookings)
        })
        return map
    }, [validBoats, validBookings])

    if (validBoats.length === 0) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#999',
                fontSize: '14px'
            }}>
                沒有可用的船隻
            </div>
        )
    }

    return (
        <div style={{
            width: '100%',
            background: '#f8f9fa',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
        }}>
            {validBoats.map((boat) => {
                const boatBookings = boatBookingsMap.get(boat.id) || []

                return (
                    <div
                        key={boat.id}
                        style={{
                            display: 'flex',
                            borderBottom: '2px solid #e9ecef',
                            // minHeight: isMobile ? '140px' : '160px' // 移除固定最小高度，讓內容自然撐開
                        }}
                    >
                        {/* 左側船名欄 */}
                        <div style={{
                            minWidth: isMobile ? '80px' : '120px',
                            maxWidth: isMobile ? '80px' : '120px',
                            background: '#5a5a5a',
                            color: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: isMobile ? '12px 8px' : '16px 12px',
                            borderRight: '2px solid #e9ecef',
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                        }}>
                            <div style={{
                                fontSize: isMobile ? '14px' : '16px',
                                fontWeight: '700',
                                marginBottom: '4px',
                                textAlign: 'center',
                                wordBreak: 'keep-all',
                            }}>
                                {boat.name}
                            </div>
                            <div style={{
                                fontSize: isMobile ? '11px' : '12px',
                                opacity: 0.8,
                                textAlign: 'center',
                            }}>
                                {boatBookings.length} 筆
                            </div>
                        </div>

                        {/* 右側預約列表 - 垂直排列 */}
                        <div style={{
                            flex: 1,
                            backgroundColor: 'white',
                            minHeight: boatBookings.length === 0 ? (isMobile ? '80px' : '100px') : 'auto', // 只有沒預約時才設最小高度
                        }}>
                            {boatBookings.length === 0 ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    color: '#999',
                                    fontSize: isMobile ? '13px' : '14px',
                                    fontStyle: 'italic',
                                }}>
                                    今日無預約
                                </div>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}>
                                    {boatBookings.map((booking, bookingIndex) => {
                                        // 計算時間（validateBookings 已確保資料完整）
                                        const startDatetime = booking.start_at.substring(0, 16)
                                        const [, startTimeStr] = startDatetime.split('T')
                                        const [startHour, startMinute] = startTimeStr.split(':').map(Number)
                                        const endMinutes = startHour * 60 + startMinute + booking.duration_min
                                        const endHour = Math.floor(endMinutes / 60)
                                        const endMin = endMinutes % 60
                                        const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`

                                        return (
                                            <div
                                                key={booking.id}
                                                style={{
                                                    padding: isMobile ? '12px' : '14px 16px',
                                                    borderBottom: bookingIndex < boatBookings.length - 1 ? '1px solid #f0f0f0' : 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    gap: isMobile ? '10px' : '14px',
                                                    alignItems: 'center',
                                                    backgroundColor: 'white',
                                                }}
                                                onClick={() => onBookingClick(booking.boat_id, booking.start_at.substring(11, 16), booking)}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#f8f9fa'
                                                    e.currentTarget.style.transform = 'translateX(4px)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'white'
                                                    e.currentTarget.style.transform = 'translateX(0)'
                                                }}
                                            >
                                                {/* 時間區塊 */}
                                                <div style={{
                                                    minWidth: isMobile ? '70px' : '85px',
                                                    padding: isMobile ? '6px 8px' : '8px 10px',
                                                    backgroundColor: '#5a5a5a',
                                                    color: 'white',
                                                    borderRadius: '6px',
                                                    fontSize: isMobile ? '12px' : '13px',
                                                    fontWeight: '600',
                                                    textAlign: 'center',
                                                    lineHeight: '1.3',
                                                    flexShrink: 0,
                                                }}>
                                                    <div>{startTimeStr}</div>
                                                    <div style={{ fontSize: '10px', opacity: 0.7, margin: '2px 0' }}>↓</div>
                                                    <div>{endTimeStr}</div>
                                                    <div style={{
                                                        fontSize: '10px',
                                                        marginTop: '3px',
                                                        opacity: 0.7,
                                                        backgroundColor: 'rgba(255,255,255,0.15)',
                                                        borderRadius: '4px',
                                                        padding: '2px',
                                                    }}>
                                                        {booking.duration_min}分
                                                    </div>
                                                </div>

                                                {/* 預約內容 */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {/* 教練練習標識 */}
                                                    {booking.is_coach_practice && (
                                                        <div style={{
                                                            display: 'inline-block',
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            padding: '3px 8px',
                                                            background: '#fff3e0',
                                                            color: '#e65100',
                                                            borderRadius: '4px',
                                                            marginBottom: '6px',
                                                            border: '1px solid #ff9800',
                                                        }}>
                                                            🏄 教練練習
                                                        </div>
                                                    )}
                                                    
                                                    {/* 第一行：預約人 */}
                                                    <div style={{
                                                        fontSize: isMobile ? '14px' : '16px',
                                                        fontWeight: '700',
                                                        color: '#2c3e50',
                                                        marginBottom: '4px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {getDisplayContactName(booking) || '未命名'}
                                                    </div>

                                                    {/* 第二行：教練 + 駕駛 + 活動類型 */}
                                                    <div style={{
                                                        fontSize: isMobile ? '12px' : '13px',
                                                        color: '#7f8c8d',
                                                        lineHeight: '1.4',
                                                    }}>
                                                        {booking.coaches && booking.coaches.length > 0 && (
                                                            <span>🎓 {booking.coaches.filter(c => c && c.name).map(c => c.name).join('/')}</span>
                                                        )}
                                                        {booking.drivers && booking.drivers.length > 0 && (
                                                            <>
                                                                {booking.coaches && booking.coaches.length > 0 && <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>}
                                                                <span>🚤 {booking.drivers.filter(d => d && d.name).map(d => d.name).join('/')}</span>
                                                            </>
                                                        )}
                                                        {booking.requires_driver && (!booking.drivers || booking.drivers.length === 0) && (
                                                            <>
                                                                {booking.coaches && booking.coaches.length > 0 && <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>}
                                                                <span style={{ color: '#f59e0b' }}>🚤 需要駕駛</span>
                                                            </>
                                                        )}
                                                        {booking.activity_types && booking.activity_types.length > 0 && (
                                                            <>
                                                                {((booking.coaches && booking.coaches.length > 0) || (booking.drivers && booking.drivers.length > 0) || booking.requires_driver) && <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>}
                                                                <span style={{ 
                                                                    backgroundColor: '#dbeafe', 
                                                                    color: '#1e40af',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    fontSize: isMobile ? '11px' : '12px',
                                                                    fontWeight: '600',
                                                                }}>
                                                                    {booking.activity_types.join('+')}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* 第三行：備註 / 排班備註 */}
                                                    {(booking.notes || booking.schedule_notes) && (
                                                        <div style={{
                                                            fontSize: isMobile ? '11px' : '12px',
                                                            color: '#999',
                                                            lineHeight: '1.4',
                                                        }}>
                                                            {booking.notes && (
                                                                <span style={{ fontStyle: 'italic' }}>💬 {booking.notes}</span>
                                                            )}
                                                            {booking.notes && booking.schedule_notes && <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>}
                                                            {booking.schedule_notes && (
                                                                <span>📝 {booking.schedule_notes}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 複製按鈕 - 靠右 */}
                                                <button
                                                    onClick={(e) => handleCopyBooking(e, booking)}
                                                    title="複製預約資訊"
                                                    style={{
                                                        width: isMobile ? '32px' : '36px',
                                                        height: isMobile ? '32px' : '36px',
                                                        borderRadius: '6px',
                                                        border: copiedBookingId === booking.id ? '1px solid #22c55e' : '1px solid #e9ecef',
                                                        background: copiedBookingId === booking.id ? '#dcfce7' : '#f8f9fa',
                                                        color: copiedBookingId === booking.id ? '#16a34a' : '#6b7280',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: isMobile ? '14px' : '16px',
                                                        flexShrink: 0,
                                                        transition: 'all 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (copiedBookingId !== booking.id) {
                                                            e.currentTarget.style.background = '#e5e7eb'
                                                            e.currentTarget.style.borderColor = '#d1d5db'
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (copiedBookingId !== booking.id) {
                                                            e.currentTarget.style.background = '#f8f9fa'
                                                            e.currentTarget.style.borderColor = '#e9ecef'
                                                        }
                                                    }}
                                                >
                                                    {copiedBookingId === booking.id ? '✓' : '📋'}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

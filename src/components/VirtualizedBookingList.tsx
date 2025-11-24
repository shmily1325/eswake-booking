import React from 'react'
import type { Booking, Boat } from '../types/booking'
import { getBookingCardStyle, bookingCardContentStyles, getStatusBadgeStyle } from '../styles/designSystem'
import { formatTimeRange, getDisplayContactName } from '../utils/bookingFormat'

interface VirtualizedBookingListProps {
    boats: Boat[]
    bookings: Booking[]
    isMobile: boolean
    onBookingClick: (boatId: number, timeSlot: string, booking: Booking) => void
}

export function VirtualizedBookingList({ boats, bookings, isMobile, onBookingClick }: VirtualizedBookingListProps) {
    // 預先處理數據：將預約按船隻分組並排序
    const boatBookingsMap = React.useMemo(() => {
        const map = new Map<number, Booking[]>()
        const safeBoats = boats || []
        const safeBookings = bookings || []

        safeBoats.forEach(boat => {
            const boatBookings = safeBookings
                .filter(b => b.boat_id === boat.id)
                .sort((a, b) => a.start_at.localeCompare(b.start_at))
            map.set(boat.id, boatBookings)
        })
        return map
    }, [boats, bookings])

    const safeBoats = boats || []

    if (safeBoats.length === 0) {
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
            overflow: 'auto',
            maxHeight: 'calc(100vh - 250px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
        }}>
            {safeBoats.map((boat) => {
                const boatBookings = boatBookingsMap.get(boat.id) || []

                return (
                    <div
                        key={boat.id}
                        style={{
                            display: 'flex',
                            borderBottom: '2px solid #e9ecef',
                            minHeight: isMobile ? '140px' : '160px'
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

                        {/* 右側預約列表 */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            gap: isMobile ? '8px' : '12px',
                            padding: isMobile ? '8px' : '12px',
                            overflowX: 'auto',
                            alignItems: 'center',
                            background: 'white'
                        }}>
                            {boatBookings.length === 0 ? (
                                <div style={{
                                    color: '#999',
                                    fontSize: isMobile ? '13px' : '14px',
                                    fontStyle: 'italic',
                                }}>
                                    無預約
                                </div>
                            ) : (
                                boatBookings.map(booking => {
                                    const boatColor = boat.color || '#4a90e2'
                                    const cardStyle = getBookingCardStyle(boatColor, isMobile, true)
                                    const statusBadgeStyle = getStatusBadgeStyle(booking.status as any)

                                    return (
                                        <div
                                            key={booking.id}
                                            onClick={() => onBookingClick(booking.boat_id, booking.start_at.substring(11, 16), booking)}
                                            style={{
                                                ...cardStyle,
                                                minWidth: isMobile ? '200px' : '280px',
                                                padding: isMobile ? '10px' : '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                flexShrink: 0,
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)'
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)'
                                                e.currentTarget.style.boxShadow = cardStyle.boxShadow || ''
                                            }}
                                        >
                                            {/* 時間標籤 */}
                                            <div style={{
                                                ...statusBadgeStyle,
                                                fontSize: isMobile ? '11px' : '12px',
                                                padding: '4px 8px',
                                                marginBottom: '8px',
                                                display: 'inline-block',
                                            }}>
                                                {formatTimeRange(booking.start_at, booking.duration_min)}
                                            </div>

                                            {/* 預約人 */}
                                            <div style={{
                                                ...bookingCardContentStyles.contactName(isMobile),
                                            }}>
                                                {getDisplayContactName(booking)}
                                            </div>

                                            {/* 教練 */}
                                            {booking.coaches && booking.coaches.length > 0 && (
                                                <div style={{
                                                    ...bookingCardContentStyles.coachName(boatColor, isMobile),
                                                }}>
                                                    教練: {booking.coaches.map(c => c.name).join(', ')}
                                                </div>
                                            )}

                                            {/* 駕駛 */}
                                            {booking.drivers && booking.drivers.length > 0 && (
                                                <div style={{
                                                    ...bookingCardContentStyles.coachName(boatColor, isMobile),
                                                }}>
                                                    駕駛: {booking.drivers.map(d => d.name).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

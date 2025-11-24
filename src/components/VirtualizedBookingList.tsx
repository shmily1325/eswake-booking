import React from 'react'
import * as ReactWindow from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import type { Booking, Boat } from '../types/booking'
import { getBookingCardStyle, bookingCardContentStyles, getStatusBadgeStyle } from '../styles/designSystem'
import { formatTimeRange, getDisplayContactName } from '../utils/bookingFormat'

// Workaround for react-window v2 vs @types/react-window v1 mismatch
// We define the expected shape explicitly to avoid using 'any'
interface FixedSizeListProps {
    height: number | string
    itemCount: number
    itemSize: number
    width: number | string
    // react-window expects itemData to always be an object; keep it optional for typing
    itemData?: Record<string, unknown>
    children: React.ComponentType<{ index: number; style: React.CSSProperties; data?: any }>
}

type ReactWindowModule = {
    List?: React.ComponentType<FixedSizeListProps>
    FixedSizeList?: React.ComponentType<FixedSizeListProps>
}

// Cast to unknown first, then to our module type, then extract the component
// Finally cast to ComponentType to ensure TS treats it as a valid JSX element
const List = ((ReactWindow as unknown as ReactWindowModule).List ||
    (ReactWindow as unknown as ReactWindowModule).FixedSizeList) as React.ComponentType<FixedSizeListProps>

if (!List) {
    throw new Error('Could not find FixedSizeList or List in react-window module')
}

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

    // 渲染單個船隻的預約行
    const BoatRow = React.memo(({ index, style, data: _data }: { index: number; style: React.CSSProperties; data?: any }) => {
        const safeBoats = boats || []
        const boat = safeBoats[index]
        if (!boat) return null

        const boatBookings = boatBookingsMap.get(boat.id) || []

        return (
            <div style={{ ...style, display: 'flex', borderBottom: '2px solid #e9ecef' }}>
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
                    zIndex: 1,
                    height: '100%',
                }}>
                    <div style={{
                        fontSize: isMobile ? '15px' : '18px',
                        fontWeight: '700',
                        marginBottom: '8px',
                        textAlign: 'center',
                        lineHeight: '1.2',
                    }}>
                        {boat.name}
                    </div>
                    <div style={{
                        fontSize: isMobile ? '11px' : '13px',
                        opacity: 0.85,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: '500',
                    }}>
                        {boatBookings.length} 筆
                    </div>
                </div>

                {/* 右側預約列表 - 水平滾動 */}
                <div style={{
                    flex: 1,
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    padding: isMobile ? '8px' : '12px',
                    gap: isMobile ? '8px' : '12px',
                    overflowX: 'auto',
                    height: '100%',
                }}>
                    {boatBookings.length === 0 ? (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#999',
                            fontSize: isMobile ? '13px' : '14px',
                            fontStyle: 'italic',
                        }}>
                            今日無預約
                        </div>
                    ) : (
                        boatBookings.map(booking => {
                            const boatColor = boat.color || '#4a90e2'
                            const timeRange = formatTimeRange(booking.start_at, booking.duration_min)
                            const contactName = getDisplayContactName(booking)

                            return (
                                <div
                                    key={booking.id}
                                    onClick={() => onBookingClick(booking.boat_id, booking.start_at.substring(11, 16), booking)}
                                    style={{
                                        ...getBookingCardStyle(boatColor, isMobile, true),
                                        minWidth: isMobile ? '140px' : '180px',
                                        height: isMobile ? 'auto' : '100%', // 讓卡片填滿高度
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {/* 狀態標籤 */}
                                    <div style={getStatusBadgeStyle(booking.status as any)} />

                                    {/* 時間 */}
                                    <div style={bookingCardContentStyles.timeRange(isMobile)}>
                                        {timeRange}
                                    </div>

                                    {/* 聯絡人 */}
                                    <div style={bookingCardContentStyles.contactName(isMobile)}>
                                        {contactName}
                                    </div>

                                    {/* 教練/駕駛 */}
                                    {(booking.coaches && booking.coaches.length > 0) && (
                                        <div style={bookingCardContentStyles.coachName(boatColor, isMobile)}>
                                            教練: {booking.coaches.map(c => c.name).join(', ')}
                                        </div>
                                    )}
                                    {(booking.drivers && booking.drivers.length > 0) && (
                                        <div style={bookingCardContentStyles.coachName(boatColor, isMobile)}>
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
    })

    // 計算每行高度
    const itemSize = isMobile ? 140 : 160
    const safeBoats = boats || []

    return (
        <div style={{
            height: 'calc(100vh - 250px)', // 動態計算高度，扣除 header 和其他元素
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
        }}>
            <AutoSizer>
                {({ height, width }: { height: number; width: number }) => {
                    // 防禦性檢查：確保 height 和 width 有效
                    if (!height || !width || safeBoats.length === 0) {
                        return (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#999'
                            }}>
                                {safeBoats.length === 0 ? '沒有可用的船隻' : '載入中...'}
                            </div>
                        )
                    }

                    return (
                        <List
                            height={height}
                            itemCount={safeBoats.length}
                            itemSize={itemSize}
                            width={width}
                            // react-window v2 會對 itemData 呼叫 Object.values，因此不能傳 undefined
                            // 確保傳入的對象不是 null/undefined
                            itemData={{ boatsLength: safeBoats.length || 0 }}
                        >
                            {BoatRow}
                        </List>
                    )
                }}
            </AutoSizer>
        </div>
    )
}

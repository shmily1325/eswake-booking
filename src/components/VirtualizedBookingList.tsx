import React from 'react'
import type { Booking, Boat } from '../types/booking'
import { getDisplayContactName } from '../utils/bookingFormat'
import { validateBoats, validateBookings } from '../utils/safetyHelpers'
import type { BoatUnavailableBlock } from '../utils/boatUnavailableDay'
import type { RestrictionDayBlock } from '../utils/restrictionDayBlocks'
import { getBoatSidebarDayAlert } from '../utils/dayViewBoatSidebarAlert'
import { designSystem } from '../styles/designSystem'

interface VirtualizedBookingListProps {
    boats: Boat[]
    bookings: Booking[]
    isMobile: boolean
    onBookingClick: (boatId: number, timeSlot: string, booking: Booking) => void
    conflictedBookingIds?: Set<number>
	conflictReasons?: Map<number, string>
    boatUnavailableBlocks?: BoatUnavailableBlock[]
    restrictionDayBlocks?: RestrictionDayBlock[]
}

export function VirtualizedBookingList({
    boats,
    bookings,
    isMobile,
    onBookingClick,
    conflictedBookingIds,
    conflictReasons,
    boatUnavailableBlocks = [],
    restrictionDayBlocks = [],
}: VirtualizedBookingListProps) {
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
                color: designSystem.colors.text.disabled,
                fontSize: '14px'
            }}>
                沒有可用的船隻
            </div>
        )
    }

    return (
        <div style={{
            width: '100%',
            background: designSystem.colors.background.card,
            borderRadius: designSystem.borderRadius.lg,
            boxShadow: designSystem.shadows.sm,
            border: `1px solid ${designSystem.colors.border.light}`,
            overflow: 'hidden',
        }}>
            {validBoats.map((boat, boatIndex) => {
                const boatBookings = boatBookingsMap.get(boat.id) || []
                const sidebarAlert = getBoatSidebarDayAlert(
                    boat.id,
                    boatUnavailableBlocks,
                    restrictionDayBlocks
                )

                return (
                    <div
                        key={boat.id}
                        style={{
                            display: 'flex',
                            /* 分隔畫在本列上緣（非上一列下緣），線在 sticky 側欄「上方」，較不易被蓋掉；#dee2e6 比 #e9ecef 稍深，深灰／白底都較清楚 */
                            borderTop: boatIndex > 0 ? `1px solid ${designSystem.colors.border.light}` : undefined,
                            // minHeight: isMobile ? '140px' : '160px' // 移除固定最小高度，讓內容自然撐開
                        }}
                    >
                        {/* 左側船名欄 */}
                        <div style={{
                            minWidth: isMobile ? '80px' : '120px',
                            maxWidth: isMobile ? '80px' : '120px',
                            background: designSystem.colors.secondary[800],
                            color: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: isMobile ? '12px 8px' : '16px 12px',
                            borderRight: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: boatIndex > 0 ? 'inset 0 1px 0 rgba(255,255,255,0.1)' : undefined,
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                        }}
                            title={sidebarAlert.show ? sidebarAlert.title : undefined}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                width: '100%',
                                minWidth: 0,
                                marginBottom: '4px',
                            }}>
                                <span
                                    aria-hidden
                                    style={{
                                        width: isMobile ? '7px' : '8px',
                                        height: isMobile ? '7px' : '8px',
                                        borderRadius: '50%',
                                        background: boat.color || designSystem.colors.border.dark,
                                        border: '1px solid rgba(255,255,255,0.45)',
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{
                                    minWidth: 0,
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    wordBreak: 'keep-all',
                                    fontSize: isMobile ? '14px' : '16px',
                                    fontWeight: '700',
                                    textAlign: 'center',
                                }}>
                                    {boat.name}
                                </span>
                            </div>
                            {sidebarAlert.show && (
                                <div style={{
                                    fontSize: isMobile ? '9px' : '10px',
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                    textAlign: 'center',
                                    color: designSystem.colors.warning[700],
                                    background: designSystem.colors.warning[50],
                                    border: `1px solid ${designSystem.colors.warning[500]}33`,
                                    borderRadius: designSystem.borderRadius.sm,
                                    padding: '2px 4px',
                                    marginBottom: '4px',
                                    maxWidth: '100%',
                                    wordBreak: 'break-word',
                                }}>
                                    {sidebarAlert.label}
                                </div>
                            )}
                            <div style={{
                                fontSize: isMobile ? '11px' : '12px',
                                color: 'rgba(255,255,255,0.65)',
                                textAlign: 'center',
                            }}>
                                {boatBookings.length} 筆
                            </div>
                        </div>

                        {/* 右側預約列表 - 垂直排列 */}
                        <div style={{
                            flex: 1,
                            backgroundColor: designSystem.colors.background.card,
                            minHeight: boatBookings.length === 0 ? (isMobile ? '80px' : '100px') : 'auto',
                        }}>
                            {boatBookings.length === 0 ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    color: designSystem.colors.text.disabled,
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
                                                data-track="day_edit_booking"
                                                style={{
                                                    padding: isMobile ? '12px' : '14px 16px',
                                                    borderBottom: bookingIndex < boatBookings.length - 1 ? `1px solid ${designSystem.colors.border.light}` : 'none',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s',
                                                    display: 'flex',
                                                    gap: isMobile ? '10px' : '14px',
                                                    alignItems: 'center',
                                                    backgroundColor: designSystem.colors.background.card,
                                                    border: conflictedBookingIds?.has(booking.id)
                                                        ? `2px solid ${designSystem.colors.danger[500]}`
                                                        : `1px solid ${designSystem.colors.border.light}`,
                                                    borderRadius: designSystem.borderRadius.md,
                                                    boxShadow: conflictedBookingIds?.has(booking.id)
                                                        ? `0 0 0 1px ${designSystem.colors.danger[500]}22 inset`
                                                        : undefined,
                                                }}
												title={!isMobile ? (conflictReasons?.get(booking.id) || undefined) : undefined}
                                                onClick={() => onBookingClick(booking.boat_id, booking.start_at.substring(11, 16), booking)}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = designSystem.colors.background.hover
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = designSystem.colors.background.card
                                                }}
                                            >
                                                {/* 時間區塊 */}
                                                <div style={{
                                                    minWidth: isMobile ? '70px' : '85px',
                                                    padding: isMobile ? '6px 8px' : '8px 10px',
                                                    backgroundColor: designSystem.colors.secondary[100],
                                                    color: designSystem.colors.text.primary,
                                                    borderRadius: designSystem.borderRadius.md,
                                                    borderLeft: `3px solid ${boat.color}`,
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
                                                        color: designSystem.colors.text.secondary,
                                                        backgroundColor: designSystem.colors.background.hover,
                                                        borderRadius: designSystem.borderRadius.sm,
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
                                                            background: designSystem.colors.warning[50],
                                                            color: designSystem.colors.warning[700],
                                                            borderRadius: designSystem.borderRadius.full,
                                                            marginBottom: '6px',
                                                            border: `1px solid ${designSystem.colors.warning[500]}33`,
                                                        }}>
                                                            教練練習
                                                        </div>
                                                    )}
                                                    
                                                    {/* 第一行：預約人 */}
												<div style={{
													fontSize: isMobile ? '14px' : '16px',
													fontWeight: '700',
													color: designSystem.colors.text.primary,
													marginBottom: '4px',
													display: 'flex',
													alignItems: 'center',
													gap: '6px',
													minWidth: 0,
												}}>
													{conflictedBookingIds?.has(booking.id) && (
														<span aria-hidden="true" style={{
															flex: '0 0 auto',
															lineHeight: 1,
															display: 'inline-block'
														}}>💣</span>
													)}
													<span style={{
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
														minWidth: 0
													}}>
														{getDisplayContactName(booking) || '未命名'}
													</span>
												</div>

													{/* 衝突原因（行內顯示） */}
													{conflictedBookingIds?.has(booking.id) && conflictReasons?.get(booking.id) && (
														<div style={{
															fontSize: '12px',
															color: designSystem.colors.danger[700],
															marginBottom: '4px',
															fontWeight: 600,
															lineHeight: 1.3,
														}}>
															{conflictReasons.get(booking.id)}
														</div>
													)}

                                                    {/* 第二行：教練 + 駕駛 + 活動類型 */}
                                                    <div style={{
                                                        fontSize: isMobile ? '12px' : '13px',
                                                        color: designSystem.colors.text.secondary,
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
                                                                <span style={{ color: designSystem.colors.warning[700] }}>需要駕駛</span>
                                                            </>
                                                        )}
                                                        {booking.activity_types && booking.activity_types.length > 0 && (
                                                            <>
                                                                {((booking.coaches && booking.coaches.length > 0) || (booking.drivers && booking.drivers.length > 0) || booking.requires_driver) && <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>}
                                                                <span style={{ 
                                                                    backgroundColor: designSystem.colors.secondary[100], 
                                                                    color: designSystem.colors.text.primary,
                                                                    padding: '2px 6px',
                                                                    borderRadius: designSystem.borderRadius.full,
                                                                    fontSize: isMobile ? '11px' : '12px',
                                                                    fontWeight: '600',
                                                                    border: `1px solid ${designSystem.colors.border.light}`,
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
                                                            color: designSystem.colors.text.disabled,
                                                            lineHeight: '1.4',
                                                        }}>
                                                            {booking.notes && (
                                                                <span style={{ fontStyle: 'italic' }}>{booking.notes}</span>
                                                            )}
                                                            {booking.notes && booking.schedule_notes && <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>}
                                                            {booking.schedule_notes && (
                                                                <span>{booking.schedule_notes}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
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

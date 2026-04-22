import React from 'react'
import { Link } from 'react-router-dom'
import { designSystem } from '../styles/designSystem'
import { getWeekdayText } from '../utils/date'

interface DayViewMobileHeaderProps {
    date: string
    onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onPrevDate: () => void
    onNextDate: () => void
    onGoToToday: () => void
}

export function DayViewMobileHeader({
    date,
    onDateChange,
    onPrevDate,
    onNextDate,
    onGoToToday,
}: DayViewMobileHeaderProps) {
    return (
        <div style={{ marginBottom: designSystem.spacing.lg }}>
            {/* 第一行：日期導航（與移除時間軸前相同；維持 iOS 日期欄 16px） */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: designSystem.spacing.sm,
                marginBottom: designSystem.spacing.md,
                backgroundColor: 'white',
                padding: designSystem.spacing.sm,
                borderRadius: designSystem.borderRadius.lg,
                boxShadow: designSystem.shadows.sm,
            }}>
                <button
                    type="button"
                    data-track="day_prev"
                    onClick={onPrevDate}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${designSystem.colors.border.main}`,
                        borderRadius: designSystem.borderRadius.md,
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        color: designSystem.colors.text.primary,
                        cursor: 'pointer',
                    }}
                    aria-label="Previous Day"
                >
                    ←
                </button>

                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        type="date"
                        value={date}
                        onChange={onDateChange}
                        style={{
                            width: '100%',
                            height: '44px',
                            padding: '0 12px',
                            borderRadius: designSystem.borderRadius.md,
                            border: `1px solid ${designSystem.colors.border.main}`,
                            fontSize: '16px', // 16px 防止 iOS 縮放
                            textAlign: 'center',
                            backgroundColor: '#f8f9fa',
                            color: designSystem.colors.text.primary,
                            outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '8px',
                        fontSize: '11px',
                        color: 'white',
                        fontWeight: '600',
                        background: '#5a5a5a',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        pointerEvents: 'none',
                    }}>
                        {getWeekdayText(date)}
                    </div>
                </div>

                <button
                    type="button"
                    data-track="day_next"
                    onClick={onNextDate}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${designSystem.colors.border.main}`,
                        borderRadius: designSystem.borderRadius.md,
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        color: designSystem.colors.text.primary,
                        cursor: 'pointer',
                    }}
                    aria-label="Next Day"
                >
                    →
                </button>

                <button
                    type="button"
                    data-track="day_today"
                    onClick={onGoToToday}
                    style={{
                        background: designSystem.colors.secondary[100],
                        border: `1px solid ${designSystem.colors.secondary[300]}`,
                        borderRadius: designSystem.borderRadius.md,
                        height: '44px',
                        padding: '0 12px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: designSystem.colors.text.secondary,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                    }}
                >
                    今天
                </button>
            </div>

            {/* 第二行：原「列表 | 時間軸」區塊改為僅列表（外觀與已選「列表」相同）+ 排班；版面與舊版一致 */}
            <div style={{ display: 'flex', gap: designSystem.spacing.sm }}>
                <div style={{
                    display: 'flex',
                    backgroundColor: '#e0e0e0',
                    borderRadius: designSystem.borderRadius.lg,
                    padding: '4px',
                    flex: 1,
                    height: '48px',
                    alignItems: 'center',
                }}>
                    <div
                        style={{
                            flex: 1,
                            height: '40px',
                            borderRadius: designSystem.borderRadius.md,
                            background: 'white',
                            color: designSystem.colors.primary[600],
                            fontWeight: '600',
                            fontSize: '14px',
                            boxShadow: designSystem.shadows.sm,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                        }}
                        aria-current="page"
                    >
                        <span>📋</span> 列表
                    </div>
                </div>

                <Link
                    data-track="day_to_assignment"
                    to={`/coach-assignment?date=${date}`}
                    style={{
                        textDecoration: 'none',
                        height: '48px',
                        padding: '0 16px',
                        backgroundColor: 'white',
                        border: `1px solid ${designSystem.colors.border.main}`,
                        borderRadius: designSystem.borderRadius.lg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: designSystem.colors.text.primary,
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: designSystem.shadows.sm,
                        whiteSpace: 'nowrap',
                    }}
                >
                    排班
                </Link>
            </div>
        </div>
    )
}

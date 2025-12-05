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
    viewMode: 'list' | 'timeline'
    onViewModeChange: (mode: 'list' | 'timeline') => void
}

export function DayViewMobileHeader({
    date,
    onDateChange,
    onPrevDate,
    onNextDate,
    onGoToToday,
    viewMode,
    onViewModeChange,
}: DayViewMobileHeaderProps) {
    return (
        <div style={{ marginBottom: designSystem.spacing.lg }}>
            {/* 第一行：日期導航 */}
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

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    {/* 星期幾顯示 - 放在日期選擇器下方 */}
                    <div style={{
                        fontSize: '12px',
                        color: designSystem.colors.text.secondary,
                        fontWeight: '500',
                        textAlign: 'center',
                    }}>
                        {getWeekdayText(date)}
                    </div>
                </div>

                <button
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

            {/* 第二行：視圖切換與操作 */}
            <div style={{ display: 'flex', gap: designSystem.spacing.sm }}>
                {/* 視圖切換 Segmented Control */}
                <div style={{
                    display: 'flex',
                    backgroundColor: '#e0e0e0',
                    borderRadius: designSystem.borderRadius.lg,
                    padding: '4px',
                    flex: 1,
                    height: '48px', // 增加高度以容納 44px 按鈕
                    alignItems: 'center',
                }}>
                    <button
                        onClick={() => onViewModeChange('list')}
                        style={{
                            flex: 1,
                            height: '40px',
                            border: 'none',
                            borderRadius: designSystem.borderRadius.md,
                            background: viewMode === 'list' ? 'white' : 'transparent',
                            color: viewMode === 'list' ? designSystem.colors.primary[600] : designSystem.colors.text.secondary,
                            fontWeight: viewMode === 'list' ? '600' : '500',
                            fontSize: '14px',
                            boxShadow: viewMode === 'list' ? designSystem.shadows.sm : 'none',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                        }}
                    >
                        <span>📋</span> 列表
                    </button>
                    <button
                        onClick={() => onViewModeChange('timeline')}
                        style={{
                            flex: 1,
                            height: '40px',
                            border: 'none',
                            borderRadius: designSystem.borderRadius.md,
                            background: viewMode === 'timeline' ? 'white' : 'transparent',
                            color: viewMode === 'timeline' ? designSystem.colors.primary[600] : designSystem.colors.text.secondary,
                            fontWeight: viewMode === 'timeline' ? '600' : '500',
                            fontSize: '14px',
                            boxShadow: viewMode === 'timeline' ? designSystem.shadows.sm : 'none',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                        }}
                    >
                        <span>📅</span> 時間軸
                    </button>
                </div>

                {/* 排班按鈕 */}
                <Link
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

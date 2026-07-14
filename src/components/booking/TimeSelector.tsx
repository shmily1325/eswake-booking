import { getWeekdayText } from '../../utils/date'
import { designSystem, getBookingChoiceStyle, getLabelStyle } from '../../styles/designSystem'
import type { CSSProperties } from 'react'

interface TimeSelectorProps {
    startDate?: string
    setStartDate?: (date: string) => void
    startTime: string
    setStartTime: (time: string) => void
    durationMin: number
    setDurationMin: (min: number) => void
    /** false = 只顯示開始時間＋時長（重複預約：日期改由 DateMultiPicker） */
    showDate?: boolean
}

export function TimeSelector({
    startDate = '',
    setStartDate,
    startTime,
    setStartTime,
    durationMin,
    setDurationMin,
    showDate = true,
}: TimeSelectorProps) {
    const fieldStyle: CSSProperties = {
        padding: '12px',
        borderRadius: designSystem.borderRadius.lg,
        border: `1px solid ${designSystem.colors.border.main}`,
        boxSizing: 'border-box',
        fontSize: '16px',
        touchAction: 'manipulation',
        backgroundColor: '#ffffff',
    }

    return (
        <>
            {showDate && setStartDate && (
            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={getLabelStyle(true)}>
                    開始日期
                </label>
                <div style={{ display: 'flex' }}>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        style={{
                            ...fieldStyle,
                            flex: 1,
                            minWidth: 0,
                        }}
                    />
                </div>
                {startDate && (
                    <div style={{
                        marginTop: designSystem.spacing.sm,
                        padding: '8px 12px',
                        background: designSystem.colors.background.main,
                        border: `1px solid ${designSystem.colors.border.light}`,
                        borderRadius: designSystem.borderRadius.md,
                        fontSize: '15px',
                        fontWeight: '600',
                        color: designSystem.colors.text.secondary,
                        textAlign: 'center',
                    }}>
                        {getWeekdayText(startDate)}
                    </div>
                )}
            </div>
            )}

            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={getLabelStyle(true)}>
                    開始時間
                </label>
                <div style={{ display: 'flex', gap: designSystem.spacing.sm }}>
                    <select
                        value={startTime.split(':')[0]}
                        onChange={(e) => {
                            const hour = e.target.value
                            const minute = startTime.split(':')[1] || '00'
                            setStartTime(`${hour}:${minute}`)
                        }}
                        required
                        style={{
                            ...fieldStyle,
                            flex: 1,
                            cursor: 'pointer',
                        }}
                    >
                        {Array.from({ length: 24 }, (_, i) => {
                            const hour = String(i).padStart(2, '0')
                            return <option key={hour} value={hour}>{hour}</option>
                        })}
                    </select>
                    <select
                        value={startTime.split(':')[1] || '00'}
                        onChange={(e) => {
                            const hour = startTime.split(':')[0]
                            const minute = e.target.value
                            setStartTime(`${hour}:${minute}`)
                        }}
                        required
                        style={{
                            ...fieldStyle,
                            flex: 1,
                            cursor: 'pointer',
                        }}
                    >
                        <option value="00">00</option>
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                    </select>
                </div>
            </div>

            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={{ ...getLabelStyle(true), fontWeight: '600' }}>
                    時長（分鐘）
                </label>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: designSystem.spacing.sm,
                    marginBottom: designSystem.spacing.md,
                }}>
                    {[30, 40, 60, 90, 120, 150, 180, 210].map(minutes => {
                        const isSelected = durationMin === minutes
                        return (
                            <button
                                key={minutes}
                                type="button"
                                onClick={() => setDurationMin(minutes)}
                                style={{
                                    ...getBookingChoiceStyle(isSelected),
                                    padding: '12px 8px',
                                    fontSize: '14px',
                                    fontWeight: isSelected ? '700' : '500',
                                    cursor: 'pointer',
                                    minHeight: '44px',
                                    touchAction: 'manipulation',
                                }}
                            >
                                {minutes}
                            </button>
                        )
                    })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: designSystem.spacing.sm }}>
                    <span style={{
                        fontSize: '14px',
                        color: designSystem.colors.text.secondary,
                        flexShrink: 0,
                    }}>
                        自訂：
                    </span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={durationMin}
                        onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '')
                            const numValue = Number(value)
                            if (numValue > 0 && numValue <= 999) {
                                setDurationMin(numValue)
                            } else if (value === '') {
                                setDurationMin(0)
                            }
                        }}
                        style={{
                            ...fieldStyle,
                            flex: 1,
                            textAlign: 'center',
                            fontWeight: '600',
                            color: designSystem.colors.text.primary,
                        }}
                        placeholder="輸入分鐘數"
                    />
                    <span style={{
                        fontSize: '14px',
                        color: designSystem.colors.text.secondary,
                        flexShrink: 0,
                    }}>
                        分
                    </span>
                </div>
            </div>
        </>
    )
}

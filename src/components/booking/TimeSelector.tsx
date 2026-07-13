import { getWeekdayText } from '../../utils/date'
import { designSystem, getInputStyle, getLabelStyle } from '../../styles/designSystem'

interface TimeSelectorProps {
    startDate: string
    setStartDate: (date: string) => void
    startTime: string
    setStartTime: (time: string) => void
    durationMin: number
    setDurationMin: (min: number) => void
}

export function TimeSelector({
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    durationMin,
    setDurationMin,
}: TimeSelectorProps) {
    return (
        <>
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
                            ...getInputStyle(true),
                            flex: 1,
                            minWidth: 0,
                            boxSizing: 'border-box',
                            touchAction: 'manipulation',
                        }}
                    />
                </div>
                {/* 星期幾顯示 - 更醒目 */}
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
                            ...getInputStyle(true),
                            flex: 1,
                            boxSizing: 'border-box',
                            touchAction: 'manipulation',
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
                            ...getInputStyle(true),
                            flex: 1,
                            boxSizing: 'border-box',
                            touchAction: 'manipulation',
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

                {/* 常用時長按鈕 */}
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
                                    padding: '12px 8px',
                                    border: isSelected
                                        ? `1.5px solid ${designSystem.colors.primary[500]}`
                                        : `1px solid ${designSystem.colors.border.light}`,
                                    borderRadius: designSystem.borderRadius.lg,
                                    background: isSelected
                                        ? designSystem.colors.primary[50]
                                        : '#ffffff',
                                    color: designSystem.colors.text.primary,
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

                {/* 自訂時長輸入 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: designSystem.spacing.sm }}>
                    <span style={{
                        fontSize: designSystem.fontSize.body.mobile,
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
                            const value = e.target.value.replace(/\D/g, '') // 只允許數字
                            const numValue = Number(value)
                            if (numValue > 0 && numValue <= 999) {
                                setDurationMin(numValue)
                            } else if (value === '') {
                                setDurationMin(0)
                            }
                        }}
                        style={{
                            ...getInputStyle(true),
                            flex: 1,
                            textAlign: 'center',
                            fontWeight: '600',
                            boxSizing: 'border-box',
                        }}
                        placeholder="輸入分鐘數"
                    />
                    <span style={{
                        fontSize: designSystem.fontSize.body.mobile,
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

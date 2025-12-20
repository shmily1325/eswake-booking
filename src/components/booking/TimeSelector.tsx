import { getWeekdayText } from '../../utils/date'

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
            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#000',
                    fontSize: '15px',
                    fontWeight: '500',
                }}>
                    開始日期
                </label>
                <div style={{ display: 'flex' }}>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #ccc',
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            touchAction: 'manipulation',
                        }}
                    />
                </div>
                {/* 星期幾顯示 - 更醒目 */}
                {startDate && (
                    <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#495057',
                        textAlign: 'center',
                    }}>
                        {getWeekdayText(startDate)}
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#000',
                    fontSize: '15px',
                    fontWeight: '500',
                }}>
                    開始時間
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                        value={startTime.split(':')[0]}
                        onChange={(e) => {
                            const hour = e.target.value
                            const minute = startTime.split(':')[1] || '00'
                            setStartTime(`${hour}:${minute}`)
                        }}
                        required
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #ccc',
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            touchAction: 'manipulation',
                            backgroundColor: 'white',
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
                            flex: 1,
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #ccc',
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            touchAction: 'manipulation',
                            backgroundColor: 'white',
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

            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    color: '#000',
                    fontSize: '15px',
                    fontWeight: '600',
                }}>
                    時長（分鐘）
                </label>

                {/* 常用時長按鈕 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    marginBottom: '12px',
                }}>
                    {[30, 60, 90, 120, 150, 180, 210, 240].map(minutes => {
                        const isSelected = durationMin === minutes
                        return (
                            <button
                                key={minutes}
                                type="button"
                                onClick={() => setDurationMin(minutes)}
                                style={{
                                    padding: '12px 8px',
                                    border: isSelected ? '3px solid #1976d2' : '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    background: isSelected ? '#e3f2fd' : 'white',
                                    color: isSelected ? '#1976d2' : '#333',
                                    fontSize: '14px',
                                    fontWeight: isSelected ? '700' : '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: isSelected ? '0 2px 8px rgba(25,118,210,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                                }}
                                onTouchStart={(e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.transform = 'scale(0.95)'
                                    }
                                }}
                                onTouchEnd={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)'
                                }}
                            >
                                {minutes}
                            </button>
                        )
                    })}
                </div>

                {/* 自訂時長輸入 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', color: '#666', flexShrink: 0 }}>自訂：</span>
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
                            flex: 1,
                            padding: '10px 12px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '16px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#333',
                            boxSizing: 'border-box',
                        }}
                        placeholder="輸入分鐘數"
                    />
                    <span style={{ fontSize: '14px', color: '#666', flexShrink: 0 }}>分</span>
                </div>
            </div>
        </>
    )
}

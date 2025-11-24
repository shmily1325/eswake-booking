interface BookingDetailsProps {
    activityTypesSet: Set<string>
    toggleActivityType: (type: string) => void
    notes: string
    setNotes: (notes: string) => void
    filledBy: string
    setFilledBy: (filledBy: string) => void
}

export function BookingDetails({
    activityTypesSet,
    toggleActivityType,
    notes,
    setNotes,
    filledBy,
    setFilledBy,
}: BookingDetailsProps) {
    return (
        <>
            {/* 填表人 */}
            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#000',
                    fontSize: '15px',
                    fontWeight: '500',
                }}>
                    填表人 <span style={{ color: '#f44336' }}>*</span>
                </label>
                <input
                    type="text"
                    value={filledBy}
                    onChange={(e) => setFilledBy(e.target.value)}
                    placeholder="請輸入您的姓名"
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #ccc',
                        boxSizing: 'border-box',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        touchAction: 'manipulation',
                    }}
                />
            </div>

            {/* 活動類型選擇 */}
            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    color: '#000',
                    fontSize: '15px',
                    fontWeight: '600',
                }}>
                    活動類型（可複選）
                </label>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                }}>
                    <button
                        type="button"
                        onClick={() => toggleActivityType('WB')}
                        style={{
                            padding: '14px 10px',
                            border: activityTypesSet.has('WB') ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                            borderRadius: '8px',
                            background: activityTypesSet.has('WB') ? '#dbeafe' : 'white',
                            color: '#333',
                            fontSize: '15px',
                            fontWeight: activityTypesSet.has('WB') ? '600' : '500',
                            cursor: 'pointer',
                        }}
                        onTouchStart={(e) => {
                            e.currentTarget.style.background = activityTypesSet.has('WB') ? '#dbeafe' : '#fafafa'
                        }}
                        onTouchEnd={(e) => {
                            e.currentTarget.style.background = activityTypesSet.has('WB') ? '#dbeafe' : 'white'
                        }}
                    >
                        WB
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleActivityType('WS')}
                        style={{
                            padding: '14px 10px',
                            border: activityTypesSet.has('WS') ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                            borderRadius: '8px',
                            background: activityTypesSet.has('WS') ? '#dbeafe' : 'white',
                            color: '#333',
                            fontSize: '15px',
                            fontWeight: activityTypesSet.has('WS') ? '600' : '500',
                            cursor: 'pointer',
                        }}
                        onTouchStart={(e) => {
                            e.currentTarget.style.background = activityTypesSet.has('WS') ? '#dbeafe' : '#fafafa'
                        }}
                        onTouchEnd={(e) => {
                            e.currentTarget.style.background = activityTypesSet.has('WS') ? '#dbeafe' : 'white'
                        }}
                    >
                        WS
                    </button>
                </div>
            </div>

            {/* 註解 */}
            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#000',
                    fontSize: '15px',
                    fontWeight: '500',
                }}>
                    註解（選填）
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="例如：初學者、特殊需求..."
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #ccc',
                        boxSizing: 'border-box',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        touchAction: 'manipulation',
                    }}
                />
            </div>
        </>
    )
}

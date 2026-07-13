import { designSystem, getInputStyle, getLabelStyle } from '../../styles/designSystem'

interface BookingDetailsProps {
    activityTypesSet: Set<string>
    toggleActivityType: (type: string) => void
    notes: string
    setNotes: (notes: string) => void
    filledBy: string
    setFilledBy: (filledBy: string) => void
    isCoachPractice: boolean
    setIsCoachPractice: (value: boolean) => void
}

export function BookingDetails({
    activityTypesSet,
    toggleActivityType,
    notes,
    setNotes,
    filledBy,
    setFilledBy,
    isCoachPractice,
    setIsCoachPractice,
}: BookingDetailsProps) {
    return (
        <>
            {/* 教練練習 */}
            <div style={{
                marginBottom: designSystem.spacing.lg,
                padding: `${designSystem.spacing.md} 0`,
                borderBottom: `1px solid ${designSystem.colors.border.light}`,
            }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: designSystem.spacing.md,
                    cursor: 'pointer',
                    userSelect: 'none',
                }}>
                    <input
                        type="checkbox"
                        checked={isCoachPractice}
                        onChange={(e) => setIsCoachPractice(e.target.checked)}
                        style={{
                            width: '20px',
                            height: '20px',
                            marginTop: '2px',
                            flexShrink: 0,
                            cursor: 'pointer',
                            accentColor: designSystem.colors.primary[500],
                        }}
                    />
                    <div>
                        <span style={{
                            display: 'block',
                            color: designSystem.colors.text.primary,
                            fontSize: designSystem.fontSize.bodyLarge.mobile,
                            fontWeight: '600',
                        }}>
                            教練練習
                        </span>
                        <div style={{
                            fontSize: designSystem.fontSize.bodySmall.mobile,
                            color: designSystem.colors.text.secondary,
                            marginTop: '4px',
                            lineHeight: 1.5,
                        }}>
                            教練練習會顯示在時間表上，需要排班，但不需要回報
                        </div>
                    </div>
                </label>
            </div>

            {/* 填表人 */}
            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={getLabelStyle(true)}>
                    填表人 <span style={{ color: designSystem.colors.danger[500] }}>*</span>
                </label>
                <input
                    type="text"
                    value={filledBy}
                    onChange={(e) => setFilledBy(e.target.value)}
                    placeholder="請輸入您的姓名"
                    style={{
                        ...getInputStyle(true),
                        fontFamily: 'inherit',
                        touchAction: 'manipulation',
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* 活動類型選擇 */}
            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={{ ...getLabelStyle(true), fontWeight: '600' }}>
                    活動類型（可複選）
                </label>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: designSystem.spacing.sm,
                }}>
                    {(['WB', 'WS'] as const).map((type) => {
                        const selected = activityTypesSet.has(type)
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => toggleActivityType(type)}
                                style={{
                                    padding: '14px 10px',
                                    border: selected
                                        ? `1.5px solid ${designSystem.colors.primary[500]}`
                                        : `1px solid ${designSystem.colors.border.light}`,
                                    borderRadius: designSystem.borderRadius.lg,
                                    background: selected
                                        ? designSystem.colors.primary[50]
                                        : '#ffffff',
                                    color: designSystem.colors.text.primary,
                                    fontSize: '15px',
                                    fontWeight: selected ? '600' : '500',
                                    cursor: 'pointer',
                                    minHeight: '48px',
                                    touchAction: 'manipulation',
                                }}
                            >
                                {type}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 註解 */}
            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={getLabelStyle(true)}>
                    註解（選填）
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="例如：初學者、特殊需求..."
                    style={{
                        ...getInputStyle(true),
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        touchAction: 'manipulation',
                        boxSizing: 'border-box',
                    }}
                />
            </div>
        </>
    )
}

import React from 'react'
import type { Coach } from '../../types/booking'
import {
    designSystem,
    getBookingChoiceStyle,
    getBookingFlagBoxStyle,
    getFontSize,
    getLabelStyle,
} from '../../styles/designSystem'

interface CoachSelectorProps {
    coaches: (Pick<Coach, 'id' | 'name'> & { isOnTimeOff?: boolean })[]
    selectedCoaches: string[]
    selectedCoachesSet: Set<string>
    setSelectedCoaches: React.Dispatch<React.SetStateAction<string[]>>
    toggleCoach: (coachId: string) => void
    loadingCoaches: boolean
    requiresDriver: boolean
    setRequiresDriver: (requires: boolean) => void
    canRequireDriver: boolean
    isSelectedBoatFacility: boolean
}

export function CoachSelector({
    coaches,
    selectedCoaches,
    selectedCoachesSet,
    setSelectedCoaches,
    toggleCoach,
    loadingCoaches,
    requiresDriver,
    setRequiresDriver,
    canRequireDriver,
    isSelectedBoatFacility,
}: CoachSelectorProps) {
    const safeCoaches = coaches || []
    const safeSelectedCoaches = selectedCoaches || []
    
    return (
        <>
            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={{ ...getLabelStyle(true), fontWeight: '600' }}>
                    教練（可複選）
                </label>

                {/* 已選教練顯示 */}
                {safeSelectedCoaches.length > 0 && (
                    <div style={{
                        marginBottom: designSystem.spacing.md,
                        ...getBookingFlagBoxStyle(true, 'info'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: designSystem.spacing.sm,
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: designSystem.spacing.sm,
                            flex: 1,
                            minWidth: 0,
                        }}>
                            <span style={{
                                color: designSystem.colors.info[700],
                                fontSize: getFontSize('body', true),
                                fontWeight: '600',
                                flexShrink: 0,
                            }}>
                                已選：
                            </span>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: designSystem.spacing.sm,
                                flex: 1,
                            }}>
                                {safeSelectedCoaches.map(coachId => {
                                    const coach = safeCoaches.find(c => c.id === coachId)
                                    return coach ? (
                                        <span
                                            key={coachId}
                                            style={{
                                                padding: '6px 12px',
                                                background: '#ffffff',
                                                borderRadius: designSystem.borderRadius.md,
                                                border: `1px solid ${designSystem.colors.info[500]}`,
                                                color: designSystem.colors.info[700],
                                                fontSize: getFontSize('body', true),
                                                fontWeight: '600',
                                            }}
                                        >
                                            {coach.name}
                                        </span>
                                    ) : null
                                })}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedCoaches([])}
                            style={{
                                padding: '6px 12px',
                                background: '#ffffff',
                                border: `1px solid ${designSystem.colors.info[500]}`,
                                borderRadius: designSystem.borderRadius.md,
                                color: designSystem.colors.info[700],
                                fontSize: getFontSize('button', true),
                                cursor: 'pointer',
                                fontWeight: '600',
                                flexShrink: 0,
                                minHeight: '36px',
                                touchAction: 'manipulation',
                            }}
                        >
                            清除
                        </button>
                    </div>
                )}

                {loadingCoaches ? (
                    <div style={{
                        padding: designSystem.spacing.md,
                        color: designSystem.colors.text.secondary,
                        fontSize: getFontSize('body', true),
                    }}>
                        載入教練列表中...
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: designSystem.spacing.sm,
                    }}>
                        <button
                            type="button"
                            onClick={() => setSelectedCoaches([])}
                            style={{
                                ...getBookingChoiceStyle(safeSelectedCoaches.length === 0),
                                padding: '14px 10px',
                                fontSize: getFontSize('body', true),
                                fontWeight: safeSelectedCoaches.length === 0 ? '600' : '500',
                                cursor: 'pointer',
                                minHeight: '48px',
                                touchAction: 'manipulation',
                                gridColumn: '1 / -1',
                            }}
                        >
                            不指定教練
                        </button>

                        {safeCoaches.map((coach) => {
                            const isSelected = selectedCoachesSet.has(coach.id)
                            return (
                                <button
                                    key={coach.id}
                                    type="button"
                                    onClick={() => toggleCoach(coach.id)}
                                    style={{
                                        ...getBookingChoiceStyle(isSelected),
                                        padding: '14px 10px',
                                        fontSize: getFontSize('body', true),
                                        fontWeight: isSelected ? '600' : '500',
                                        cursor: 'pointer',
                                        minHeight: '48px',
                                        touchAction: 'manipulation',
                                    }}
                                >
                                    {coach.name}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 需要駕駛 — 保留有框，與教練練習同一框結構，info 色階 */}
            <div style={{ marginBottom: designSystem.spacing.lg }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: designSystem.spacing.md,
                    cursor: canRequireDriver ? 'pointer' : 'not-allowed',
                    ...getBookingFlagBoxStyle(requiresDriver, 'info'),
                    opacity: canRequireDriver ? 1 : 0.6,
                    userSelect: 'none',
                }}>
                    <input
                        type="checkbox"
                        checked={requiresDriver}
                        onChange={(e) => setRequiresDriver(e.target.checked)}
                        disabled={!canRequireDriver}
                        style={{
                            width: '20px',
                            height: '20px',
                            marginTop: '2px',
                            flexShrink: 0,
                            cursor: canRequireDriver ? 'pointer' : 'not-allowed',
                            accentColor: designSystem.colors.info[500],
                        }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                            display: 'block',
                            fontSize: getFontSize('body', true),
                            fontWeight: '600',
                            color: requiresDriver
                                ? designSystem.colors.info[700]
                                : (canRequireDriver
                                    ? designSystem.colors.text.primary
                                    : designSystem.colors.text.disabled),
                        }}>
                            需要駕駛
                        </span>
                        <div style={{
                            fontSize: getFontSize('button', true),
                            color: designSystem.colors.text.secondary,
                            marginTop: '4px',
                            lineHeight: 1.5,
                        }}>
                            勾選後在排班時必須指定駕駛
                        </div>
                        {!canRequireDriver && (
                            <div style={{
                                fontSize: getFontSize('bodySmall', true),
                                color: designSystem.colors.warning[700],
                                marginTop: '6px',
                            }}>
                                {isSelectedBoatFacility ? '設施不需要駕駛' : '未指定教練不能選駕駛'}
                            </div>
                        )}
                    </div>
                </label>
            </div>
        </>
    )
}

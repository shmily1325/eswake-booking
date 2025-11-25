import React from 'react'
import type { Coach } from '../../types/booking'

interface CoachSelectorProps {
    coaches: Pick<Coach, 'id' | 'name'>[]
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
    console.log('[CoachSelector] Rendering, coaches:', coaches?.length)
    const safeCoaches = coaches || []
    const safeSelectedCoaches = selectedCoaches || []
    
    return (
        <>
            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    color: '#000',
                    fontSize: '15px',
                    fontWeight: '600',
                }}>
                    教練（可複選）
                </label>

                {/* 已選教練顯示 */}
                {safeSelectedCoaches.length > 0 && (
                    <div style={{
                        marginBottom: '12px',
                        padding: '12px 14px',
                        background: '#dbeafe',
                        borderRadius: '8px',
                        border: '2px solid #3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flex: 1,
                            minWidth: 0,
                        }}>
                            <span style={{ color: '#1e40af', fontSize: '15px', fontWeight: '600', flexShrink: 0 }}>
                                已選：
                            </span>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                flex: 1,
                            }}>
                                {safeSelectedCoaches.map(coachId => {
                                    const coach = safeCoaches.find(c => c.id === coachId)
                                    return coach ? (
                                        <span
                                            key={coachId}
                                            style={{
                                                padding: '6px 12px',
                                                background: 'white',
                                                borderRadius: '6px',
                                                border: '1px solid #3b82f6',
                                                color: '#1e40af',
                                                fontSize: '15px',
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
                                background: 'white',
                                border: '1px solid #3b82f6',
                                borderRadius: '6px',
                                color: '#1e40af',
                                fontSize: '13px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                flexShrink: 0,
                            }}
                        >
                            清除
                        </button>
                    </div>
                )}

                {loadingCoaches ? (
                    <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                        載入教練列表中...
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                    }}>
                        {/* 不指定教練 */}
                        <button
                            type="button"
                            onClick={() => setSelectedCoaches([])}
                            style={{
                                padding: '14px 10px',
                                border: safeSelectedCoaches.length === 0 ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                                borderRadius: '8px',
                                background: safeSelectedCoaches.length === 0 ? '#dbeafe' : 'white',
                                color: '#333',
                                fontSize: '15px',
                                fontWeight: safeSelectedCoaches.length === 0 ? '600' : '500',
                                cursor: 'pointer',
                                gridColumn: '1 / -1',
                            }}
                            onTouchStart={(e) => {
                                e.currentTarget.style.background = safeSelectedCoaches.length === 0 ? '#dbeafe' : '#fafafa'
                            }}
                            onTouchEnd={(e) => {
                                e.currentTarget.style.background = safeSelectedCoaches.length === 0 ? '#dbeafe' : 'white'
                            }}
                        >
                            不指定教練
                        </button>

                        {/* 教練列表 */}
                        {safeCoaches.map((coach) => {
                            const isSelected = selectedCoachesSet.has(coach.id)
                            return (
                                <button
                                    key={coach.id}
                                    type="button"
                                    onClick={() => toggleCoach(coach.id)}
                                    style={{
                                        padding: '14px 10px',
                                        border: isSelected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                                        borderRadius: '8px',
                                        background: isSelected ? '#dbeafe' : 'white',
                                        color: '#333',
                                        fontSize: '15px',
                                        fontWeight: isSelected ? '600' : '500',
                                        cursor: 'pointer',
                                    }}
                                    onTouchStart={(e) => {
                                        e.currentTarget.style.background = isSelected ? '#dbeafe' : '#fafafa'
                                    }}
                                    onTouchEnd={(e) => {
                                        e.currentTarget.style.background = isSelected ? '#dbeafe' : 'white'
                                    }}
                                >
                                    {coach.name}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 需要駕駛勾選框 */}
            <div style={{ marginBottom: '18px' }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: canRequireDriver ? 'pointer' : 'not-allowed',
                    padding: '12px',
                    backgroundColor: requiresDriver ? '#dbeafe' : (canRequireDriver ? '#f8f9fa' : '#f5f5f5'),
                    borderRadius: '8px',
                    border: requiresDriver ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                    transition: 'all 0.2s',
                    opacity: canRequireDriver ? 1 : 0.6,
                }}>
                    <input
                        type="checkbox"
                        checked={requiresDriver}
                        onChange={(e) => setRequiresDriver(e.target.checked)}
                        disabled={!canRequireDriver}
                        style={{
                            marginRight: '10px',
                            width: '18px',
                            height: '18px',
                            cursor: canRequireDriver ? 'pointer' : 'not-allowed',
                        }}
                    />
                    <div style={{ flex: 1 }}>
                        <span style={{
                            fontSize: '15px',
                            fontWeight: '500',
                            color: requiresDriver ? '#3b82f6' : (canRequireDriver ? '#333' : '#999'),
                        }}>
                            需要駕駛（勾選後在排班時必須指定駕駛）
                        </span>
                        {!canRequireDriver && (
                            <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
                                {isSelectedBoatFacility ? '⚠️ 彈簧床不需要駕駛' : '⚠️ 未指定教練不能選駕駛'}
                            </div>
                        )}
                    </div>
                </label>
            </div>
        </>
    )
}

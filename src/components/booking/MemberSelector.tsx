import React from 'react'
import type { Member } from '../../types/booking'
import { designSystem, getButtonStyle, getInputStyle, getLabelStyle } from '../../styles/designSystem'

interface MemberSelectorProps {
    members: Pick<Member, 'id' | 'name' | 'nickname' | 'phone'>[]
    selectedMemberIds: string[]
    setSelectedMemberIds: React.Dispatch<React.SetStateAction<string[]>>
    memberSearchTerm: string
    setMemberSearchTerm: (term: string) => void
    showMemberDropdown: boolean
    setShowMemberDropdown: (show: boolean) => void
    filteredMembers: Pick<Member, 'id' | 'name' | 'nickname' | 'phone'>[]
    handleMemberSearch: (term: string) => void
    manualStudentName: string
    setManualStudentName: (name: string) => void
    manualNames: string[]
    setManualNames: React.Dispatch<React.SetStateAction<string[]>>
}

export function MemberSelector({
    members,
    selectedMemberIds,
    setSelectedMemberIds,
    memberSearchTerm,
    setMemberSearchTerm,
    showMemberDropdown,
    setShowMemberDropdown,
    filteredMembers,
    handleMemberSearch,
    manualStudentName,
    setManualStudentName,
    manualNames,
    setManualNames,
}: MemberSelectorProps) {
    return (
        <div style={{ marginBottom: designSystem.spacing.lg, position: 'relative' }}>
            <label style={getLabelStyle(true)}>
                預約人 {selectedMemberIds.length > 0 && (
                    <span style={{ color: designSystem.colors.text.secondary, fontSize: '13px' }}>
                        （已選 {selectedMemberIds.length} 位）
                    </span>
                )}
            </label>

            {/* 已選會員和手動輸入標籤 */}
            {(selectedMemberIds.length > 0 || manualNames.length > 0) && (
                <div style={{ marginBottom: designSystem.spacing.sm, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {/* 會員標籤 */}
                    {selectedMemberIds.map(memberId => {
                        const member = members.find(m => m.id === memberId)
                        return member ? (
                            <span key={memberId} style={{
                                padding: '6px 12px',
                                background: designSystem.colors.primary[50],
                                color: designSystem.colors.text.primary,
                                border: `1px solid ${designSystem.colors.border.main}`,
                                borderRadius: designSystem.borderRadius.md,
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: '600',
                            }}>
                                {member.nickname || member.name}
                                <button
                                    type="button"
                                    onClick={() => setSelectedMemberIds(prev => prev.filter(id => id !== memberId))}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: designSystem.colors.text.secondary,
                                        cursor: 'pointer',
                                        padding: '0',
                                        fontSize: '18px',
                                        lineHeight: '1',
                                        touchAction: 'manipulation',
                                    }}
                                >×</button>
                            </span>
                        ) : null
                    })}

                    {/* 非會員標籤 */}
                    {manualNames.map((name, index) => (
                        <span key={index} style={{
                            padding: '6px 12px',
                            background: '#ffffff',
                            color: designSystem.colors.text.secondary,
                            border: `1.5px dashed ${designSystem.colors.border.main}`,
                            borderRadius: designSystem.borderRadius.md,
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '500',
                        }}>
                            {name}
                            <button
                                type="button"
                                onClick={() => setManualNames(prev => prev.filter((_, i) => i !== index))}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: designSystem.colors.text.disabled,
                                    cursor: 'pointer',
                                    padding: '0',
                                    fontSize: '18px',
                                    lineHeight: '1',
                                    touchAction: 'manipulation',
                                }}
                            >×</button>
                        </span>
                    ))}
                </div>
            )}

            {/* 搜尋會員 */}
            <input
                type="text"
                value={memberSearchTerm}
                onChange={(e) => {
                    const value = e.target.value
                    setMemberSearchTerm(value)
                    handleMemberSearch(value)
                }}
                onFocus={() => {
                    if (memberSearchTerm.trim()) {
                        setShowMemberDropdown(true)
                    }
                }}
                placeholder="搜尋會員暱稱/姓名/電話...（可多選）"
                style={{
                    ...getInputStyle(true),
                    border: selectedMemberIds.length > 0
                        ? `1.5px solid ${designSystem.colors.primary[500]}`
                        : `1px solid ${designSystem.colors.border.main}`,
                    boxSizing: 'border-box',
                    touchAction: 'manipulation',
                }}
            />

            {/* 會員下拉選單 */}
            {showMemberDropdown && filteredMembers.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: '#ffffff',
                    border: `1px solid ${designSystem.colors.border.main}`,
                    borderRadius: designSystem.borderRadius.lg,
                    marginTop: '4px',
                    boxShadow: designSystem.shadows.md,
                    zIndex: designSystem.zIndex.dropdown,
                }}>
                    {filteredMembers.map((member) => {
                        const isSelected = selectedMemberIds.includes(member.id)
                        return (
                            <div
                                key={member.id}
                                onClick={() => {
                                    if (isSelected) {
                                        setSelectedMemberIds(prev => prev.filter(id => id !== member.id))
                                    } else {
                                        setSelectedMemberIds(prev => [...prev, member.id])
                                    }
                                    setMemberSearchTerm('')
                                    setShowMemberDropdown(false)
                                }}
                                style={{
                                    padding: designSystem.spacing.md,
                                    cursor: 'pointer',
                                    borderBottom: `1px solid ${designSystem.colors.border.light}`,
                                    background: isSelected ? designSystem.colors.primary[50] : '#ffffff',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = isSelected
                                        ? designSystem.colors.primary[100]
                                        : designSystem.colors.background.hover
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = isSelected
                                        ? designSystem.colors.primary[50]
                                        : '#ffffff'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', color: designSystem.colors.text.primary }}>
                                    {isSelected && '✓ '}{member.nickname || member.name}
                                    {member.nickname && (
                                        <span style={{
                                            color: designSystem.colors.text.secondary,
                                            fontWeight: 'normal',
                                            marginLeft: '6px',
                                        }}>
                                            ({member.name})
                                        </span>
                                    )}
                                </div>
                                {member.phone && (
                                    <div style={{
                                        fontSize: designSystem.fontSize.bodySmall.mobile,
                                        color: designSystem.colors.text.disabled,
                                    }}>
                                        {member.phone}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* 或手動輸入（非會員） */}
            <div style={{ marginTop: designSystem.spacing.sm, display: 'flex', gap: designSystem.spacing.sm, alignItems: 'stretch' }}>
                <input
                    type="text"
                    value={manualStudentName}
                    onChange={(e) => setManualStudentName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing && manualStudentName.trim()) {
                            e.preventDefault()
                            setManualNames(prev => [...prev, manualStudentName.trim()])
                            setManualStudentName('')
                        }
                    }}
                    placeholder="或直接輸入姓名（非會員/首次體驗）"
                    style={{
                        ...getInputStyle(true),
                        flex: 1,
                        boxSizing: 'border-box',
                        touchAction: 'manipulation',
                    }}
                />
                <button
                    type="button"
                    onClick={() => {
                        if (manualStudentName.trim()) {
                            setManualNames(prev => [...prev, manualStudentName.trim()])
                            setManualStudentName('')
                        }
                    }}
                    disabled={!manualStudentName.trim()}
                    style={{
                        ...getButtonStyle('primary', 'large', true),
                        padding: '0 20px',
                        minWidth: '52px',
                        minHeight: '48px',
                        fontSize: '20px',
                        ...(manualStudentName.trim()
                            ? {}
                            : { background: designSystem.colors.text.disabled, boxShadow: 'none', cursor: 'not-allowed' }),
                        touchAction: 'manipulation',
                    }}
                >
                    +
                </button>
            </div>

            {/* 清除所有會員選擇 */}
            {selectedMemberIds.length > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        setSelectedMemberIds([])
                        setMemberSearchTerm('')
                    }}
                    style={{
                        ...getButtonStyle('outline', 'small', true),
                        marginTop: designSystem.spacing.sm,
                        color: designSystem.colors.danger[700],
                        borderColor: `${designSystem.colors.danger[500]}66`,
                        minHeight: '36px',
                        touchAction: 'manipulation',
                    }}
                >
                    清除所有會員
                </button>
            )}
        </div>
    )
}

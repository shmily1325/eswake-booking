import React from 'react'
import type { Member } from '../../types/booking'
import { designSystem, getLabelStyle } from '../../styles/designSystem'

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
                    <span style={{ color: designSystem.colors.success[700], fontSize: '13px' }}>
                        （已選 {selectedMemberIds.length} 位）
                    </span>
                )}
            </label>

            {(selectedMemberIds.length > 0 || manualNames.length > 0) && (
                <div style={{ marginBottom: designSystem.spacing.sm, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedMemberIds.map(memberId => {
                        const member = members.find(m => m.id === memberId)
                        return member ? (
                            <span key={memberId} style={{
                                padding: '6px 12px',
                                background: designSystem.colors.info[50],
                                color: designSystem.colors.info[700],
                                border: `1px solid ${designSystem.colors.info[500]}`,
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
                                        color: designSystem.colors.info[700],
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

                    {manualNames.map((name, index) => (
                        <span key={index} style={{
                            padding: '6px 12px',
                            background: designSystem.colors.warning[50],
                            color: designSystem.colors.warning[700],
                            border: `1.5px dashed ${designSystem.colors.warning[500]}`,
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
                                    color: designSystem.colors.warning[700],
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
                    width: '100%',
                    padding: '12px',
                    borderRadius: designSystem.borderRadius.lg,
                    border: selectedMemberIds.length > 0
                        ? `1.5px solid ${designSystem.colors.success[500]}`
                        : `1px solid ${designSystem.colors.border.main}`,
                    boxSizing: 'border-box',
                    fontSize: '16px',
                    touchAction: 'manipulation',
                }}
            />

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
                                    background: isSelected ? designSystem.colors.success[50] : '#ffffff',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = isSelected
                                        ? designSystem.colors.success[50]
                                        : designSystem.colors.background.hover
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = isSelected
                                        ? designSystem.colors.success[50]
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
                                        fontSize: '13px',
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

            <div style={{
                marginTop: designSystem.spacing.sm,
                display: 'flex',
                gap: designSystem.spacing.sm,
                alignItems: 'stretch',
            }}>
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
                        flex: 1,
                        padding: '12px',
                        borderRadius: designSystem.borderRadius.lg,
                        border: `1px solid ${designSystem.colors.warning[500]}`,
                        boxSizing: 'border-box',
                        fontSize: '16px',
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
                        padding: '0 20px',
                        background: manualStudentName.trim()
                            ? designSystem.colors.warning[500]
                            : designSystem.colors.text.disabled,
                        color: 'white',
                        border: 'none',
                        borderRadius: designSystem.borderRadius.lg,
                        fontSize: '20px',
                        fontWeight: 'bold',
                        cursor: manualStudentName.trim() ? 'pointer' : 'not-allowed',
                        minWidth: '52px',
                        minHeight: '48px',
                        touchAction: 'manipulation',
                    }}
                >
                    +
                </button>
            </div>

            {selectedMemberIds.length > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        setSelectedMemberIds([])
                        setMemberSearchTerm('')
                    }}
                    style={{
                        marginTop: designSystem.spacing.sm,
                        padding: '6px 12px',
                        background: 'transparent',
                        color: designSystem.colors.danger[700],
                        border: `1px solid ${designSystem.colors.danger[500]}66`,
                        borderRadius: designSystem.borderRadius.md,
                        fontSize: '13px',
                        cursor: 'pointer',
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

import React from 'react'
import type { Member } from '../../types/booking'

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
    console.log('[MemberSelector] Rendering, members:', members?.length)
    return (
        <div style={{ marginBottom: '18px', position: 'relative' }}>
            <label style={{
                display: 'block',
                marginBottom: '6px',
                color: '#000',
                fontSize: '15px',
                fontWeight: '500',
            }}>
                預約人 {selectedMemberIds.length > 0 && <span style={{ color: '#4caf50', fontSize: '13px' }}>（已選 {selectedMemberIds.length} 位）</span>}
            </label>

            {/* 已選會員和手動輸入標籤 */}
            {(selectedMemberIds.length > 0 || manualNames.length > 0) && (
                <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {/* 會員標籤 */}
                    {selectedMemberIds.map(memberId => {
                        const member = members.find(m => m.id === memberId)
                        return member ? (
                            <span key={memberId} style={{
                                padding: '6px 12px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                border: '1px solid #3b82f6',
                                borderRadius: '6px',
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: '600'
                            }}>
                                {member.nickname || member.name}
                                <button
                                    type="button"
                                    onClick={() => setSelectedMemberIds(prev => prev.filter(id => id !== memberId))}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#1e40af',
                                        cursor: 'pointer',
                                        padding: '0',
                                        fontSize: '18px',
                                        lineHeight: '1'
                                    }}
                                >×</button>
                            </span>
                        ) : null
                    })}

                    {/* 非會員標籤 */}
                    {manualNames.map((name, index) => (
                        <span key={index} style={{
                            padding: '6px 12px',
                            background: 'white',
                            color: '#666',
                            border: '1.5px dashed #ccc',
                            borderRadius: '6px',
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '500'
                        }}>
                            {name}
                            <button
                                type="button"
                                onClick={() => setManualNames(prev => prev.filter((_, i) => i !== index))}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#999',
                                    cursor: 'pointer',
                                    padding: '0',
                                    fontSize: '18px',
                                    lineHeight: '1'
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
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: selectedMemberIds.length > 0 ? '2px solid #4caf50' : '1px solid #ccc',
                    boxSizing: 'border-box',
                    fontSize: '16px',
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
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    marginTop: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
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
                                    padding: '12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f0f0f0',
                                    transition: 'background 0.2s',
                                    background: isSelected ? '#e8f5e9' : 'white'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? '#c8e6c9' : '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#e8f5e9' : 'white'}
                            >
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                    {isSelected && '✓ '}{member.nickname || member.name}
                                    {member.nickname && <span style={{ color: '#666', fontWeight: 'normal', marginLeft: '6px' }}>({member.name})</span>}
                                </div>
                                {member.phone && (
                                    <div style={{ fontSize: '13px', color: '#999' }}>
                                        📱 {member.phone}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* 或手動輸入（非會員） */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'stretch' }}>
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
                        borderRadius: '8px',
                        border: '1px solid #ff9800',
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
                        background: manualStudentName.trim() ? '#ff9800' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        cursor: manualStudentName.trim() ? 'pointer' : 'not-allowed',
                        minWidth: '52px',
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
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                    }}
                >
                    清除所有會員
                </button>
            )}
        </div>
    )
}

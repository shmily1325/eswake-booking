import React from 'react'
import type { Member } from '../../types/booking'
import { designSystem, getFontSize, getLabelStyle } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'
import {
    formatActualRider,
    parseActualRiders,
} from '../../utils/riderDisplay'
import type { SavedLineReminderGuest } from '../../utils/lineReminderGuests'

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
    savedGuestSearchResults?: SavedLineReminderGuest[]
    selectedSavedGuests?: SavedLineReminderGuest[]
    setSelectedSavedGuests?: React.Dispatch<React.SetStateAction<SavedLineReminderGuest[]>>
    showSavedGuestDropdown?: boolean
    setShowSavedGuestDropdown?: (show: boolean) => void
    handleSavedGuestSearch?: (term: string) => void
    actualRider: string
    setActualRider: (value: string) => void
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
    savedGuestSearchResults = [],
    selectedSavedGuests = [],
    setSelectedSavedGuests,
    showSavedGuestDropdown = false,
    setShowSavedGuestDropdown,
    handleSavedGuestSearch,
    actualRider,
    setActualRider,
}: MemberSelectorProps) {
    const { isMobile } = useResponsive()
    const actualRiderInputRef = React.useRef<HTMLInputElement>(null)
    const riderValue = actualRider || ''
    const [committedRiders, setCommittedRiders] = React.useState(() => parseActualRiders(riderValue))
    const [riderDraft, setRiderDraft] = React.useState('')
    const lastEmittedRiderRef = React.useRef(riderValue)

    React.useEffect(() => {
        if (riderValue === lastEmittedRiderRef.current) return
        setCommittedRiders(parseActualRiders(riderValue))
        setRiderDraft('')
        lastEmittedRiderRef.current = riderValue
    }, [riderValue])

    const emitRiderValue = (riders: string[], draft: string) => {
        const normalized = formatActualRider([...riders, ...parseActualRiders(draft)].join('＋'))
        lastEmittedRiderRef.current = normalized
        setActualRider(normalized)
    }

    const canAppendRider = parseActualRiders(riderDraft).length > 0
    const clearSavedGuestSearch = () => {
        if (handleSavedGuestSearch) handleSavedGuestSearch('')
        else setManualStudentName('')
        setShowSavedGuestDropdown?.(false)
    }
    const appendRider = () => {
        if (!canAppendRider) return
        const nextRiders = parseActualRiders(
            [...committedRiders, ...parseActualRiders(riderDraft)].join('＋')
        )
        setCommittedRiders(nextRiders)
        setRiderDraft('')
        emitRiderValue(nextRiders, '')
        window.setTimeout(() => actualRiderInputRef.current?.focus(), 0)
    }

    const removeRider = (index: number) => {
        const nextRiders = committedRiders.filter((_, riderIndex) => riderIndex !== index)
        setCommittedRiders(nextRiders)
        emitRiderValue(nextRiders, riderDraft)
    }

    return (
        <div style={{ marginBottom: designSystem.spacing.lg, position: 'relative' }}>
            <label style={getLabelStyle(true)}>
                預約人 {selectedMemberIds.length > 0 && (
                    <span style={{ color: designSystem.colors.success[700], fontSize: getFontSize('button', true) }}>
                        （已選 {selectedMemberIds.length} 位）
                    </span>
                )}
            </label>

            {(selectedMemberIds.length > 0 || manualNames.length > 0 || selectedSavedGuests.length > 0) && (
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
                                fontSize: getFontSize('body', true),
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
                                        fontSize: getFontSize('h3', false),
                                        lineHeight: '1',
                                        touchAction: 'manipulation',
                                    }}
                                >×</button>
                            </span>
                        ) : null
                    })}

                    {selectedSavedGuests.map((guest) => (
                        <span key={`${guest.id}:${guest.booking_name || guest.name}`} style={{
                            padding: '6px 12px',
                            background: designSystem.colors.success[50],
                            color: designSystem.colors.success[700],
                            border: `1px solid ${designSystem.colors.success[500]}`,
                            borderRadius: designSystem.borderRadius.md,
                            fontSize: getFontSize('body', true),
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '600',
                        }}>
                            {guest.booking_name || guest.name}
                            <small>LINE</small>
                            <button
                                type="button"
                                onClick={() => setSelectedSavedGuests?.((current) =>
                                    current.filter((item) =>
                                        item.id !== guest.id ||
                                        (item.booking_name || item.name) !==
                                            (guest.booking_name || guest.name)
                                    )
                                )}
                                aria-label={`移除已建檔非會員 ${guest.booking_name || guest.name}`}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: designSystem.colors.success[700],
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontSize: getFontSize('h3', false),
                                    lineHeight: 1,
                                    touchAction: 'manipulation',
                                }}
                            >
                                ×
                            </button>
                        </span>
                    ))}

                    {manualNames.map((name, index) => (
                        <span key={index} style={{
                            padding: '6px 12px',
                            background: designSystem.colors.warning[50],
                            color: designSystem.colors.warning[700],
                            border: `1.5px dashed ${designSystem.colors.warning[500]}`,
                            borderRadius: designSystem.borderRadius.md,
                            fontSize: getFontSize('body', true),
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
                                    fontSize: getFontSize('h3', false),
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
                                        fontSize: getFontSize('button', true),
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
                <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    <input
                        type="text"
                        value={manualStudentName}
                        onChange={(e) => {
                            const value = e.target.value
                            if (handleSavedGuestSearch) handleSavedGuestSearch(value)
                            else setManualStudentName(value)
                        }}
                        onFocus={() => {
                            if (savedGuestSearchResults.length > 0) setShowSavedGuestDropdown?.(true)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing && manualStudentName.trim()) {
                                e.preventDefault()
                                setManualNames(prev => [...prev, manualStudentName.trim()])
                                clearSavedGuestSearch()
                            }
                        }}
                        placeholder="或直接輸入姓名（非會員/首次體驗）"
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: designSystem.borderRadius.lg,
                            border: `1px solid ${designSystem.colors.warning[500]}`,
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            touchAction: 'manipulation',
                        }}
                    />
                    {showSavedGuestDropdown && savedGuestSearchResults.length > 0 && (
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
                            {savedGuestSearchResults.map((guest) => {
                                const isSelected = selectedSavedGuests.some((item) => item.id === guest.id)
                                return (
                                <button
                                    key={guest.id}
                                    type="button"
                                    onClick={() => {
                                        if (!isSelected) {
                                            setSelectedSavedGuests?.((current) => [...current, guest])
                                        }
                                        clearSavedGuestSearch()
                                    }}
                                    disabled={isSelected}
                                    style={{
                                        width: '100%',
                                        padding: designSystem.spacing.md,
                                        border: 0,
                                        borderBottom: `1px solid ${designSystem.colors.border.light}`,
                                        background: isSelected
                                            ? designSystem.colors.success[50]
                                            : '#ffffff',
                                        color: designSystem.colors.text.primary,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <strong>{isSelected ? '✓ ' : ''}{guest.name}</strong>
                                    <span style={{
                                        marginLeft: 8,
                                        color: designSystem.colors.success[700],
                                        fontSize: getFontSize('button', true),
                                    }}>
                                        LINE
                                    </span>
                                    {guest.line_contact?.display_name && (
                                        <div style={{
                                            marginTop: 3,
                                            color: designSystem.colors.text.secondary,
                                            fontSize: getFontSize('button', true),
                                        }}>
                                            {guest.line_contact.display_name}
                                        </div>
                                    )}
                                </button>
                                )
                            })}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => {
                        if (manualStudentName.trim()) {
                            setManualNames(prev => [...prev, manualStudentName.trim()])
                            clearSavedGuestSearch()
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
                        fontSize: getFontSize('h2', true),
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

            <div style={{
                marginTop: designSystem.spacing.md,
                display: 'grid',
                gridTemplateColumns: isMobile
                    ? 'minmax(0, 1fr) 44px'
                    : 'auto minmax(0, 1fr) 48px',
                gap: designSystem.spacing.sm,
                alignItems: 'center',
            }}>
                <label
                    htmlFor="actual-rider"
                    style={{
                        ...getLabelStyle(true),
                        marginBottom: 0,
                        whiteSpace: 'nowrap',
                        fontSize: getFontSize('button', true),
                        gridColumn: isMobile ? '1 / -1' : undefined,
                    }}
                >
                    RIDER（選填）
                </label>
                <div style={{
                    minWidth: 0,
                    minHeight: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: designSystem.borderRadius.lg,
                    border: `1px solid ${designSystem.colors.border.main}`,
                    boxSizing: 'border-box',
                    overflowX: 'auto',
                    background: '#ffffff',
                }}>
                    {committedRiders.map((rider, index) => (
                        <span key={`${rider}-${index}`} style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 8px',
                            borderRadius: designSystem.borderRadius.md,
                            background: designSystem.colors.info[50],
                            color: designSystem.colors.info[700],
                            fontSize: getFontSize('button', true),
                            fontWeight: '600',
                        }}>
                            {rider}
                            <button
                                type="button"
                                onClick={() => removeRider(index)}
                                aria-label={`移除 RIDER ${rider}`}
                                style={{
                                    padding: 0,
                                    border: 0,
                                    background: 'transparent',
                                    color: 'inherit',
                                    fontSize: '18px',
                                    lineHeight: 1,
                                    cursor: 'pointer',
                                    touchAction: 'manipulation',
                                }}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    <input
                        ref={actualRiderInputRef}
                        id="actual-rider"
                        type="text"
                        value={riderDraft}
                        onChange={(event) => {
                            const value = event.target.value
                            setRiderDraft(value)
                            emitRiderValue(committedRiders, value)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                                event.preventDefault()
                                appendRider()
                            }
                        }}
                        aria-label="RIDER（選填）"
                        style={{
                            flex: '1 0 72px',
                            minWidth: '72px',
                            padding: '6px 2px',
                            border: 0,
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            touchAction: 'manipulation',
                        }}
                    />
                </div>
                <button
                    type="button"
                    onClick={appendRider}
                    disabled={!canAppendRider}
                    aria-label="加入下一位 RIDER"
                    style={{
                        width: isMobile ? '44px' : '48px',
                        minHeight: isMobile ? '44px' : '48px',
                        padding: 0,
                        background: canAppendRider
                            ? designSystem.colors.info[500]
                            : designSystem.colors.text.disabled,
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: designSystem.borderRadius.lg,
                        fontSize: getFontSize('h2', true),
                        fontWeight: 'bold',
                        cursor: canAppendRider ? 'pointer' : 'not-allowed',
                        touchAction: 'manipulation',
                    }}
                >
                    +
                </button>
            </div>

        </div>
    )
}

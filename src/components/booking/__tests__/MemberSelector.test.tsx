import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { MemberSelector } from '../MemberSelector'

describe('MemberSelector RIDER input', () => {
  it('turns the draft into a removable item without showing a trailing plus', () => {
    const setActualRider = vi.fn()

    render(
      <MemberSelector
        members={[]}
        selectedMemberIds={[]}
        setSelectedMemberIds={vi.fn()}
        memberSearchTerm=""
        setMemberSearchTerm={vi.fn()}
        showMemberDropdown={false}
        setShowMemberDropdown={vi.fn()}
        filteredMembers={[]}
        handleMemberSearch={vi.fn()}
        manualStudentName=""
        setManualStudentName={vi.fn()}
        manualNames={[]}
        setManualNames={vi.fn()}
        actualRider=""
        setActualRider={setActualRider}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'RIDER（選填）' })
    fireEvent.change(input, { target: { value: '澤澤' } })
    expect(setActualRider).toHaveBeenLastCalledWith('澤澤')

    fireEvent.click(screen.getByRole('button', { name: '加入下一位 RIDER' }))

    expect(screen.getByText('澤澤')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(screen.queryByText('澤澤＋')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '移除 RIDER 澤澤' })).toBeInTheDocument()
  })

  it('lets staff select a saved non-member without changing direct entry', () => {
    const guest = {
      id: 'guest-1',
      line_user_id: 'U1',
      name: '吳穎',
      line_contact: {
        display_name: 'LINE 吳迪',
        picture_url: null,
        friend_status: 'friend' as const,
      },
    }
    const setSelectedSavedGuests = vi.fn()
    const handleSavedGuestSearch = vi.fn()

    render(
      <MemberSelector
        members={[]}
        selectedMemberIds={[]}
        setSelectedMemberIds={vi.fn()}
        memberSearchTerm=""
        setMemberSearchTerm={vi.fn()}
        showMemberDropdown={false}
        setShowMemberDropdown={vi.fn()}
        filteredMembers={[]}
        handleMemberSearch={vi.fn()}
        manualStudentName="吳"
        setManualStudentName={vi.fn()}
        manualNames={[]}
        setManualNames={vi.fn()}
        savedGuestSearchResults={[guest]}
        selectedSavedGuests={[]}
        setSelectedSavedGuests={setSelectedSavedGuests}
        showSavedGuestDropdown
        setShowSavedGuestDropdown={vi.fn()}
        handleSavedGuestSearch={handleSavedGuestSearch}
        actualRider=""
        setActualRider={vi.fn()}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('或直接輸入姓名（非會員/首次體驗）'),
      { target: { value: '吳穎' } },
    )
    expect(handleSavedGuestSearch).toHaveBeenCalledWith('吳穎')

    fireEvent.click(screen.getByRole('button', { name: /吳穎/ }))
    const appendGuest = setSelectedSavedGuests.mock.calls[0][0]
    expect(appendGuest([])).toEqual([guest])
  })

  it('appends and removes saved non-members independently', () => {
    const firstGuest = { id: 'guest-1', line_user_id: 'U1', name: '吳穎' }
    const secondGuest = { id: 'guest-2', line_user_id: 'U2', name: '小安' }
    const setSelectedSavedGuests = vi.fn()

    render(
      <MemberSelector
        members={[]}
        selectedMemberIds={[]}
        setSelectedMemberIds={vi.fn()}
        memberSearchTerm=""
        setMemberSearchTerm={vi.fn()}
        showMemberDropdown={false}
        setShowMemberDropdown={vi.fn()}
        filteredMembers={[]}
        handleMemberSearch={vi.fn()}
        manualStudentName="小"
        setManualStudentName={vi.fn()}
        manualNames={[]}
        setManualNames={vi.fn()}
        savedGuestSearchResults={[secondGuest]}
        selectedSavedGuests={[firstGuest]}
        setSelectedSavedGuests={setSelectedSavedGuests}
        showSavedGuestDropdown
        setShowSavedGuestDropdown={vi.fn()}
        actualRider=""
        setActualRider={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /小安/ }))
    const appendGuest = setSelectedSavedGuests.mock.calls[0][0]
    expect(appendGuest([firstGuest])).toEqual([firstGuest, secondGuest])

    fireEvent.click(screen.getByRole('button', { name: '移除已建檔非會員 吳穎' }))
    const removeGuest = setSelectedSavedGuests.mock.calls[1][0]
    expect(removeGuest([firstGuest, secondGuest])).toEqual([secondGuest])
  })
})

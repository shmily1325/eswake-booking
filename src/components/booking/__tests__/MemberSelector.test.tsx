import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { MemberSelector } from '../MemberSelector'

describe('MemberSelector', () => {
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

  it('anchors member and LINE suggestions directly below their own inputs', () => {
    const member = {
      id: 'member-1',
      name: 'Stan',
      nickname: null,
      phone: '0919767077',
    }
    const guest = { id: 'guest-1', line_user_id: 'U1', name: '小安' }

    render(
      <MemberSelector
        members={[member]}
        selectedMemberIds={[]}
        setSelectedMemberIds={vi.fn()}
        memberSearchTerm="st"
        setMemberSearchTerm={vi.fn()}
        showMemberDropdown
        setShowMemberDropdown={vi.fn()}
        filteredMembers={[member]}
        handleMemberSearch={vi.fn()}
        manualStudentName="小"
        setManualStudentName={vi.fn()}
        manualNames={[]}
        setManualNames={vi.fn()}
        savedGuestSearchResults={[guest]}
        selectedSavedGuests={[]}
        setSelectedSavedGuests={vi.fn()}
        showSavedGuestDropdown
        setShowSavedGuestDropdown={vi.fn()}
        actualRider=""
        setActualRider={vi.fn()}
      />,
    )

    expect(screen.getByTestId('member-search-dropdown').parentElement)
      .toBe(screen.getByTestId('member-search-anchor'))
    expect(screen.getByTestId('saved-guest-search-dropdown').parentElement)
      .toBe(screen.getByTestId('saved-guest-search-anchor'))
  })

  it('prevents adding a manual non-member while existing records are being checked', () => {
    render(
      <MemberSelector
        members={[]}
        selectedMemberIds={[]}
        setSelectedMemberIds={vi.fn()}
        memberSearchTerm="王"
        setMemberSearchTerm={vi.fn()}
        showMemberDropdown={false}
        setShowMemberDropdown={vi.fn()}
        filteredMembers={[]}
        handleMemberSearch={vi.fn()}
        memberSearchLoading
        manualStudentName="王小明"
        setManualStudentName={vi.fn()}
        manualNames={[]}
        setManualNames={vi.fn()}
        savedGuestSearchLoading
        actualRider=""
        setActualRider={vi.fn()}
      />,
    )

    expect(screen.getByText('搜尋中…')).toBeInTheDocument()
    expect(screen.getByText('比對中…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '正在比對已建檔非會員' })).toBeDisabled()
  })

  it('prevents adding an exact saved non-member duplicate', () => {
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
        manualStudentName="王小明"
        setManualStudentName={vi.fn()}
        manualNames={[]}
        setManualNames={vi.fn()}
        savedGuestSearchResults={[{ id: 'guest-1', line_user_id: 'U1', name: '王小明' }]}
        showSavedGuestDropdown
        actualRider=""
        setActualRider={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '請選擇已建檔非會員' })).toBeDisabled()
  })
})

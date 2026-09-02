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
})

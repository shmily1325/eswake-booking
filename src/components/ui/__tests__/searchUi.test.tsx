import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClearableSearchInput } from '../ClearableSearchInput'
import { HighlightedText } from '../HighlightedText'

describe('ClearableSearchInput', () => {
  it('clears with the visible button and returns focus to the input', () => {
    const onValueChange = vi.fn()
    render(
      <ClearableSearchInput
        value="Angela"
        onValueChange={onValueChange}
        isMobile
        aria-label="搜尋會員"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '清除搜尋' }))

    expect(onValueChange).toHaveBeenCalledWith('')
    expect(screen.getByRole('textbox', { name: '搜尋會員' })).toHaveFocus()
  })

  it('clears with Escape on desktop', () => {
    const onValueChange = vi.fn()
    render(
      <ClearableSearchInput
        value="Angela"
        onValueChange={onValueChange}
        isMobile={false}
        aria-label="搜尋會員"
      />
    )

    fireEvent.keyDown(screen.getByRole('textbox', { name: '搜尋會員' }), {
      key: 'Escape',
    })

    expect(onValueChange).toHaveBeenCalledWith('')
  })

  it('only shows the search icon while the field is empty', () => {
    const { container, rerender } = render(
      <ClearableSearchInput
        value=""
        onValueChange={() => undefined}
        isMobile
        aria-label="搜尋會員"
      />
    )

    expect(container.querySelector('svg')).not.toBeNull()

    rerender(
      <ClearableSearchInput
        value="Angela"
        onValueChange={() => undefined}
        isMobile
        aria-label="搜尋會員"
      />
    )

    expect(container.querySelector('svg')).toBeNull()
  })

  it('keeps the input text aligned when the search icon disappears', () => {
    const { rerender } = render(
      <ClearableSearchInput
        value=""
        onValueChange={() => undefined}
        isMobile
        aria-label="搜尋會員"
      />
    )
    const input = screen.getByRole('textbox', { name: '搜尋會員' })

    expect(input).toHaveStyle({ paddingLeft: '48px' })

    rerender(
      <ClearableSearchInput
        value="pe"
        onValueChange={() => undefined}
        isMobile
        aria-label="搜尋會員"
      />
    )

    expect(input).toHaveStyle({ paddingLeft: '48px' })
  })
})

describe('HighlightedText', () => {
  it('highlights each whitespace-separated search token case-insensitively', () => {
    render(
      <div>
        <HighlightedText text="RONIX One Black" query="ronix black" />
      </div>
    )

    expect(screen.getAllByText(/RONIX|Black/).map((node) => node.tagName)).toEqual([
      'MARK',
      'MARK',
    ])
  })
})

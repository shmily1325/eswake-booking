import { describe, expect, it } from 'vitest'
import {
  matchesSelectedDataIssues,
  type ProductDataIssues,
} from '../productFilterLogic'

const noIssues: ProductDataIssues = {
  unlisted: false,
  missingPrice: false,
  missingImage: false,
  missingCover: false,
  missingLabel: false,
}

describe('matchesSelectedDataIssues', () => {
  it('allows every item when no data issue is selected', () => {
    expect(matchesSelectedDataIssues(noIssues, noIssues)).toBe(true)
  })

  it('matches the selected issue', () => {
    expect(
      matchesSelectedDataIssues(
        { ...noIssues, missingPrice: true },
        { ...noIssues, missingPrice: true },
      ),
    ).toBe(true)
  })

  it('uses OR when multiple data issues are selected', () => {
    const selected = { ...noIssues, missingPrice: true, missingImage: true }

    expect(matchesSelectedDataIssues({ ...noIssues, missingPrice: true }, selected)).toBe(true)
    expect(matchesSelectedDataIssues({ ...noIssues, missingImage: true }, selected)).toBe(true)
    expect(matchesSelectedDataIssues({ ...noIssues, missingLabel: true }, selected)).toBe(false)
  })
})

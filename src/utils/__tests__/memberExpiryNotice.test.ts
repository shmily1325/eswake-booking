import { describe, expect, it } from 'vitest'
import { generateMemberExpiryNotice } from '../memberExpiryNotice'

describe('generateMemberExpiryNotice', () => {
  it('generates a membership-only notice', () => {
    const message = generateMemberExpiryNotice({
      name: '吳昌諭',
      nickname: '阿寶bao',
      membershipExpiresAt: '2026-09-30',
    })

    expect(message).toContain('■2026 會員到期通知')
    expect(message).toContain('吳昌諭（阿寶bao）您好')
    expect(message).toContain("您的會員於『2026/09/30』到期")
    expect(message).toContain('會員續約／入會：$9,000')
    expect(message).not.toContain('您的置板')
    expect(message).not.toContain('置板位續租')
  })

  it('generates a board-only notice', () => {
    const message = generateMemberExpiryNotice({
      name: '吳昌諭',
      boards: [{ slotNumber: 23, expiresAt: '2026-10-15' }],
    })

    expect(message).toContain('■2026 置板到期通知')
    expect(message).toContain("您的置板 #23 於『2026/10/15』到期")
    expect(message).toContain('置板位續租：每板 $4,000')
    expect(message).not.toContain('您的會員')
    expect(message).not.toContain('會員優惠/贈送')
  })

  it('combines membership and all board expiries into one notice', () => {
    const message = generateMemberExpiryNotice({
      name: '吳昌諭',
      nickname: '阿寶bao',
      membershipExpiresAt: '2026-09-30',
      boards: [
        { slotNumber: 23, expiresAt: '2026-10-15' },
        { slotNumber: 24, expiresAt: '2026-11-01' },
      ],
    })

    expect(message).toContain('■2026 會員與置板到期通知')
    expect(message).toContain("您的會員於『2026/09/30』到期")
    expect(message).toContain("您的置板 #23 於『2026/10/15』到期")
    expect(message).toContain("您的置板 #24 於『2026/11/01』到期")
  })

  it('returns an empty message when nothing expires', () => {
    expect(generateMemberExpiryNotice({ name: '吳昌諭' })).toBe('')
  })

  it('applies a customized template and replaces variables', () => {
    const message = generateMemberExpiryNotice(
      {
        name: '吳昌諭',
        nickname: '阿寶bao',
        membershipExpiresAt: '2026-09-30',
      },
      {
        membership: '{{recipient}}｜{{year}}\n{{expiry_lines}}',
        board: 'board',
        combined: 'combined',
      },
    )

    expect(message).toBe(
      "吳昌諭（阿寶bao）｜2026\n您的會員於『2026/09/30』到期，麻煩撥空回覆『是、否』繼續",
    )
  })
})

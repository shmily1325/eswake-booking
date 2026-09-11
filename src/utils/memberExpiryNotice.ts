export type MemberExpiryNoticeBoard = {
  slotNumber: number
  expiresAt: string
}

export type MemberExpiryNoticeInput = {
  name: string
  nickname?: string | null
  membershipExpiresAt?: string | null
  boards?: MemberExpiryNoticeBoard[]
}

export type MemberExpiryNoticeTemplates = {
  membership: string
  board: string
  combined: string
}

export const DEFAULT_MEMBER_EXPIRY_NOTICE_TEMPLATES: MemberExpiryNoticeTemplates = {
  membership: `■{{year}} 會員到期通知

{{recipient}}您好

{{expiry_lines}}

並告知付款方式

【會員費用】
▶︎ 會員續約／入會：$9,000（期限一年）

【會員優惠／贈送】
▶︎ 享有「優先無限預約」及「會員不定期優惠方案活動」
▶︎ 享有「會員優惠價」及「同行友人優惠價」
▶︎ 享有合作品牌 6–9 折優惠活動
▶︎ 贈送 30 分鐘教練指定課程（不包含船費）
▶︎ 贈送 40 分鐘大船時數（限定 G21／黑豹船型）

【注意事項】
📌若超過1週未回覆，視同放棄繼續續約與使用，ES有權移除會員資格
📌會員續約費用不包含置板位；如需繼續使用，需另支付每板 $4,000
📌{{year}} 年票券使用者必須有會籍資格，如需繼續使用，請務必續約會員

✱有任何疑問，請洽官方，謝謝`,
  board: `■{{year}} 置板到期通知

{{recipient}}您好

{{expiry_lines}}

並告知付款方式

【置板費用】
▶︎ 置板位續租：每板 $4,000（期限一年）

【注意事項】
📌若超過1週未回覆，視同放棄繼續租用，ES有權清空置板空間（📌裝備保留2個月，未取回則歸ES所有）

✱有任何疑問，請洽官方，謝謝`,
  combined: `■{{year}} 會員與置板到期通知

{{recipient}}您好

{{expiry_lines}}

並告知付款方式

【續約費用】
▶︎ 會員續約／入會：$9,000（期限一年）
▶︎ 置板位續租：每板 $4,000（期限一年）
{{combined_price}}

【會員優惠／贈送】
▶︎ 享有「優先無限預約」及「會員不定期優惠方案活動」
▶︎ 享有「會員優惠價」及「同行友人優惠價」
▶︎ 享有合作品牌 6–9 折優惠活動
▶︎ 贈送 30 分鐘教練指定課程（不包含船費）
▶︎ 贈送 40 分鐘大船時數（限定 G21／黑豹船型）

【注意事項】
📌若超過1週未回覆，視同放棄繼續續約與使用，ES有權移除會員資格與清空置板空間（📌裝備保留2個月，未取回則歸ES所有）
📌會員續約費用不包含置板位；如需繼續使用，需另支付每板 $4,000
📌{{year}} 年票券使用者必須有會籍資格，如需繼續使用，請務必續約會員

✱有任何疑問，請洽官方，謝謝`,
}

function formatDate(value: string): string {
  return value.slice(0, 10).replaceAll('-', '/')
}

function getNoticeYear(input: MemberExpiryNoticeInput): string {
  const date = input.membershipExpiresAt || input.boards?.[0]?.expiresAt
  return date?.slice(0, 4) || String(new Date().getFullYear())
}

export function generateMemberExpiryNotice(
  input: MemberExpiryNoticeInput,
  templates: MemberExpiryNoticeTemplates = DEFAULT_MEMBER_EXPIRY_NOTICE_TEMPLATES,
): string {
  const boards = input.boards ?? []
  const hasMembership = Boolean(input.membershipExpiresAt)
  const hasBoards = boards.length > 0
  if (!hasMembership && !hasBoards) return ''
  const noticeYear = getNoticeYear(input)

  const nickname = input.nickname?.trim()
  const recipient = nickname ? `${input.name}（${nickname}）` : input.name
  const expiryLines: string[] = []

  if (input.membershipExpiresAt) {
    expiryLines.push(
      `您的會員於『${formatDate(input.membershipExpiresAt)}』到期，麻煩撥空回覆『是、否』繼續`,
    )
  }
  boards.forEach((board) => {
    expiryLines.push(
      `您的置板 #${board.slotNumber} 於『${formatDate(board.expiresAt)}』到期，麻煩撥空回覆『是、否』繼續`,
    )
  })

  const template = hasMembership && hasBoards
    ? templates.combined
    : hasMembership
      ? templates.membership
      : templates.board
  const values: Record<string, string> = {
    year: noticeYear,
    recipient,
    expiry_lines: expiryLines.join('\n'),
    combined_price: boards.length === 1
      ? '▶︎ 合計：會員續約 $9,000＋置板續租 $4,000＝$13,000'
      : '',
  }

  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{{${key}}}`, value),
    template,
  ).replace(/\n{3,}/g, '\n\n').trim()
}

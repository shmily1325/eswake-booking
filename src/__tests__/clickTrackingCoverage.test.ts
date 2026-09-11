import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('admin click tracking coverage', () => {
  it('covers member expiry and supporting member actions', () => {
    const memberSource = source('src/pages/member/MemberManagement.tsx')
    const expectedEvents = [
      'member_search_clear',
      'member_filter_type_',
      'member_filter_expiring_membership',
      'member_filter_expiring_board',
      'member_filter_show_inactive',
      'member_expiring_',
      'member_expiry_search',
      'member_expiry_template_open',
      'member_expiry_notice_open',
      'member_expiry_notice_copy',
      'member_expiry_notice_send',
      'member_expiry_template_save',
      'member_unbind_line',
      'member_memo_',
    ]

    expectedEvents.forEach((event) => expect(memberSource).toContain(event))
  })

  it('covers all interactive Dashboard selectors', () => {
    const operationsSource = source(
      'src/pages/admin/Statistics/tabs/OperationsTab.tsx',
    )
    const expectedEvents = [
      'dashboard_period_month_',
      'dashboard_period_month_select',
      'dashboard_period_year_',
      'dashboard_operations_subtab_coach',
      'dashboard_operations_subtab_member',
    ]

    expectedEvents.forEach((event) => expect(operationsSource).toContain(event))
  })

  it('covers shared menu and announcement actions', () => {
    expect(source('src/components/UserMenu.tsx')).toContain('user_menu_logout')
    expect(source('src/components/UserMenu.tsx')).toContain('user_menu_')
    expect(source('src/components/DailyAnnouncement.tsx')).toContain(
      'home_announcement_',
    )
  })
})

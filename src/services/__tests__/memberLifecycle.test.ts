import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc },
}))

import {
  createMemberWithMembership,
  renewMemberMembership,
  setMemberActiveStatus,
  updateMemberMembership,
} from '../memberLifecycle'

describe('member lifecycle RPC client', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: null, error: null })
  })

  it('normalizes create input and sends boards in one RPC', async () => {
    rpc.mockResolvedValueOnce({ data: 'member-id', error: null })

    await expect(createMemberWithMembership({
      name: ' 王小明 ',
      nickname: ' 小明 ',
      phone: ' 0912345678 ',
      membershipType: 'dual',
      membershipStartDate: '2026-07-18',
      membershipEndDate: '2027-07-18',
      membershipPartnerId: 'partner-id',
      boards: [{
        slot_number: 12,
        start_date: '2026-07-18',
        expires_at: '2027-07-18',
        notes: null,
      }],
    })).resolves.toBe('member-id')

    expect(rpc).toHaveBeenCalledWith('create_member_with_membership', expect.objectContaining({
      p_name: '王小明',
      p_nickname: '小明',
      p_phone: '0912345678',
      p_membership_type: 'dual',
      p_membership_partner_id: 'partner-id',
      p_boards: [expect.objectContaining({ slot_number: 12 })],
    }))
  })

  it('passes guest normalization and mandatory-note intent to the update RPC', async () => {
    await updateMemberMembership({
      memberId: 'member-id',
      membershipType: 'guest',
      membershipStartDate: null,
      membershipEndDate: null,
      membershipPartnerId: null,
      memo: '不續約',
      recordNote: true,
    })

    expect(rpc).toHaveBeenCalledWith('update_member_membership', {
      p_member_id: 'member-id',
      p_membership_type: 'guest',
      p_membership_start_date: null,
      p_membership_end_date: null,
      p_membership_partner_id: null,
      p_memo: '不續約',
      p_record_note: true,
      p_profile: null,
      p_boards: null,
      p_deleted_board_ids: [],
    })
  })

  it('sends profile and board edits through the same membership transaction', async () => {
    await updateMemberMembership({
      memberId: 'member-id',
      membershipType: 'general',
      membershipStartDate: '2026-01-01',
      membershipEndDate: '2027-01-01',
      recordNote: false,
      profile: {
        name: '王小明',
        nickname: '小明',
        birthday: null,
        phone: '0912345678',
      },
      boards: [{
        id: 12,
        slot_number: 88,
        start_date: '2026-01-01',
        expires_at: '2027-01-01',
        notes: null,
      }],
      deletedBoardIds: [13],
    })

    expect(rpc).toHaveBeenCalledWith('update_member_membership', expect.objectContaining({
      p_profile: expect.objectContaining({ name: '王小明' }),
      p_boards: [expect.objectContaining({ id: 12, slot_number: 88 })],
      p_deleted_board_ids: [13],
    }))
  })

  it('routes renew and active status changes through dedicated RPCs', async () => {
    await renewMemberMembership('member-id', '2027-07-18', false)
    await setMemberActiveStatus('member-id', false)

    expect(rpc).toHaveBeenNthCalledWith(1, 'renew_member_membership', {
      p_member_id: 'member-id',
      p_membership_end_date: '2027-07-18',
      p_renew_both: false,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'set_member_active_status', {
      p_member_id: 'member-id',
      p_active: false,
    })
  })

  it('surfaces RPC failures', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'pair conflict' } })

    await expect(renewMemberMembership('member-id', '2027-07-18')).rejects.toMatchObject({
      message: 'pair conflict',
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc },
}))

import { moveBoardStorage } from '../boardStorage'

describe('board storage RPC client', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: null, error: null })
  })

  it('moves a board through the atomic RPC', async () => {
    await moveBoardStorage(56, 60)

    expect(rpc).toHaveBeenCalledWith('move_board_storage', {
      p_board_id: 56,
      p_target_slot_number: 60,
    })
  })

  it('preserves the database error code for occupied-slot handling', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'Board slot 60 is already occupied' },
    })

    await expect(moveBoardStorage(56, 60)).rejects.toMatchObject({
      name: '23505',
      message: 'Board slot 60 is already occupied',
    })
  })
})

import { supabase } from '../lib/supabase'

type SupabaseError = {
  message: string
  code?: string
  details?: string
  hint?: string
}

function toBoardStorageError(error: SupabaseError): Error {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join('；')
  const normalized = new Error(detail || '置板操作失敗')
  if (error.code) normalized.name = error.code
  return normalized
}

export async function moveBoardStorage(boardId: number, targetSlotNumber: number): Promise<void> {
  const { error } = await supabase.rpc('move_board_storage', {
    p_board_id: boardId,
    p_target_slot_number: targetSlotNumber,
  })

  if (error) throw toBoardStorageError(error)
}

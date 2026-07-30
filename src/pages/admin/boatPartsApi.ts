import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/supabase'

export type BoatCode = 'G21' | 'G23' | 'FI23' | 'ALL'
export type BoatPartMovementType = 'inbound' | 'outbound' | 'adjustment'

export type BoatPart = Database['public']['Tables']['boat_parts']['Row'] & {
  compatible_boats: BoatCode[]
}

export type BoatPartMovement = Database['public']['Tables']['boat_part_movements']['Row'] & {
  boat_code: BoatCode | null
  movement_type: BoatPartMovementType
}

export interface ApplyBoatPartMovementInput {
  partId: string
  movementType: BoatPartMovementType
  quantity: number
  boatCode?: BoatCode | null
  note?: string
}

type MovementResult = {
  movement_id: string
  part_id: string
  previous_quantity: number
  current_quantity: number
  delta: number
}

export async function loadBoatParts(): Promise<BoatPart[]> {
  const { data, error } = await supabase
    .from('boat_parts')
    .select(
      'id, source_row, category, part_no, name, appearance, initial_quantity, current_quantity, safety_quantity, brand, unit_price, compatible_boats, storage_location, notes, pending_repair_quantity, updated_at',
    )
    .eq('is_active', true)
    .order('category', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as BoatPart[]
}

export async function loadBoatPartMovements(
  partId: string,
  limit = 30,
): Promise<BoatPartMovement[]> {
  const { data, error } = await supabase
    .from('boat_part_movements')
    .select(
      'id, part_id, movement_type, quantity, boat_code, note, moved_at, created_by_email, affects_inventory',
    )
    .eq('part_id', partId)
    .order('moved_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as BoatPartMovement[]
}

export async function loadBoatPartMovementLedger(
  limit = 500,
): Promise<BoatPartMovement[]> {
  const { data, error } = await supabase
    .from('boat_part_movements')
    .select(
      'id, part_id, movement_type, quantity, boat_code, note, moved_at, created_by_email, affects_inventory',
    )
    .in('movement_type', ['inbound', 'outbound'])
    .order('moved_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as BoatPartMovement[]
}

export async function applyBoatPartMovement(
  input: ApplyBoatPartMovementInput,
): Promise<MovementResult> {
  const { data, error } = await supabase.rpc('apply_boat_part_movement', {
    p_part_id: input.partId,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_boat_code: input.boatCode ?? null,
    p_note: input.note?.trim() || null,
  })

  if (error) throw error
  return data as MovementResult
}

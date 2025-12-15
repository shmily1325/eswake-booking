-- 補建 coach_reports 記錄
-- 為已有參與者記錄但沒有對應 coach_reports 記錄的教練創建記錄
-- 這是為了配合新邏輯：用 coach_reports 判斷教練是否已回報

-- 找出所有已回報參與者但沒有 coach_reports 記錄的 (booking_id, coach_id) 組合
-- 然後插入 coach_reports 記錄（driver_duration_min = null，表示純教練回報）

INSERT INTO coach_reports (booking_id, coach_id, driver_duration_min, reported_at)
SELECT DISTINCT 
    bp.booking_id,
    bp.coach_id,
    NULL::INTEGER as driver_duration_min,
    MIN(bp.reported_at) as reported_at  -- 使用最早的回報時間
FROM booking_participants bp
WHERE bp.is_deleted = false
  AND bp.coach_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM coach_reports cr 
    WHERE cr.booking_id = bp.booking_id 
      AND cr.coach_id = bp.coach_id
  )
GROUP BY bp.booking_id, bp.coach_id
ON CONFLICT (booking_id, coach_id) DO NOTHING;

-- 顯示補建了多少筆記錄
-- SELECT COUNT(*) as backfilled_count FROM coach_reports WHERE driver_duration_min IS NULL;


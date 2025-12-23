-- 查詢含有「非會員：」的記錄
SELECT 
    id, 
    participant_name, 
    member_id,
    status, 
    notes,
    created_at
FROM booking_participants 
WHERE notes LIKE '%非會員：%' 
ORDER BY id DESC;

-- 統計數量
SELECT COUNT(*) as total_count
FROM booking_participants 
WHERE notes LIKE '%非會員：%';


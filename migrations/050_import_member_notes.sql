-- 050_import_member_notes.sql
-- 批次匯入會員備忘錄（會員＋置板）
-- 直接在 Supabase SQL Editor 執行此腳本

-- 1. 何峻宏
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-21', '續約', '續約' FROM members WHERE name = '何峻宏' OR nickname = '何峻宏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-07-27', '續約', '續約會員＋置版(贈送) 2024/7/21-2025/7/21' FROM members WHERE name = '何峻宏' OR nickname = '何峻宏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-28', '續約', '續約' FROM members WHERE name = '何峻宏' OR nickname = '何峻宏' LIMIT 1;

-- 2. 李奇勳
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-08-12', '續約', '續約(會員)' FROM members WHERE name = '李奇勳' OR nickname = '李奇勳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-11', '購買', '買VIP方案 贈送置板1年 (已使用2023/8/26~2024/8/26)' FROM members WHERE name = '李奇勳' OR nickname = '李奇勳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-12-27', '購買', '買船卷送一年置板已使用' FROM members WHERE name = '李奇勳' OR nickname = '李奇勳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-16', '續約', '續約(會員)' FROM members WHERE name = '李奇勳' OR nickname = '李奇勳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-10', '續約', '續約(會員)' FROM members WHERE name = '李奇勳' OR nickname = '李奇勳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-26', '贈送', '2024船卷贈送 2025/8/26-2027/8/26 使用2026票卷(置板)' FROM members WHERE name = '李奇勳' OR nickname = '李奇勳' LIMIT 1;

-- 3. 李權恩
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-10', '續約', '與SAFIN共同會員續約(雙人會員)' FROM members WHERE name = '李權恩' OR nickname = '李權恩' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-07-26', '續約', '續約置板' FROM members WHERE name = '李權恩' OR nickname = '李權恩' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-03', '續約', '續約置板' FROM members WHERE name = '李權恩' OR nickname = '李權恩' LIMIT 1;

-- 4. 楊長峯
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-10-08', '續約', '續約(會員)' FROM members WHERE name = '楊長峯' OR nickname = '楊長峯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-25', '購買', '購買VIP方案 贈半年未使用' FROM members WHERE name = '楊長峯' OR nickname = '楊長峯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-19', '續約', '續約＋使用贈送置板' FROM members WHERE name = '楊長峯' OR nickname = '楊長峯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-30', '續約', '續約(會員)' FROM members WHERE name = '楊長峯' OR nickname = '楊長峯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-12', '續約', '續約(會員)' FROM members WHERE name = '楊長峯' OR nickname = '楊長峯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-02-07', '購買', '購買船卷送一年置板已使用(置板)' FROM members WHERE name = '楊長峯' OR nickname = '楊長峯' LIMIT 1;

-- 5. 邱俊翔
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-18', '續約', '續約(會員)' FROM members WHERE name = '邱俊翔' OR nickname = '邱俊翔' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-09', '續約', '續約(會員)' FROM members WHERE name = '邱俊翔' OR nickname = '邱俊翔' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-12', '續約', '續約(會員)' FROM members WHERE name = '邱俊翔' OR nickname = '邱俊翔' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-11-18', '贈送', '船卷送(置板)' FROM members WHERE name = '邱俊翔' OR nickname = '邱俊翔' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-12', '續約', '續約(置板)' FROM members WHERE name = '邱俊翔' OR nickname = '邱俊翔' LIMIT 1;

-- 6. 汪弘城
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-08-12', '續約', '續約(會員)' FROM members WHERE name = '汪弘城' OR nickname = '汪弘城' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '廠商贈送2年(會員)' FROM members WHERE name = '汪弘城' OR nickname = '汪弘城' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '廠商贈送2年(置板)' FROM members WHERE name = '汪弘城' OR nickname = '汪弘城' LIMIT 1;

-- 7. 楊世雯
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-21', '續約', '續約(會員)' FROM members WHERE name = '楊世雯' OR nickname = '楊世雯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-28', '續約', '續約(會員)' FROM members WHERE name = '楊世雯' OR nickname = '楊世雯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-20', '續約', '續約置板 大船卷折抵使用完畢' FROM members WHERE name = '楊世雯' OR nickname = '楊世雯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-28', '續約', '續約(置板)' FROM members WHERE name = '楊世雯' OR nickname = '楊世雯' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-07-16', '贈送', '2026/7/16-2027/7/16 使用26年票卷送(置板)' FROM members WHERE name = '楊世雯' OR nickname = '楊世雯' LIMIT 1;

-- 8. 邱柏瑞
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-08-02', '續約', '續約(過去續約紀錄)' FROM members WHERE name = '邱柏瑞' OR nickname = '邱柏瑞' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-11', '續約', '續約(會員)' FROM members WHERE name = '邱柏瑞' OR nickname = '邱柏瑞' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-11', '續約', '續約大船置板(使用完畢) 2026/09/11置板到期' FROM members WHERE name = '邱柏瑞' OR nickname = '邱柏瑞' LIMIT 1;

-- 9. 林昱萱
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-09-25', '續約', '續約(會員)' FROM members WHERE name = '林昱萱' OR nickname = '林昱萱' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-19', '購買', '購買VIP方案 贈半年' FROM members WHERE name = '林昱萱' OR nickname = '林昱萱' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-09-28', '續約', '續約(會員)' FROM members WHERE name = '林昱萱' OR nickname = '林昱萱' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-06', '購買', '購買船卷 贈送置板一年 未使用' FROM members WHERE name = '林昱萱' OR nickname = '林昱萱' LIMIT 1;

-- 10. 張沛然
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-02', '續約', '續約 比賽幫忙時數3HR' FROM members WHERE name = '張沛然' OR nickname = '張沛然' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-12', '續約', '續約(會員)' FROM members WHERE name = '張沛然' OR nickname = '張沛然' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-06', '續約', '續約(會員)' FROM members WHERE name = '張沛然' OR nickname = '張沛然' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-06', '續約', '續約(置板)' FROM members WHERE name = '張沛然' OR nickname = '張沛然' LIMIT 1;

-- 11. 賴奕茵
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-06', '續約', '續約＋購買大船卷 置板同步使用 比賽幫忙時數3HR' FROM members WHERE name = '賴奕茵' OR nickname = '賴奕茵' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-12-03', '續約', '續約 與JOANNA共同會員' FROM members WHERE name = '賴奕茵' OR nickname = '賴奕茵' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-15', '續約', '續約(雙人會員)' FROM members WHERE name = '賴奕茵' OR nickname = '賴奕茵' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '使用', '使用2025船卷*2 使用2026船卷*2(置板)' FROM members WHERE name = '賴奕茵' OR nickname = '賴奕茵' LIMIT 1;

-- 12. 王月櫻
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-21', '續約', '續約＋船卷贈送置板一同使用' FROM members WHERE name = '王月櫻' OR nickname = '王月櫻' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-15', '續約', '續約(雙人會員)' FROM members WHERE name = '王月櫻' OR nickname = '王月櫻' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-11-18', '贈送', '2024/11/18-2025/11/18使用置板贈送(置板)' FROM members WHERE name = '王月櫻' OR nickname = '王月櫻' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-11-18', '贈送', '2025/11/18-2026/11/18使用26年贈送(置板)' FROM members WHERE name = '王月櫻' OR nickname = '王月櫻' LIMIT 1;

-- 13. 王奕翔 (無備忘錄)

-- 14. 賴宇瑄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-02-14', '續約', '續約(2023/7/10-2024/7/10 置板一年ES贈)' FROM members WHERE name = '賴宇瑄' OR nickname = '賴宇瑄' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '廠商贈送兩年2024-2026(會員)' FROM members WHERE name = '賴宇瑄' OR nickname = '賴宇瑄' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '廠商贈送兩年2024-2026(置板)' FROM members WHERE name = '賴宇瑄' OR nickname = '賴宇瑄' LIMIT 1;

-- 15. 吳典豈
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-26', '續約', '續約(會員)' FROM members WHERE name = '吳典豈' OR nickname = '吳典豈' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-13', '續約', '續約(會員)' FROM members WHERE name = '吳典豈' OR nickname = '吳典豈' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-13', '續約', '續約(置板)' FROM members WHERE name = '吳典豈' OR nickname = '吳典豈' LIMIT 1;

-- 16. 劉益逢
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-10-12', '續約', '續約(會員)' FROM members WHERE name = '劉益逢' OR nickname = '劉益逢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-29', '續約', '續約＋船卷送置板使用' FROM members WHERE name = '劉益逢' OR nickname = '劉益逢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-22', '續約', '續約(會員)' FROM members WHERE name = '劉益逢' OR nickname = '劉益逢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-29', '贈送', '續約＋船卷送置板使用到2024/10/29(置板)' FROM members WHERE name = '劉益逢' OR nickname = '劉益逢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '使用', '2025船卷送置板已使用(置板)' FROM members WHERE name = '劉益逢' OR nickname = '劉益逢' LIMIT 1;

-- 17. 陳依婷
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-12-29', '續約', '續約(會員)' FROM members WHERE name = '陳依婷' OR nickname = '陳依婷' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-12', '購買', '購買VIP方案贈送一年置板尚未使用' FROM members WHERE name = '陳依婷' OR nickname = '陳依婷' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '廠商贈送兩年2024-2026(會員)' FROM members WHERE name = '陳依婷' OR nickname = '陳依婷' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '廠商贈送兩年2024-2026(置板)' FROM members WHERE name = '陳依婷' OR nickname = '陳依婷' LIMIT 1;

-- 18. 劉建宏
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-12-05', '續約', '續約(會員)' FROM members WHERE name = '劉建宏' OR nickname = '劉建宏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-12-10', '續約', '續約(會員)' FROM members WHERE name = '劉建宏' OR nickname = '劉建宏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-13', '續約', '續約(會員)' FROM members WHERE name = '劉建宏' OR nickname = '劉建宏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-12-05', '贈送', '2024/12/5-2025/12/5使用票卷送(置板)' FROM members WHERE name = '劉建宏' OR nickname = '劉建宏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-12-05', '贈送', '2025/12/5-2026/12/5使用票卷贈送(置板)' FROM members WHERE name = '劉建宏' OR nickname = '劉建宏' LIMIT 1;

-- 19. 許書源
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-12-26', '續約', '續約(會員)' FROM members WHERE name = '許書源' OR nickname = '許書源' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-12-04', '續約', '續約(會員)' FROM members WHERE name = '許書源' OR nickname = '許書源' LIMIT 1;

-- 20. 洪瀅淳
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-04', '續約', '續約+購買VIP方案 贈送置板1年已使用' FROM members WHERE name = '洪瀅淳' OR nickname = '洪瀅淳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-01-16', '購買', '購買A2船卷贈送年置板已使用' FROM members WHERE name = '洪瀅淳' OR nickname = '洪瀅淳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-07-22', '續約', '續約(會員)' FROM members WHERE name = '洪瀅淳' OR nickname = '洪瀅淳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-29', '續約', '續約(會員)' FROM members WHERE name = '洪瀅淳' OR nickname = '洪瀅淳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-05', '贈送', '2025/7/5-2026/7/5使用票卷贈送(置板)' FROM members WHERE name = '洪瀅淳' OR nickname = '洪瀅淳' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-07-05', '贈送', '2026/7/5-2027/7/5使用26票卷贈送(置板)' FROM members WHERE name = '洪瀅淳' OR nickname = '洪瀅淳' LIMIT 1;

-- 21. 鄭宇峰
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-03-21', '續約', '續約(會員)' FROM members WHERE name = '鄭宇峰' OR nickname = '鄭宇峰' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-30', '續約', '已續約/購買G23卷送置板一年' FROM members WHERE name = '鄭宇峰' OR nickname = '鄭宇峰' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-18', '續約', '續約(會員)' FROM members WHERE name = '鄭宇峰' OR nickname = '鄭宇峰' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-03-01', '贈送', '2024/3/1-2025/3/1使用票卷贈置板' FROM members WHERE name = '鄭宇峰' OR nickname = '鄭宇峰' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-17', '續約', '續約(置板)' FROM members WHERE name = '鄭宇峰' OR nickname = '鄭宇峰' LIMIT 1;

-- 22. 陳羽榛
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', 'FREE(會員)' FROM members WHERE name = '陳羽榛' OR nickname = '陳羽榛' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', 'FREE(置板)' FROM members WHERE name = '陳羽榛' OR nickname = '陳羽榛' LIMIT 1;

-- 23. 鍾宜欣
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-06-17', '續約', '續約會員＋置板' FROM members WHERE name = '鍾宜欣' OR nickname = '鍾宜欣' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-06-12', '續約', '已續約1+1 DUKE比賽幫忙時數2HR' FROM members WHERE name = '鍾宜欣' OR nickname = '鍾宜欣' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-08', '續約', '跟QUEENIE雙人會員續約' FROM members WHERE name = '鍾宜欣' OR nickname = '鍾宜欣' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-08', '續約', '續約(置板)' FROM members WHERE name = '鍾宜欣' OR nickname = '鍾宜欣' LIMIT 1;

-- 24. 郭家華
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-28', '入會', '置板開始' FROM members WHERE name = '郭家華' OR nickname = '郭家華' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-06-08', '續約', '續約會員+置板' FROM members WHERE name = '郭家華' OR nickname = '郭家華' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-08', '續約', '跟QUEENIE雙人會員續約' FROM members WHERE name = '郭家華' OR nickname = '郭家華' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-08', '續約', '續約(置板)' FROM members WHERE name = '郭家華' OR nickname = '郭家華' LIMIT 1;

-- 25. 李家銘
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-09-12', '續約', '續約(會員)' FROM members WHERE name = '李家銘' OR nickname = '李家銘' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-20', '續約', '續約(會員)' FROM members WHERE name = '李家銘' OR nickname = '李家銘' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-16', '續約', '續約(會員)' FROM members WHERE name = '李家銘' OR nickname = '李家銘' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-09-09', '贈送', '2025/9/9-2026/9/9使用2026票卷(置板)' FROM members WHERE name = '李家銘' OR nickname = '李家銘' LIMIT 1;

-- 26. 黃高宇
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-09-18', '續約', '續會(會員)' FROM members WHERE name = '黃高宇' OR nickname = '黃高宇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-09', '續約', '續約 贈送大船時數1.5 4/24-30' FROM members WHERE name = '黃高宇' OR nickname = '黃高宇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-13', '續約', '續約(會員)' FROM members WHERE name = '黃高宇' OR nickname = '黃高宇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-01', '續約', '續約(會員)' FROM members WHERE name = '黃高宇' OR nickname = '黃高宇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-11', '贈送', '2024/9/11-2025/9/11使用票卷贈送置板' FROM members WHERE name = '黃高宇' OR nickname = '黃高宇' LIMIT 1;

-- 27. 董彥良
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-09-18', '續約', '續約(會員)' FROM members WHERE name = '董彥良' OR nickname = '董彥良' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-09-27', '續約', '續約 買船卷 有置板一年(官方有註記 續約資訊' FROM members WHERE name = '董彥良' OR nickname = '董彥良' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-03', '續約', '續約(會員)' FROM members WHERE name = '董彥良' OR nickname = '董彥良' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-13', '贈送', '2024/10/13-2025/10/13使用票卷贈送置板' FROM members WHERE name = '董彥良' OR nickname = '董彥良' LIMIT 1;

-- 28. 李幸純
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', 'FREE(會員)' FROM members WHERE name = '李幸純' OR nickname = '李幸純' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', 'FREE(置板)' FROM members WHERE name = '李幸純' OR nickname = '李幸純' LIMIT 1;

-- 29. 王智瑋
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-06-03', '續約', '置板續約 置板2024/6/3到期' FROM members WHERE name = '王智瑋' OR nickname = '王智瑋' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-30', '續約', '會員續約 用阿中到期日續' FROM members WHERE name = '王智瑋' OR nickname = '王智瑋' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-13', '續約', '續約(雙人會員)' FROM members WHERE name = '王智瑋' OR nickname = '王智瑋' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-13', '續約', '續約(置板)' FROM members WHERE name = '王智瑋' OR nickname = '王智瑋' LIMIT 1;

-- 30. 阿中
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-13', '入會', '與TONY雙人會員開始' FROM members WHERE name = '阿中' OR nickname = '阿中' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-13', '續約', '續約(置板)' FROM members WHERE name = '阿中' OR nickname = '阿中' LIMIT 1;

-- 31. 林冠宇
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-01', '續約', '續約會員＋置板' FROM members WHERE name = '林冠宇' OR nickname = '林冠宇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-01', '續約', '續約2年(會員)' FROM members WHERE name = '林冠宇' OR nickname = '林冠宇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-01', '續約', '續約2年(置板)' FROM members WHERE name = '林冠宇' OR nickname = '林冠宇' LIMIT 1;

-- 32. 郭祖睿
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-06-01', '續約', '續約會員與置板' FROM members WHERE name = '郭祖睿' OR nickname = '郭祖睿' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-06-01', '續約', '續約(會員)' FROM members WHERE name = '郭祖睿' OR nickname = '郭祖睿' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-25', '續約', '續約(會員)' FROM members WHERE name = '郭祖睿' OR nickname = '郭祖睿' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-25', '續約', '續約(置板)' FROM members WHERE name = '郭祖睿' OR nickname = '郭祖睿' LIMIT 1;

-- 33. 王國維
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-01', '購買', '買VIP方案贈送半年置板 2023/5/29~2024/5/29（RAY+SIMON合購）' FROM members WHERE name = '王國維' OR nickname = '王國維' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-02-07', '購買', '購買船卷贈送一年置板空間未使用' FROM members WHERE name = '王國維' OR nickname = '王國維' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-07-20', '續約', '會員續約' FROM members WHERE name = '王國維' OR nickname = '王國維' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-05-29', '贈送', '2024/5/29-2025/5/29使用票卷贈送(置板)' FROM members WHERE name = '王國維' OR nickname = '王國維' LIMIT 1;

-- 34. 林敏
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-06-04', '續約', '續約會員＋置版' FROM members WHERE name = '林敏' OR nickname = '林敏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-06-08', '續約', '續約(會員)' FROM members WHERE name = '林敏' OR nickname = '林敏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-08', '續約', '續約(會員)' FROM members WHERE name = '林敏' OR nickname = '林敏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-04', '贈送', '2025/6/4-2027/6/4使用票卷贈送置板' FROM members WHERE name = '林敏' OR nickname = '林敏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2027-06-04', '贈送', '2027/6/4-2028/6/4用26票卷送(置板)' FROM members WHERE name = '林敏' OR nickname = '林敏' LIMIT 1;

-- 35. 王怡文
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-15', '續約', '續約會員＋置板' FROM members WHERE name = '王怡文' OR nickname = '王怡文' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-07-20', '續約', '續約會員+置板' FROM members WHERE name = '王怡文' OR nickname = '王怡文' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-04', '續約', '續約(會員)' FROM members WHERE name = '王怡文' OR nickname = '王怡文' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-02', '贈送', '2025/7/2-2026/7/2使用票卷贈送置板' FROM members WHERE name = '王怡文' OR nickname = '王怡文' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-07-02', '贈送', '2026/7/2-2027/7/2使用26年票卷送(置板)' FROM members WHERE name = '王怡文' OR nickname = '王怡文' LIMIT 1;

-- 36. 陳沁彤
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-04-14', '購買', '購買VIP方案贈送置板一年' FROM members WHERE name = '陳沁彤' OR nickname = '陳沁彤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-15', '續約', '續約＋置板開始計算+(2023/1月份請假暫停1個月）' FROM members WHERE name = '陳沁彤' OR nickname = '陳沁彤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-06-06', '購買', '購買G23卷置板贈送一年已使用' FROM members WHERE name = '陳沁彤' OR nickname = '陳沁彤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-05', '續約', '續約(會員)' FROM members WHERE name = '陳沁彤' OR nickname = '陳沁彤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-15', '購買', '2023/7/15-2024/8/15購買置板' FROM members WHERE name = '陳沁彤' OR nickname = '陳沁彤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-08-15', '贈送', '2024/8/15-2025/8/15使用票卷贈送置板' FROM members WHERE name = '陳沁彤' OR nickname = '陳沁彤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-08-15', '贈送', '2026/8/15-2027/8/15使用26票卷送(置板)' FROM members WHERE name = '陳沁彤' OR nickname = '陳沁彤' LIMIT 1;

-- 37. 何星岱
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-15', '續約', '續約＋同步使用一年置板(不分船)' FROM members WHERE name = '何星岱' OR nickname = '何星岱' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-11-03', '贈送', '2024/11/3-2025/11/3使用票卷贈送置板G23' FROM members WHERE name = '何星岱' OR nickname = '何星岱' LIMIT 1;

-- 38. 林孟穎
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '2024贊助比賽贈送一年(會員＋置板同天開始) 廠商贈送兩年' FROM members WHERE name = '林孟穎' OR nickname = '林孟穎' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '廠商贈送兩年(置板)' FROM members WHERE name = '林孟穎' OR nickname = '林孟穎' LIMIT 1;

-- 39. 廖英夙
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-05-20', '續約', '續約(會員＋置板同天開始VIP贈送)' FROM members WHERE name = '廖英夙' OR nickname = '廖英夙' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-04', '續約', '續約 與LISA雙人會員' FROM members WHERE name = '廖英夙' OR nickname = '廖英夙' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-04', '續約', '續約置板' FROM members WHERE name = '廖英夙' OR nickname = '廖英夙' LIMIT 1;

-- 40. 李思愉
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-04', '續約', '續約 與Susan雙人會員' FROM members WHERE name = '李思愉' OR nickname = '李思愉' LIMIT 1;

-- 41. 蔡志權
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-29', '續約', '續約(會員)' FROM members WHERE name = '蔡志權' OR nickname = '蔡志權' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-29', '續約', '續約(置板)' FROM members WHERE name = '蔡志權' OR nickname = '蔡志權' LIMIT 1;

-- 42. 陳又嘉
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-08-10', '入會', '置板開始' FROM members WHERE name = '陳又嘉' OR nickname = '陳又嘉' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-08-14', '續約', '續約會員+置板' FROM members WHERE name = '陳又嘉' OR nickname = '陳又嘉' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-02', '續約', '續約(會員)' FROM members WHERE name = '陳又嘉' OR nickname = '陳又嘉' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-08-10', '贈送', '2023/8/10-2025/8/10使用票卷贈送2年(置板)' FROM members WHERE name = '陳又嘉' OR nickname = '陳又嘉' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-10', '贈送', '2025/8/10-2026/8/10使用票卷贈送1年(置板)' FROM members WHERE name = '陳又嘉' OR nickname = '陳又嘉' LIMIT 1;

-- 43. 羅宜亭
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-21', '入會', '置板開始' FROM members WHERE name = '羅宜亭' OR nickname = '羅宜亭' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-30', '續約', '續約(會員)' FROM members WHERE name = '羅宜亭' OR nickname = '羅宜亭' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-30', '續約', '續約(置板)' FROM members WHERE name = '羅宜亭' OR nickname = '羅宜亭' LIMIT 1;

-- 44. 孫可恩
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-09', '購買', '買船卷送一年置板已使用' FROM members WHERE name = '孫可恩' OR nickname = '孫可恩' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-04-02', '購買', '買2套置板已使用 總共3年置板' FROM members WHERE name = '孫可恩' OR nickname = '孫可恩' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-30', '續約', '續約 置板到2027/8/28' FROM members WHERE name = '孫可恩' OR nickname = '孫可恩' LIMIT 1;

-- 45. 楊希傑
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-22', '入會', '重新入會' FROM members WHERE name = '楊希傑' OR nickname = '楊希傑' LIMIT 1;

-- 46. 何翠蘋
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-12-10', '入會', '置板開始(2023/12/10~2024/12/10)' FROM members WHERE name = '何翠蘋' OR nickname = '何翠蘋' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-09', '續約', '續約(會員)' FROM members WHERE name = '何翠蘋' OR nickname = '何翠蘋' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-12-10', '贈送', '2024/12/10-2025/12/10使用票卷贈送置板' FROM members WHERE name = '何翠蘋' OR nickname = '何翠蘋' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-12-10', '贈送', '2025/12/10-2026/12/10使用2026票卷(置板)' FROM members WHERE name = '何翠蘋' OR nickname = '何翠蘋' LIMIT 1;

-- 47. 陳建宏
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-11-24', '續約', '已匯款續約' FROM members WHERE name = '陳建宏' OR nickname = '陳建宏' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-12-01', '續約', '續約(會員)' FROM members WHERE name = '陳建宏' OR nickname = '陳建宏' LIMIT 1;

-- 48. 童瓊慧Joy(媽媽)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-29', '入會', '置板開始使用' FROM members WHERE name = '童瓊慧Joy(媽媽)' OR nickname = '童瓊慧Joy(媽媽)' OR name = '童瓊慧' OR nickname = '童瓊慧' OR nickname = 'Joy' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-05-10', '購買', '購買G23票卷 置板未使用' FROM members WHERE name = '童瓊慧Joy(媽媽)' OR nickname = '童瓊慧Joy(媽媽)' OR name = '童瓊慧' OR nickname = '童瓊慧' OR nickname = 'Joy' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-29', '贈送', '2024不分船*2組G23*1組共送置板3年 2023/11/29-2026/11/29使用票卷贈送置板' FROM members WHERE name = '童瓊慧Joy(媽媽)' OR nickname = '童瓊慧Joy(媽媽)' OR name = '童瓊慧' OR nickname = '童瓊慧' OR nickname = 'Joy' LIMIT 1;

-- 49. 黃千芮
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-02-27', '續約', '續約 停籍2個月' FROM members WHERE name = '黃千芮' OR nickname = '黃千芮' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-18', '備註', '膝關節開刀' FROM members WHERE name = '黃千芮' OR nickname = '黃千芮' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-01', '贈送', '2025/7/1-2026/7/1使用票卷贈送(置板)' FROM members WHERE name = '黃千芮' OR nickname = '黃千芮' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-07-11', '贈送', '2026/7/11-2027/7/11使用26年票卷贈送(置板)' FROM members WHERE name = '黃千芮' OR nickname = '黃千芮' LIMIT 1;

-- 50. 鍾旻峻
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-03-17', '備註', '肩頸受傷停籍一個月' FROM members WHERE name = '鍾旻峻' OR nickname = '鍾旻峻' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-04-14', '備註', '開始(會員)' FROM members WHERE name = '鍾旻峻' OR nickname = '鍾旻峻' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-11-09', '入會', '置板開始(2024/11/09-2025/11/09)' FROM members WHERE name = '鍾旻峻' OR nickname = '鍾旻峻' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-18', '續約', '續約(會員)' FROM members WHERE name = '鍾旻峻' OR nickname = '鍾旻峻' LIMIT 1;

-- 51. 林紘盛
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-04-02', '入會', '入會(會員)' FROM members WHERE name = '林紘盛' OR nickname = '林紘盛' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-04-29', '入會', '置板開始' FROM members WHERE name = '林紘盛' OR nickname = '林紘盛' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-29', '續約', '續約(會員)' FROM members WHERE name = '林紘盛' OR nickname = '林紘盛' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-29', '續約', '續約(置板)' FROM members WHERE name = '林紘盛' OR nickname = '林紘盛' LIMIT 1;

-- 52. 陳奕潔
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-07', '續約', '續約(會員)' FROM members WHERE name = '陳奕潔' OR nickname = '陳奕潔' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-15', '贈送', '2025/4/15-2026/4/15使用票卷贈送(置板)' FROM members WHERE name = '陳奕潔' OR nickname = '陳奕潔' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-04-15', '贈送', '2026/4/15-2027/4/15使用26年票卷贈送(置板)' FROM members WHERE name = '陳奕潔' OR nickname = '陳奕潔' LIMIT 1;

-- 53. 黃家畇
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-07', '續約', '續約(會員)' FROM members WHERE name = '黃家畇' OR nickname = '黃家畇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-26', '贈送', '2025/4/26-2026/4/26用25年票卷贈送(置板)' FROM members WHERE name = '黃家畇' OR nickname = '黃家畇' LIMIT 1;

-- 54. 陳柏年
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-09-23', '入會', '置板開始' FROM members WHERE name = '陳柏年' OR nickname = '陳柏年' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-05-25', '入會', '入會(會員)' FROM members WHERE name = '陳柏年' OR nickname = '陳柏年' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-28', '續約', '續約(會員)' FROM members WHERE name = '陳柏年' OR nickname = '陳柏年' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-28', '續約', '續約(置板)' FROM members WHERE name = '陳柏年' OR nickname = '陳柏年' LIMIT 1;

-- 55. JOE LIN
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-05-04', '入會', '入會(會員)' FROM members WHERE name = 'JOE LIN' OR nickname = 'JOE LIN' OR name = 'JOE' OR nickname = 'JOE' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-06', '續約', '續約(會員)' FROM members WHERE name = 'JOE LIN' OR nickname = 'JOE LIN' OR name = 'JOE' OR nickname = 'JOE' LIMIT 1;

-- 56. 張婷
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-06-29', '入會', '重新入會' FROM members WHERE name = '張婷' OR nickname = '張婷' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-12-10', '備註', '置板到期' FROM members WHERE name = '張婷' OR nickname = '張婷' LIMIT 1;

-- 57. Fish
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-06', '續約', '續約(會員)' FROM members WHERE name = 'Fish' OR nickname = 'Fish' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-06', '續約', '續約(置板)' FROM members WHERE name = 'Fish' OR nickname = 'Fish' LIMIT 1;

-- 58. 連建閔
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-06-08', '入會', '入會(會員)' FROM members WHERE name = '連建閔' OR nickname = '連建閔' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-08', '續約', '續會員(置板同日)' FROM members WHERE name = '連建閔' OR nickname = '連建閔' LIMIT 1;

-- 59. 陳室融
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-08-02', '入會', '入會(會員)' FROM members WHERE name = '陳室融' OR nickname = '陳室融' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-18', '入會', '置板開始' FROM members WHERE name = '陳室融' OR nickname = '陳室融' LIMIT 1;

-- 60. JAMES MILNES / AXEL CATUSSE
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', 'JAMES MILNES轉會籍給AXEL CATUSSE' FROM members WHERE name = 'JAMES MILNES' OR nickname = 'JAMES MILNES' OR name = 'AXEL CATUSSE' OR nickname = 'AXEL CATUSSE' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-22', '備註', '置板到期不續約' FROM members WHERE name = 'JAMES MILNES' OR nickname = 'JAMES MILNES' OR name = 'AXEL CATUSSE' OR nickname = 'AXEL CATUSSE' LIMIT 1;

-- 61. 葉其琛 (無備忘錄)

-- 62. 王智俊
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-24', '入會', '置板開始' FROM members WHERE name = '王智俊' OR nickname = '王智俊' LIMIT 1;

-- 63. 揚宗修
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-02', '入會', '入會(會員)' FROM members WHERE name = '揚宗修' OR nickname = '揚宗修' OR name = '楊宗修' OR nickname = '楊宗修' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-31', '續約', '續約(會員)' FROM members WHERE name = '揚宗修' OR nickname = '揚宗修' OR name = '楊宗修' OR nickname = '楊宗修' LIMIT 1;

-- 64. 林鈺恆
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-22', '入會', '入會(會員)' FROM members WHERE name = '林鈺恆' OR nickname = '林鈺恆' LIMIT 1;

-- 65. 余思瑩
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-03-11', '入會', '入會(會員)' FROM members WHERE name = '余思瑩' OR nickname = '余思瑩' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-21', '續約', '續約置板' FROM members WHERE name = '余思瑩' OR nickname = '余思瑩' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-06', '續約', '續約(置板)' FROM members WHERE name = '余思瑩' OR nickname = '余思瑩' LIMIT 1;

-- 66. 呂立仁 (無備忘錄)

-- 67. MATTHEW (無備忘錄)

-- 68. 陳俊瑛
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-20', '贈送', '2025/4/20-2026/4/20用票卷贈送(置板)' FROM members WHERE name = '陳俊瑛' OR nickname = '陳俊瑛' LIMIT 1;

-- 69. 王心恬
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-03-12', '入會', '入會(會員)' FROM members WHERE name = '王心恬' OR nickname = '王心恬' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', 'FREE(置板)' FROM members WHERE name = '王心恬' OR nickname = '王心恬' LIMIT 1;

-- 70. 楊翊
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-03-22', '入會', '入會雙人會員' FROM members WHERE name = '楊翊' OR nickname = '楊翊' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-12-29', '續約', '續約(置板)' FROM members WHERE name = '楊翊' OR nickname = '楊翊' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-02-17', '續約', '續約置板' FROM members WHERE name = '楊翊' OR nickname = '楊翊' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-02-17', '贈送', '2025/2/17-2026/2/17使用票卷贈送置板' FROM members WHERE name = '楊翊' OR nickname = '楊翊' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-02-17', '贈送', '2026/2/17-2027/2/17使用26票卷贈送(置板)' FROM members WHERE name = '楊翊' OR nickname = '楊翊' LIMIT 1;

-- 71. 李婉瑄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-03-22', '入會', '入會雙人會員' FROM members WHERE name = '李婉瑄' OR nickname = '李婉瑄' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-09', '購買', '船卷贈送一年置板 已使用到2025/6/24' FROM members WHERE name = '李婉瑄' OR nickname = '李婉瑄' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-24', '贈送', '2025/6/24-2026/6/24使用票卷贈送置板' FROM members WHERE name = '李婉瑄' OR nickname = '李婉瑄' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-06-24', '贈送', '2026/6/24-2027/6/24用26年票卷贈送(置板)' FROM members WHERE name = '李婉瑄' OR nickname = '李婉瑄' LIMIT 1;

-- 72. 王芳怡
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-02-28', '贈送', '2025/2/28-2026/2/28使用票卷贈送置板' FROM members WHERE name = '王芳怡' OR nickname = '王芳怡' LIMIT 1;

-- 73. 黃妍甄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-04-24', '入會', '入會(會員)' FROM members WHERE name = '黃妍甄' OR nickname = '黃妍甄' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '26年票卷贈送未使用(置板)' FROM members WHERE name = '黃妍甄' OR nickname = '黃妍甄' LIMIT 1;

-- 74. 吳芮綺
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-08', '入會', '入會(會員)' FROM members WHERE name = '吳芮綺' OR nickname = '吳芮綺' LIMIT 1;

-- 75. 鍾启駿
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-14', '入會', '入會(會員)' FROM members WHERE name = '鍾启駿' OR nickname = '鍾启駿' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-23', '入會', '置板開始' FROM members WHERE name = '鍾启駿' OR nickname = '鍾启駿' LIMIT 1;

-- 76. 林子翔 (無備忘錄)

-- 77. 朱黛咪
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-30', '入會', '入會(會員)' FROM members WHERE name = '朱黛咪' OR nickname = '朱黛咪' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '26年票卷贈送未使用(置板)' FROM members WHERE name = '朱黛咪' OR nickname = '朱黛咪' LIMIT 1;

-- 78. 曾愷悌
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-13', '入會', '入會(會員)' FROM members WHERE name = '曾愷悌' OR nickname = '曾愷悌' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '26票卷贈送(置板)' FROM members WHERE name = '曾愷悌' OR nickname = '曾愷悌' LIMIT 1;

-- 79. 侯新郇
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-01', '入會', '入會(會員)' FROM members WHERE name = '侯新郇' OR nickname = '侯新郇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-30', '續約', '續約(會員)' FROM members WHERE name = '侯新郇' OR nickname = '侯新郇' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-09-21', '入會', '置板開始' FROM members WHERE name = '侯新郇' OR nickname = '侯新郇' LIMIT 1;

-- 80. 陳薇巧
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-03', '入會', '入會(會員)' FROM members WHERE name = '陳薇巧' OR nickname = '陳薇巧' LIMIT 1;

-- 81. 陳誌鳴
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-05', '入會', '入會(會員)' FROM members WHERE name = '陳誌鳴' OR nickname = '陳誌鳴' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-09-09', '入會', '置板開始 2026票卷贈送置板已加入' FROM members WHERE name = '陳誌鳴' OR nickname = '陳誌鳴' LIMIT 1;

-- 82. 陳巧瑜
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-16', '入會', '入會(雙人會員)' FROM members WHERE name = '陳巧瑜' OR nickname = '陳巧瑜' LIMIT 1;

-- 83. 鄭媺璇
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-16', '入會', '入會(雙人會員)' FROM members WHERE name = '鄭媺璇' OR nickname = '鄭媺璇' LIMIT 1;

-- 84. 葉彤彤
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-15', '入會', '入會(會員)' FROM members WHERE name = '葉彤彤' OR nickname = '葉彤彤' LIMIT 1;

-- 85. 吳佳瑈
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-21', '入會', '入會(會員)' FROM members WHERE name = '吳佳瑈' OR nickname = '吳佳瑈' LIMIT 1;

-- 86. 許毅平
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-23', '入會', '入會(會員)' FROM members WHERE name = '許毅平' OR nickname = '許毅平' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-04', '入會', '置板開始' FROM members WHERE name = '許毅平' OR nickname = '許毅平' LIMIT 1;

-- 87. 楊惠茹
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-24', '入會', '入會(會員)' FROM members WHERE name = '楊惠茹' OR nickname = '楊惠茹' LIMIT 1;

-- 88. 劉容亘
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-09-07', '入會', '入會(會員)' FROM members WHERE name = '劉容亘' OR nickname = '劉容亘' LIMIT 1;

-- 89. 李子嫥
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-09-10', '入會', '入會(會員)' FROM members WHERE name = '李子嫥' OR nickname = '李子嫥' LIMIT 1;

-- 90. 林季賢
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-09-13', '入會', '入會(會員)' FROM members WHERE name = '林季賢' OR nickname = '林季賢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-09-05', '購買', '購買置板' FROM members WHERE name = '林季賢' OR nickname = '林季賢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-05', '贈送', '2024/9/5-2025/9/5使用24年票卷(置板)' FROM members WHERE name = '林季賢' OR nickname = '林季賢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-09-05', '贈送', '2025/9/5-2026/9/5使用25年票卷(置板)' FROM members WHERE name = '林季賢' OR nickname = '林季賢' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-09-05', '贈送', '2026/9/5-2027/9/5使用26年票卷贈送(置板)' FROM members WHERE name = '林季賢' OR nickname = '林季賢' LIMIT 1;

-- 91. 曾愛芸
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-01', '入會', '入會(會員)' FROM members WHERE name = '曾愛芸' OR nickname = '曾愛芸' LIMIT 1;

-- 92. 信嫂
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-20', '入會', '入會(會員)' FROM members WHERE name = '信嫂' OR nickname = '信嫂' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-06-20', '入會', '置板開始' FROM members WHERE name = '信嫂' OR nickname = '信嫂' LIMIT 1;

-- 93. 包崇芸
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-10', '入會', '入會(會員)' FROM members WHERE name = '包崇芸' OR nickname = '包崇芸' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-10', '贈送', '2025/10/10-2026/10/10使用26年船卷送(置板)' FROM members WHERE name = '包崇芸' OR nickname = '包崇芸' LIMIT 1;

-- 94. 何蕙均
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-09', '入會', '入會(雙人會員)' FROM members WHERE name = '何蕙均' OR nickname = '何蕙均' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-09', '贈送', '2025/10/9-2026/10/9使用26年置板票卷(置板)' FROM members WHERE name = '何蕙均' OR nickname = '何蕙均' LIMIT 1;

-- 95. 謝典霖
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-09', '入會', '入會(雙人會員)' FROM members WHERE name = '謝典霖' OR nickname = '謝典霖' LIMIT 1;

-- 96. 黃平
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-11', '入會', '入會(雙人會員)' FROM members WHERE name = '黃平' OR nickname = '黃平' LIMIT 1;

-- 97. 林冠伻
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-11', '入會', '入會(雙人會員)' FROM members WHERE name = '林冠伻' OR nickname = '林冠伻' LIMIT 1;

-- 98. 王韋翰
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-06-08', '續約', '續約(會員)' FROM members WHERE name = '王韋翰' OR nickname = '王韋翰' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-08-23', '續約', '續約(會員)' FROM members WHERE name = '王韋翰' OR nickname = '王韋翰' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-18', '續約', '續約(會員)' FROM members WHERE name = '王韋翰' OR nickname = '王韋翰' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-18', '續約', '續約(置板)' FROM members WHERE name = '王韋翰' OR nickname = '王韋翰' LIMIT 1;

-- 完成後顯示匯入統計
SELECT 
  '匯入完成' as status,
  COUNT(*) as total_notes,
  COUNT(DISTINCT member_id) as total_members
FROM member_notes
WHERE created_at >= NOW() - INTERVAL '5 minutes';


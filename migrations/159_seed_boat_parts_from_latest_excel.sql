-- Generated from 船艇零件庫存表 (1).xlsx.
-- The workbook's 動態庫存數量 is the opening source of truth.
-- Imported inbound/outbound rows are reference history and do not change stock again.

INSERT INTO public.boat_parts (
  source_key, source_row, category, part_no, name, appearance,
  initial_quantity, current_quantity, safety_quantity, brand, unit_price,
  compatible_boats, storage_location, notes, pending_repair_quantity
)
VALUES
(
    'boat-parts-latest-row-2', 2, '動力與推進', 'ACME2829',
    '黑豹螺旋槳', '整新', 2, 1,
    1, 'ACME', 1166,
    ARRAY['FI23']::text[], '黑架右下', NULL,
    1
  ),
(
    'boat-parts-latest-row-3', 3, '動力與推進', 'ACME2561',
    'G21螺旋槳', '整新', 3, 3,
    2, 'ACME', 1211,
    ARRAY['G21']::text[], '黑架右下', NULL,
    2
  ),
(
    'boat-parts-latest-row-4', 4, '動力與推進', 'NACME2561',
    'G21螺旋槳', '全新', 1, 0,
    0, 'ACME', 1211,
    ARRAY['G21']::text[], '黑架右下', NULL,
    0
  ),
(
    'boat-parts-latest-row-5', 5, '動力與推進', 'ACME3433',
    'G23螺旋槳', '整新', 1, 1,
    0, 'ACME', 1211,
    ARRAY['G23']::text[], '黑架右下', NULL,
    0
  ),
(
    'boat-parts-latest-row-6', 6, '動力與推進', '5350',
    '螺旋槳PIN', NULL, 0, 10,
    2, 'Nautique', 12,
    ARRAY['ALL']::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-7', 7, '動力與推進', '5344',
    '螺旋槳螺帽G21 G23', NULL, 24, 22,
    3, 'ACME', 35,
    ARRAY['G21', 'G23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-8', 8, '水路與壓艙', 'LP900S-JNSRA',
    '黑豹汙水PUMP', NULL, 2, 2,
    3, 'CENTURION', 63,
    ARRAY['FI23']::text[], '藍箱3-2', NULL,
    0
  ),
(
    'boat-parts-latest-row-9', 9, '水路與壓艙', 'LP900S-JNSRAC',
    '黑豹汙水PUMP殼', NULL, 4, 6,
    2, 'CENTURION', NULL,
    ARRAY['FI23']::text[], '藍箱3-2', NULL,
    0
  ),
(
    'boat-parts-latest-row-10', 10, '水路與壓艙', '170547',
    'G21 /G23 汙水PUMP', NULL, 4, 4,
    3, 'NAUTIQUE', 40,
    ARRAY['G21', 'G23']::text[], '藍箱3-2', NULL,
    0
  ),
(
    'boat-parts-latest-row-11', 11, '轉向系統', 'SH91810B',
    '黑豹方向機總成', NULL, 2, 2,
    1, 'CENTURION', 121.45,
    ARRAY['FI23']::text[], '藍箱1-4', NULL,
    0
  ),
(
    'boat-parts-latest-row-12', 12, '轉向系統', 'SH91610B',
    '方向機連結座', NULL, 1, 1,
    0, 'ALL BOAT', 51.5,
    ARRAY['ALL']::text[], '藍箱1-4', NULL,
    0
  ),
(
    'boat-parts-latest-row-13', 13, '轉向系統', '90545',
    '舵線g21', NULL, 1, 1,
    0, 'Nautique', 157,
    ARRAY['G21']::text[], '黑架右頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-14', 14, '轉向系統', '303039',
    '舵線fi23', NULL, 1, 0,
    0, 'CENTURION', 114,
    ARRAY['FI23']::text[], '黑架右頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-15', 15, '轉向系統', '200430',
    'g23舵線', NULL, 1, 1,
    0, 'Nautique', 114,
    ARRAY['G23']::text[], '黑架右頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-16', 16, '造浪系統', '302345',
    '黑豹中央浪板馬達', NULL, 1, 1,
    2, 'CENTURION', 265,
    ARRAY['FI23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-17', 17, '造浪系統', '301894',
    '黑豹兩側壓浪板馬達', NULL, 3, 2,
    2, 'CENTURION', 324,
    ARRAY['FI23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-18', 18, '造浪系統', '5302',
    'G21中央馬達', NULL, 2, 2,
    1, 'Nautique', 375,
    ARRAY['G21']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-19', 19, '造浪系統', '5502',
    'G21左右馬達', NULL, 1, 2,
    1, 'Nautique', 315,
    ARRAY['G21']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-20', 20, '造浪系統', '230148P',
    'g23造浪板　port', NULL, 1, 1,
    0, 'NAUTIQUE', 1683,
    ARRAY['G23']::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-21', 21, '造浪系統', '230148S',
    'g23造浪板 stb', NULL, 1, 1,
    0, 'NAUTIQUE', 1683,
    ARRAY['G23']::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-22', 22, '造浪系統', '230072',
    'g23中央馬達', NULL, 2, 2,
    0, 'Nautique', 645,
    ARRAY['G23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-23', 23, '造浪系統', '230073',
    'g23左右馬達', NULL, 4, 4,
    0, 'Nautique', 649,
    ARRAY['G23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-24', 24, '水路與壓艙', '160141',
    '21水袋 右後', NULL, 1, 1,
    0, 'NAUTIQUE', 583.58,
    ARRAY['G21']::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-25', 25, '水路與壓艙', '160140',
    '21水袋 左後', NULL, 1, 1,
    0, 'NAUTIQUE', 583.58,
    ARRAY['G21']::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-26', 26, '水路與壓艙', '140358',
    '21水袋 前面', NULL, 1, 1,
    0, 'NAUTIQUE', 500,
    ARRAY['G21']::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-27', 27, '水路與壓艙', NULL,
    '黑豹PNP水袋REAR', NULL, 1, 1,
    0, 'CENTURION', 258.25,
    ARRAY['FI23']::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-28', 28, '水路與壓艙', 'W067-WF',
    '黑豹PNP水袋船頭', NULL, 1, 1,
    0, 'CENTURION', 358.65,
    ARRAY['FI23']::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-29', 29, '水路與壓艙', NULL,
    '黑豹船尾長條水袋', NULL, 2, 2,
    0, 'CENTURION', NULL,
    ARRAY['FI23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-30', 30, NULL, NULL,
    'G23水袋', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], '橡皮艇工廠', NULL,
    0
  ),
(
    'boat-parts-latest-row-31', 31, '水路與壓艙', '302247',
    'ram fill 閥門', NULL, 6, 6,
    3, 'CENTURION', 200.5,
    ARRAY['FI23']::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-32', 32, '水路與壓艙', '190157',
    '壓水pump', NULL, 1, 3,
    2, 'NAUTIQUE', 200,
    ARRAY['G21', 'G23']::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-33', 33, '水路與壓艙', '301890',
    '黑豹壓水PUMP', NULL, 4, 6,
    3, 'CENTURION', NULL,
    ARRAY['FI23']::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-34', 34, '水路與壓艙', '5510',
    '21壓水PUMP葉輪', '粉紅', 4, 4,
    3, 'NAUTIQUE', 36,
    ARRAY['G21']::text[], '藍箱2-4', NULL,
    0
  ),
(
    'boat-parts-latest-row-35', 35, '水路與壓艙', NULL,
    '壓水PUMP葉輪', '綠', 2, 2,
    2, NULL, NULL,
    '{}'::text[], '藍箱2-4', NULL,
    0
  ),
(
    'boat-parts-latest-row-36', 36, '水路與壓艙', '302085',
    'fi23水袋轉接頭(直)', NULL, 5, 5,
    3, 'CENTURION', 9,
    ARRAY['FI23']::text[], '藍箱2-4', NULL,
    0
  ),
(
    'boat-parts-latest-row-37', 37, '水路與壓艙', '302086',
    'fi23水袋轉接頭(L)', NULL, 5, 5,
    3, 'CENTURION', 9,
    ARRAY['FI23']::text[], '藍箱2-4', NULL,
    0
  ),
(
    'boat-parts-latest-row-38', 38, '水路與壓艙', '200338',
    '水袋壓力感知器', NULL, 0, 1,
    0, 'NAUTIQUE', 191,
    ARRAY['G21', 'G23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-39', 39, '傳動與大軸', '180301',
    '傳動軸', '整新', 1, 1,
    0, 'NAUTIQUE', 740,
    ARRAY['ALL']::text[], '黑架最右邊', NULL,
    0
  ),
(
    'boat-parts-latest-row-40', 40, '傳動與大軸', '180301',
    '傳動軸', '全新', 1, 1,
    0, NULL, NULL,
    '{}'::text[], '黑架最右邊', NULL,
    0
  ),
(
    'boat-parts-latest-row-41', 41, '傳動與大軸', '130145',
    '21 A架', NULL, 1, 1,
    0, 'NAUTIQUE', 437,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-42', 42, '傳動與大軸', '130460',
    '飛機杯', NULL, 4, 10,
    6, 'NAUTIQUE', 139,
    ARRAY['G21', 'FI23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-43', 43, '傳動與大軸', 'E00500',
    'g21黑豹A架軸套', NULL, 4, 4,
    2, 'CENTURION', NULL,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-44', 44, '傳動與大軸', '5828',
    'G23 A架軸套', NULL, 6, 6,
    4, 'NAUTIQUE', 80,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-45', 45, '傳動與大軸', 'skcz1858',
    'Fi23大軸A架', NULL, 1, 1,
    0, 'CENTURION', 258.03,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-46', 46, '傳動與大軸', '130464',
    '傳動軸鐵環(防脫)', NULL, 2, 2,
    1, 'NAUTIQUE', 18,
    ARRAY['G21', 'FI23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-47', 47, '船體五金', NULL,
    '黑豹羊角全新', NULL, 2, 2,
    1, 'CENTURION', NULL,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-48', 48, '電氣設備', NULL,
    'G23 LIGHT CONTROL BOX', NULL, 1, 1,
    0, 'NAUTIQUE', NULL,
    ARRAY['G23']::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-49', 49, '電氣設備', '130451',
    '21氣氛燈', NULL, 9, 9,
    8, 'NAUTIQUE', 7,
    ARRAY['G21']::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-50', 50, '電氣設備', '160060',
    '21儀表控制轉盤', NULL, 1, 1,
    0, 'NAUTIQUE', 222.54,
    ARRAY['G21']::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-51', 51, '電氣設備', '160347',
    '總電源開關(3段)', NULL, 3, 3,
    1, 'NAUTIQUE', 46,
    ARRAY['ALL']::text[], '藍箱4-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-52', 52, '電氣設備', NULL,
    '總電源開關(2段)', NULL, 1, 1,
    0, 'NAUTIQUE', 55,
    '{}'::text[], '藍箱4-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-53', 53, '電氣設備', '150101',
    'nautique空檔開關', NULL, 2, 2,
    1, 'NAUTIQUE', 55,
    '{}'::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-54', 54, '電氣設備', '3997',
    '21排氣風扇', NULL, 2, 4,
    2, 'NAUTIQUE', 26,
    ARRAY['G21']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-55', 55, '電氣設備', NULL,
    'G系列 油門總成', NULL, 1, 1,
    0, 'NAUTIQUE', 530,
    '{}'::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-56', 56, '電氣設備', NULL,
    'g23儀表螢幕總成', NULL, 1, 1,
    0, 'NAUTIQUE', 2785,
    '{}'::text[], '黑架右頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-57', 57, '電氣設備', NULL,
    'ECM', '二手堪用', 1, 1,
    0, 'ALL BOAT', NULL,
    '{}'::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-58', 58, '電氣設備', '120046',
    'PDM', '全新', 4, 2,
    0, 'ALL BOAT', 665,
    ARRAY['ALL']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-59', 59, '電氣設備', '7793c',
    '鼓風機', NULL, 1, 1,
    0, 'ALL BOAT', NULL,
    '{}'::text[], '黑架左上頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-60', 60, '船體五金', '8531',
    '排氣管大橡膠管', NULL, 1, 1,
    0, 'NAUTIQUE', NULL,
    '{}'::text[], '黑架左頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-61', 61, '船體五金', '170521',
    '排氣管尾桶FRP硬管', NULL, 1, 1,
    0, 'NAUTIQUE', 237,
    '{}'::text[], '黑架左頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-62', 62, '船體五金', NULL,
    '油壓桿', '待分規格', 9, 9,
    0, 'NAUTIQUE', NULL,
    '{}'::text[], '黑架左中', '306 401 601 802',
    0
  ),
(
    'boat-parts-latest-row-63', 63, '船體五金', '70293',
    '球頭螺栓', '直式', 5, 5,
    2, 'NAUTIQUE', NULL,
    ARRAY['G21', 'G23']::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-64', 64, '船體五金', '3274',
    '船尾跳水板插銷', '銀色', 5, 5,
    2, 'NAUTIQUE', 15,
    ARRAY['G21', 'G23']::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-65', 65, '船體五金', '240881',
    '壓艙水閥門前扣頭', NULL, 11, 11,
    8, 'NAUTIQUE', NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-66', 66, '船體五金', '3737',
    '球頭螺栓', '三角型兩孔', 6, 6,
    0, 'NAUTIQUE', NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-67', 67, '船體五金', '302194',
    '船尾跳水板插銷', '黑色', 1, 1,
    4, 'CENTURION', NULL,
    ARRAY['FI23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-68', 68, '船體五金', '5396-01-01',
    '傳動軸鋅球 1.25', NULL, 4, 6,
    6, 'NAUTIQUE', NULL,
    ARRAY['G21', 'FI23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-69', 69, '船體五金', '5396-02-01',
    'G系列中央壓浪板鋅片', '單片大', 21, 23,
    6, 'NAUTIQUE', NULL,
    ARRAY['G21', 'FI23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-70', 70, '船體五金', '5396-03-01',
    '尾舵鋅片', '雙片夾鋅', 7, 9,
    8, 'NAUTIQUE', NULL,
    ARRAY['G21', 'FI23']::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-71', 71, '水路與壓艙', 'SP-15-BVACTUATOR',
    '21水袋自動閥配件', NULL, 1, 1,
    0, 'NAUTIQUE', 807.61,
    ARRAY['G21']::text[], '黑架左頂層', '缺馬達',
    0
  ),
(
    'boat-parts-latest-row-72', 72, '水路與壓艙', NULL,
    '21暖氣管配件', NULL, 1, 1,
    0, 'NAUTIQUE', NULL,
    ARRAY['G21']::text[], '黑架左頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-73', 73, NULL, NULL,
    '方向機油管', NULL, 3, 3,
    0, 'ALL BOAT', NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-74', 74, '傳動與大軸', '2158',
    '21尾舵軸心', NULL, 1, 1,
    0, 'NAUTIQUE', 169,
    '{}'::text[], '黑架中下', '2',
    0
  ),
(
    'boat-parts-latest-row-75', 75, '傳動與大軸', 'A-130008',
    '21尾舵', NULL, 2, 2,
    1, 'NAUTIQUE', 660,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-76', 76, '船體五金', '2277',
    'G系列中央Fin', NULL, 1, 1,
    0, NULL, NULL,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-77', 77, '保養耗材', 'RP080026',
    '汽油濾心', NULL, 9, 7,
    6, 'PCM', 58.8,
    ARRAY['G21', 'G23', 'FI23']::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-78', 78, '保養耗材', 'R193003A',
    '差速器油（v-drive)', NULL, 38, 37,
    12, 'PCM', 45,
    ARRAY['ALL']::text[], '工具區', NULL,
    0
  ),
(
    'boat-parts-latest-row-79', 79, '保養耗材', '308063',
    '變速箱油ATF Dexron III', NULL, 4, 2,
    12, 'motorex', NULL,
    '{}'::text[], '工具區', NULL,
    0
  ),
(
    'boat-parts-latest-row-80', 80, '保養耗材', 'RP061022',
    '水葉輪', NULL, 13, 13,
    6, 'PCM', 58.95,
    ARRAY['G21', 'G23', 'FI23']::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-81', 81, '保養耗材', 'R077001',
    '機油濾心', NULL, 60, 53,
    10, 'PCM', 5.55,
    ARRAY['G21', 'FI23']::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-82', 82, '引擎與冷卻', 'R026007',
    '節溫器 水龜', '金色大飛碟', 4, 4,
    6, 'PCM', 35.42,
    ARRAY['G21', 'FI23']::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-83', 83, '引擎與冷卻', 'R026009A',
    '排氣管小水龜節溫器', '金色小飛碟', 12, 12,
    6, 'PCM', 32.5,
    ARRAY['G21', 'FI23']::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-84', 84, '引擎與冷卻', 'RA026009',
    '排氣管節溫器外殼', '黑色塑膠殼', 2, 2,
    1, 'PCM', 81,
    ARRAY['G21', 'FI23']::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-85', 85, '引擎與冷卻', 'r047264',
    '水龜o ring', '待確認船型', 10, 10,
    8, 'PCM', NULL,
    '{}'::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-86', 86, '引擎與冷卻', 'r047256a',
    '咖啡色水龜o ring', '待確認船型', 10, 10,
    0, 'PCM', NULL,
    '{}'::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-87', 87, '引擎與冷卻', 'R047256',
    '節溫器(水龜) O ring', '待確認船型', 6, 6,
    5, 'PCM', 2.23,
    '{}'::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-88', 88, '引擎與冷卻', 'R047260',
    '小(水龜) O ring', '待確認船型', 18, 18,
    3, 'PCM', 2.23,
    '{}'::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-89', 89, '引擎與冷卻', '100271A',
    '濾水杯', NULL, 2, 2,
    1, 'NAUTIQUE', 22.53,
    ARRAY['G21', 'FI23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-90', 90, '引擎與冷卻', 'R090539A',
    '水葉底座', '舊款', 2, 2,
    1, 'PCM', NULL,
    '{}'::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-91', 91, '引擎與冷卻', 'RK057048B',
    '水葉輪座總成', NULL, 1, 1,
    0, 'PCM', 405.84,
    ARRAY['G23', 'FI23']::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-92', 92, '引擎與冷卻', 'RA134071',
    '水葉輪座軸心', NULL, 2, 2,
    1, 'PCM', 215,
    ARRAY['ALL']::text[], '黑架中下', NULL,
    0
  ),
(
    'boat-parts-latest-row-93', 93, '引擎與冷卻', 'R066040',
    '皮帶21', NULL, 6, 6,
    4, 'PCM', 41.35,
    ARRAY['G21']::text[], '黑架右上', '1',
    0
  ),
(
    'boat-parts-latest-row-94', 94, '引擎與冷卻', 'R066042',
    '皮帶FI23 g23', NULL, 10, 7,
    4, 'PCM', 30,
    ARRAY['FI23']::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-95', 95, '引擎與冷卻', 'RK068008',
    '皮帶張緊器 fi23 g23', '銀色', 2, 1,
    1, 'PCM', 52.52,
    ARRAY['FI23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-96', 96, '引擎與冷卻', 'RA068005A',
    '皮帶張緊器21', '全黑', 2, 2,
    1, 'PCM', 69.3,
    ARRAY['G21']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-97', 97, '引擎與冷卻', 'R065054',
    'g21舵輪20號', '有牙', 7, 7,
    1, 'PCM', 25,
    ARRAY['ALL']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-98', 98, '引擎與冷卻', 'R065040',
    'g21舵輪23號', '無牙', 7, 7,
    4, 'PCM', 15,
    ARRAY['G21']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-99', 99, '引擎與冷卻', 'R065063',
    'g21舵輪7號', '無牙但有燉', 5, 5,
    4, 'PCM', NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-100', 100, '引擎與冷卻', 'RM0303',
    '排氣管墊片(四孔)', NULL, 8, 8,
    4, 'PCM', 4.63,
    '{}'::text[], '藍箱3-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-101', 101, '引擎與冷卻', 'RM0304',
    '排氣管墊片(圓形)', NULL, 7, 7,
    6, 'PCM', 8.38,
    '{}'::text[], '藍箱3-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-102', 102, '引擎與冷卻', 'RM0306',
    '排氣管墊片(黃圈)', NULL, 4, 4,
    3, 'PCM', 2.76,
    '{}'::text[], '藍箱3-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-103', 103, '引擎與冷卻', '金屬FITTING',
    '1大包', NULL, 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-104', 104, '引擎與冷卻', 'R024239',
    '引擎墊片', NULL, 4, 4,
    2, 'PCM', 6.58,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-105', 105, '引擎與冷卻', 'RM0298',
    '引擎墊片', NULL, 1, 1,
    0, 'PCM', 43.2,
    '{}'::text[], '藍箱3-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-106', 106, '引擎與冷卻', 'RM0274A',
    '引擎墊片', NULL, 2, 2,
    1, 'PCM', 37.78,
    '{}'::text[], '藍箱3-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-107', 107, '引擎與冷卻', 'RM0312',
    '引擎墊片', NULL, 4, 4,
    1, 'PCM', 60.86,
    '{}'::text[], '藍箱3-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-108', 108, '引擎與冷卻', 'RM0002',
    '引擎墊片', NULL, 6, 6,
    4, 'PCM', 13.19,
    '{}'::text[], '藍箱3-1', '6',
    0
  ),
(
    'boat-parts-latest-row-109', 109, '引擎與冷卻', NULL,
    '螺絲配件一大包', NULL, 0, 0,
    0, 'PCM', NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-110', 110, '電氣設備', 'RA122009A',
    '起動馬達(整新品', '白色紙盒', 2, 2,
    1, 'PCM', 166,
    ARRAY['ALL']::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-111', 111, '電氣設備', 'RA122009B',
    '全新起動馬達', '白色紙盒', 1, 1,
    1, 'PCM', 161.55,
    ARRAY['ALL']::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-112', 112, '電氣設備', 'RA097009',
    '21發電機', '180度鎖點', 2, 2,
    1, 'PCM', 260.72,
    '{}'::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-113', 113, '電氣設備', 'RA097012',
    '黑豹發電機115amp', '咖啡色方形紙箱', 0, 0,
    1, 'PCM', 256.55,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-114', 114, '電氣設備', 'RA097013',
    'G23發電機', '90度鎖點', 1, 1,
    1, 'PCM', 235,
    '{}'::text[], '黑架右中', NULL,
    0
  ),
(
    'boat-parts-latest-row-115', 115, '電氣設備', 'R020063',
    '進氣溫度SENSOR', '白色', 4, 4,
    3, 'PCM', 18.47,
    ARRAY['G21', 'FI23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-116', 116, '電氣設備', 'R020055',
    'Map大氣壓力感知器', NULL, 0, 0,
    2, 'PCM', 115,
    ARRAY['ALL']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-117', 117, '電氣設備', 'R020051',
    '含氧感知器(轉角)', '小插頭', 4, 4,
    2, 'PCM', 40.41,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-118', 118, '電氣設備', 'R020056',
    '含氧感知器(觸媒前)', '大插頭', 4, 4,
    2, 'PCM', 146.81,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-119', 119, '電氣設備', 'R117015',
    '點火考爾coil', NULL, 7, 7,
    4, 'PCM', 162,
    ARRAY['ALL']::text[], '藍箱3-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-120', 120, '電氣設備', 'R020064',
    '排氣管溫度感知器', '銀色金屬頭', 5, 5,
    4, 'PCM', 47.57,
    ARRAY['G21', 'FI23']::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-121', 121, '電氣設備', 'R020071',
    '水箱水位SENSOR', '黑藍插頭', 2, 2,
    2, 'PCM', 11,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-122', 122, '電氣設備', 'R020052',
    '爆震knock sensor', NULL, 4, 4,
    3, 'PCM', 15,
    '{}'::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-123', 123, '電氣設備', '200832',
    '水葉輪船速SENSOR', '3線', 5, 5,
    1, 'CENTURION', 105,
    '{}'::text[], '藍箱2-3', '0',
    0
  ),
(
    'boat-parts-latest-row-124', 124, '電氣設備', '200832',
    '水葉輪船速SENSOR', '4線', 0, 0,
    0, 'NAUTIQUE', NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-125', 125, '電氣設備', 'GLS-001',
    '油量高度感知器', NULL, 0, 0,
    0, 'NAUTIQUE', NULL,
    '{}'::text[], '黑架左上', NULL,
    0
  ),
(
    'boat-parts-latest-row-126', 126, '電氣設備', '5836',
    '油量高度感知器', 'g23用', 0, 0,
    0, 'NAUTIQUE', NULL,
    ARRAY['G23']::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-127', 127, '電氣設備', 'RP030013',
    '火星塞', '長', 20, 20,
    8, 'PCM', 0,
    ARRAY['ALL']::text[], '藍箱2-1', '多五顆',
    0
  ),
(
    'boat-parts-latest-row-128', 128, '電氣設備', 'RP030011',
    '火星塞', '短', 16, 16,
    8, 'PCM', NULL,
    '{}'::text[], '藍箱2-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-129', 129, '電氣設備', 'rk120026',
    '點火線圈組', NULL, 1, 1,
    0, 'PCM', 100,
    ARRAY['ALL']::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-130', 130, '電氣設備', 'rk120026',
    '點火線圈組', '只有單邊1357', 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-131', 131, '電氣設備', NULL,
    'g21引擎電腦線組(舊)', NULL, 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], '黑架右頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-132', 132, '電氣設備', 'RK121122',
    '全新g21引擎電腦線組', NULL, 0, 0,
    1, 'PCM', 810,
    ARRAY['G21']::text[], '黑架右頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-133', 133, '電氣設備', 'RA121132B',
    '全新g23/fi23 引擎電線組', NULL, 1, 1,
    1, 'PCM', 805,
    ARRAY['G23', 'FI23']::text[], '黑架右頂層', NULL,
    0
  ),
(
    'boat-parts-latest-row-134', 134, '引擎與冷卻', 'R146003',
    '23水箱 含蓋子', '大', 2, 2,
    1, 'PCM', 35,
    '{}'::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-135', 135, '引擎與冷卻', 'R146001',
    '21水箱 不含蓋子', '小', 1, 1,
    0, 'PCM', 40.69,
    '{}'::text[], '黑架右上', NULL,
    0
  ),
(
    'boat-parts-latest-row-136', 136, '引擎與冷卻', 'R034045',
    '水箱蓋', NULL, 4, 4,
    2, 'PCM', 13,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-137', 137, '引擎與冷卻', 'RA133006',
    '排氣管 轉角', NULL, 1, 1,
    0, 'PCM', 443.4,
    '{}'::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-138', 138, '引擎與冷卻', 'RA133007',
    '排氣管 轉角', NULL, 1, 1,
    0, 'PCM', 443.4,
    '{}'::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-139', 139, '引擎與冷卻', 'RA028033',
    '排氣管 四孔單邊', NULL, 1, 1,
    0, 'PCM', 502,
    '{}'::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-140', 140, '引擎與冷卻', 'RA028032',
    '排氣管 四孔單邊', NULL, 1, 1,
    0, 'PCM', 502,
    '{}'::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-141', 141, '傳動與大軸', 'RA157025E',
    '變速箱g21 fi23', '整新(黃色）', 2, 2,
    1, 'PCM', 2113,
    ARRAY['G21', 'FI23']::text[], '黑架左下', '0',
    0
  ),
(
    'boat-parts-latest-row-142', 142, '傳動與大軸', 'RA157032E',
    '變速箱g23', '全新', 1, 1,
    0, 'PCM', 3955,
    ARRAY['G23']::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-143', 143, '傳動與大軸', 'R142015E',
    '變速箱飛輪護蓋(銀', NULL, 1, 1,
    0, 'PCM', 202.02,
    ARRAY['ALL']::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-144', 144, '傳動與大軸', 'R140024',
    '變速箱減震盤', NULL, 2, 2,
    1, 'PCM', 209.75,
    ARRAY['ALL']::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-145', 145, '傳動與大軸', 'RA156017',
    'g23差速器', '全新', 1, 1,
    0, 'PCM', 2957,
    '{}'::text[], '黑架左下', NULL,
    0
  ),
(
    'boat-parts-latest-row-146', 146, '傳動與大軸', 'ra156012',
    'g21 fi23差速器', '整新', 1, 1,
    0, 'PCM', 3207,
    '{}'::text[], NULL, '0',
    0
  ),
(
    'boat-parts-latest-row-147', 147, '引擎與冷卻', 'R147006',
    '21變速箱交換器', NULL, 1, 1,
    1, 'PCM', 130,
    '{}'::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-148', 148, '引擎與冷卻', 'R147049',
    '21機油交換器', NULL, 1, 1,
    1, 'PCM', 127.24,
    '{}'::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-149', 149, '引擎與冷卻', 'RA147058A',
    '21引擎交換器', NULL, 1, 1,
    1, 'PCM', 835.76,
    '{}'::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-150', 150, '引擎與冷卻', 'R147061',
    'g23 Fi23 機油交換器', NULL, 5, 5,
    1, 'PCM', 372.83,
    '{}'::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-151', 151, '引擎與冷卻', 'RA147062',
    'G23 Fi23引擎交換器', NULL, 1, 1,
    1, 'PCM', 755.67,
    '{}'::text[], '黑架中中', '0',
    0
  ),
(
    'boat-parts-latest-row-152', 152, '引擎與冷卻', 'R147069',
    'G23機油冷卻交換器', NULL, 0, 0,
    1, 'PCM', 497,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-153', 153, '引擎與冷卻', 'RA057041',
    'G21內循環水幫補', NULL, 0, 0,
    1, 'PCM', 81.94,
    '{}'::text[], '黑架上層', NULL,
    0
  ),
(
    'boat-parts-latest-row-154', 154, '引擎與冷卻', 'RK057036',
    '內循環水幫浦G23 FI23', NULL, 1, 1,
    1, 'PCM', 313,
    '{}'::text[], '黑架上層', NULL,
    0
  ),
(
    'boat-parts-latest-row-155', 155, '電氣設備', 'R116026',
    'g21引擎電腦', '二手', 1, 1,
    0, 'PCM', 637.25,
    '{}'::text[], '藍箱1-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-156', 156, '引擎與冷卻', 'R025045B',
    '水龜碗公', NULL, 3, 3,
    2, 'PCM', 32,
    '{}'::text[], '藍箱2-2', NULL,
    0
  ),
(
    'boat-parts-latest-row-157', 157, '引擎與冷卻', 'RA080027A',
    '汽油幫補（高壓）', NULL, 2, 1,
    1, 'PCM', 129.85,
    '{}'::text[], '藍箱4-2', NULL,
    0
  ),
(
    'boat-parts-latest-row-158', 158, '引擎與冷卻', 'RA080036A',
    '汽油幫浦（低壓）', NULL, 2, 1,
    1, 'PCM', 154.58,
    '{}'::text[], '藍箱4-2', NULL,
    0
  ),
(
    'boat-parts-latest-row-159', 159, '引擎與冷卻', 'R088005',
    'FCC汽油調壓閥', NULL, 2, 2,
    1, 'PCM', 12,
    '{}'::text[], '藍箱4-2', NULL,
    0
  ),
(
    'boat-parts-latest-row-160', 160, '引擎與冷卻', 'RA085106',
    'FCC高壓油管', NULL, 3, 3,
    2, 'PCM', 74,
    '{}'::text[], '藍箱4-2', '1',
    0
  ),
(
    'boat-parts-latest-row-161', 161, '引擎與冷卻', NULL,
    'FCC外殼總成', NULL, 2, 2,
    1, 'PCM', 85,
    '{}'::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-162', 162, '船體五金', 'RS2180',
    'Washer', NULL, 20, 20,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-163', 163, '船體五金', 'R128004',
    '小橡膠套', NULL, 2, 2,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-164', 164, '船體五金', 'RS0256',
    '六角平頭螺絲', NULL, 20, 20,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-165', 165, '船體五金', 'RS0302',
    '六角平頭螺絲', NULL, 20, 20,
    0, 'PCM', NULL,
    '{}'::text[], '黑架left middle', NULL,
    0
  ),
(
    'boat-parts-latest-row-166', 166, '船體五金', 'R024274',
    'Fitting tee', NULL, 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-167', 167, '船體五金', 'R092011',
    'g21引擎腳（前面）', NULL, 2, 2,
    1, 'PCM', 66,
    '{}'::text[], '藍箱4-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-168', 168, '船體五金', 'R094017',
    '引擎腳橡皮（後面）', NULL, 12, 12,
    4, 'PCM', 9,
    '{}'::text[], '藍箱4-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-169', 169, '船體五金', 'R094007',
    '引擎腳橡皮（前面）', NULL, 12, 12,
    4, 'PCM', 14,
    '{}'::text[], '藍箱4-3', NULL,
    0
  ),
(
    'boat-parts-latest-row-170', 170, '船體五金', 'RS1028',
    '螺帽', NULL, 20, 20,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-171', 171, '船體五金', 'RS2058',
    '螺帽', NULL, 20, 20,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-172', 172, '船體五金', 'R090289',
    '金屬接片bracket alt strap', NULL, 5, 5,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-173', 173, '船體五金', 'R090404',
    'L型金屬接片 bracket oil cooler', NULL, 2, 2,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-174', 174, '船體五金', 'R042021',
    'Lifting eye', NULL, 4, 4,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-175', 175, '船體五金', 'R024010',
    'L型金屬管線接頭（金）', NULL, 4, 4,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-176', 176, '船體五金', 'R024268',
    'L型塑膠管線接頭（黑）', NULL, 4, 4,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', '2',
    0
  ),
(
    'boat-parts-latest-row-177', 177, '船體五金', 'R090010',
    '金屬管線夾（黑）', NULL, 4, 4,
    0, 'PCM', NULL,
    '{}'::text[], '黑架中中', NULL,
    0
  ),
(
    'boat-parts-latest-row-178', 178, '船體五金', 'R047202',
    'O ring', NULL, 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-179', 179, '船體五金', 'R047245',
    'O ring (極小', NULL, 4, 4,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-180', 180, '船體五金', 'R047240',
    'O ring', NULL, 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-181', 181, '保養耗材', 'R077019',
    '油水分離濾心', NULL, 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-182', 182, '船體五金', 'RM0276',
    '墊片', NULL, 1, 1,
    0, 'PCM', NULL,
    '{}'::text[], '黑架左中', NULL,
    0
  ),
(
    'boat-parts-latest-row-183', 183, '其他', 'Ｒ024268',
    '未知零件', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-184', 184, '其他', 'R041091',
    '差速汽油尺', NULL, 3, 3,
    1, NULL, NULL,
    '{}'::text[], '藍箱1-1', NULL,
    0
  ),
(
    'boat-parts-latest-row-185', 185, '船體五金', 'r069078',
    '藍色塑膠止水塞', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-186', 186, '引擎與冷卻', 'rm0275',
    '藍邊緣型墊片', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-187', 187, '引擎與冷卻', 'rm0258a',
    '未知墊片', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-188', 188, NULL, NULL,
    '機油冷卻系統以下一箱', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-189', 189, NULL, 'R127087C',
    '未命名零件（第 189 列）', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-190', 190, NULL, '98222025',
    '未命名零件（第 190 列）', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-191', 191, NULL, 'R024200',
    '未命名零件（第 191 列）', NULL, 3, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-192', 192, NULL, '98332025',
    '未命名零件（第 192 列）', NULL, 20, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-193', 193, NULL, 'R024213',
    '未命名零件（第 193 列）', NULL, 3, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-194', 194, NULL, '98337020',
    '未命名零件（第 194 列）', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-195', 195, NULL, 'R024017',
    '未命名零件（第 195 列）', NULL, 3, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-196', 196, NULL, '98225016',
    '未命名零件（第 196 列）', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-197', 197, NULL, 'R079075',
    '未命名零件（第 197 列）', NULL, 2, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-198', 198, NULL, 'R024184',
    '未命名零件（第 198 列）', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-199', 199, NULL, 'R034051',
    '未命名零件（第 199 列）', NULL, 2, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-200', 200, NULL, 'R047245',
    '未命名零件（第 200 列）', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-201', 201, NULL, 'R024203',
    '未命名零件（第 201 列）', NULL, 4, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-202', 202, NULL, 'R47202',
    '未命名零件（第 202 列）', NULL, 6, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-203', 203, NULL, 'R127065',
    '未命名零件（第 203 列）', NULL, 3, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-204', 204, NULL, 'R024066A',
    '未命名零件（第 204 列）', NULL, 6, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-205', 205, NULL, 'R127087K',
    '未命名零件（第 205 列）', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-206', 206, NULL, 'R190123',
    '未命名零件（第 206 列）', NULL, 3, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-207', 207, NULL, NULL,
    '系長黑橡膠管', NULL, 1, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-208', 208, NULL, 'r045230',
    '短ｌ橡膠管', NULL, 3, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-209', 209, NULL, 'ra04521c',
    '未命名零件（第 209 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-210', 210, NULL, 'ra045120h',
    '未命名零件（第 210 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-211', 211, NULL, 'ra045120i',
    '未命名零件（第 211 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-212', 212, NULL, NULL,
    '銀色ｓ行管　機油尺放置處', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-213', 213, NULL, 'r014109',
    '未命名零件（第 213 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-214', 214, NULL, 'r094056',
    '未命名零件（第 214 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-215', 215, NULL, 'r024273',
    '未命名零件（第 215 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-216', 216, NULL, 'r034052',
    '未命名零件（第 216 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-217', 217, NULL, 'rs3866',
    '未命名零件（第 217 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-218', 218, NULL, 'r047240',
    '未命名零件（第 218 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-219', 219, NULL, 'r079067',
    '未命名零件（第 219 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-220', 220, NULL, 'r024061',
    '未命名零件（第 220 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-221', 221, NULL, 'r79066',
    '未命名零件（第 221 列）', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-222', 222, NULL, NULL,
    '銅質閥門類', NULL, 0, 0,
    0, NULL, NULL,
    '{}'::text[], '黑架中頂', NULL,
    0
  ),
(
    'boat-parts-latest-row-223', 223, NULL, '150215',
    '大球閥', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-224', 224, NULL, '90523',
    '小球閥', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-225', 225, NULL, '210373B',
    '海底門底座＋水塞', '長', 0, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-226', 226, NULL, '200069',
    '引擎冷卻水進水口總成', NULL, 4, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-227', 227, NULL, '3430',
    '壓艙水進水口總成', NULL, 10, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  ),
(
    'boat-parts-latest-row-228', 228, NULL, NULL,
    '海底門水塞', '短', 1, 0,
    0, NULL, NULL,
    '{}'::text[], NULL, NULL,
    0
  )
ON CONFLICT (source_key) DO UPDATE SET
  source_row = EXCLUDED.source_row,
  category = EXCLUDED.category,
  part_no = EXCLUDED.part_no,
  name = EXCLUDED.name,
  appearance = EXCLUDED.appearance,
  initial_quantity = EXCLUDED.initial_quantity,
  current_quantity = EXCLUDED.current_quantity,
  safety_quantity = EXCLUDED.safety_quantity,
  brand = EXCLUDED.brand,
  unit_price = EXCLUDED.unit_price,
  compatible_boats = EXCLUDED.compatible_boats,
  storage_location = EXCLUDED.storage_location,
  notes = EXCLUDED.notes,
  pending_repair_quantity = EXCLUDED.pending_repair_quantity,
  is_active = true;

WITH movement_seed (
  source_key, part_source_key, movement_type, quantity, boat_code, note, moved_at
) AS (
  VALUES
(
    'boat-parts-latest-inbound-row-2', 'boat-parts-latest-row-42', 'inbound',
    6, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-3', 'boat-parts-latest-row-6', 'inbound',
    10, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-4', 'boat-parts-latest-row-32', 'inbound',
    2, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-5', 'boat-parts-latest-row-38', 'inbound',
    1, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-6', 'boat-parts-latest-row-54', 'inbound',
    2, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-7', 'boat-parts-latest-row-19', 'inbound',
    1, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-8', 'boat-parts-latest-row-68', 'inbound',
    2, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-9', 'boat-parts-latest-row-70', 'inbound',
    2, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-10', 'boat-parts-latest-row-69', 'inbound',
    2, NULL, NULL, '2026-06-14T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-12', 'boat-parts-latest-row-16', 'inbound',
    3, NULL, NULL, '2026-07-01T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-13', 'boat-parts-latest-row-33', 'inbound',
    2, NULL, NULL, '2026-07-01T12:00:00+08:00'
  ),
(
    'boat-parts-latest-inbound-row-14', 'boat-parts-latest-row-9', 'inbound',
    2, NULL, NULL, '2026-07-20T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-2', 'boat-parts-latest-row-81', 'outbound',
    -1, 'FI23', NULL, '2026-06-08T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-3', 'boat-parts-latest-row-81', 'outbound',
    -1, 'G23', NULL, '2026-06-08T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-4', 'boat-parts-latest-row-79', 'outbound',
    -1, 'FI23', NULL, '2026-06-08T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-5', 'boat-parts-latest-row-79', 'outbound',
    -1, 'G23', NULL, '2026-06-08T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-6', 'boat-parts-latest-row-78', 'outbound',
    -1, 'FI23', NULL, '2026-06-08T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-7', 'boat-parts-latest-row-2', 'outbound',
    -1, 'FI23', NULL, '2026-06-10T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-8', 'boat-parts-latest-row-16', 'outbound',
    -1, 'FI23', NULL, '2026-06-11T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-9', 'boat-parts-latest-row-58', 'outbound',
    -1, 'FI23', NULL, '2026-06-11T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-10', 'boat-parts-latest-row-94', 'outbound',
    -1, 'G23', NULL, '2026-06-11T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-11', 'boat-parts-latest-row-58', 'outbound',
    -1, 'G21', NULL, '2026-06-13T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-12', 'boat-parts-latest-row-81', 'outbound',
    -2, NULL, NULL, '2026-06-24T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-13', 'boat-parts-latest-row-17', 'outbound',
    -1, NULL, '威敏購買', '2026-07-17T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-14', 'boat-parts-latest-row-157', 'outbound',
    -1, NULL, NULL, '2026-07-18T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-15', 'boat-parts-latest-row-158', 'outbound',
    -1, NULL, NULL, '2026-07-18T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-16', 'boat-parts-latest-row-4', 'outbound',
    -1, 'G21', NULL, '2026-07-17T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-17', 'boat-parts-latest-row-95', 'outbound',
    -1, NULL, '文屁購買；未結', '2026-07-20T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-18', 'boat-parts-latest-row-94', 'outbound',
    -2, NULL, '文屁購買；未結', '2026-07-20T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-19', 'boat-parts-latest-row-16', 'outbound',
    -1, NULL, NULL, '2026-07-20T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-20', 'boat-parts-latest-row-7', 'outbound',
    -2, 'G21', NULL, '2026-07-20T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-21', 'boat-parts-latest-row-14', 'outbound',
    -1, 'FI23', '2026/7/24斷裂換新', '2026-07-24T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-22', 'boat-parts-latest-row-16', 'outbound',
    -1, 'FI23', NULL, '2026-07-24T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-23', 'boat-parts-latest-row-81', 'outbound',
    -3, NULL, NULL, '2026-07-24T12:00:00+08:00'
  ),
(
    'boat-parts-latest-outbound-row-24', 'boat-parts-latest-row-77', 'outbound',
    -2, 'FI23', NULL, '2026-07-24T12:00:00+08:00'
  )
)
INSERT INTO public.boat_part_movements (
  source_key, part_id, movement_type, quantity, boat_code, note, moved_at,
  created_by_email, affects_inventory
)
SELECT
  movement_seed.source_key,
  boat_parts.id,
  movement_seed.movement_type,
  movement_seed.quantity,
  movement_seed.boat_code,
  movement_seed.note,
  movement_seed.moved_at::timestamptz,
  'Excel 歷史匯入',
  false
FROM movement_seed
JOIN public.boat_parts
  ON boat_parts.source_key = movement_seed.part_source_key
ON CONFLICT (source_key) DO NOTHING;

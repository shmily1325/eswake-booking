# 🚀 部署檢查清單

**重要:** 你已經執行了資料庫 migration，現在**必須立即部署前端代碼**！

---

## ⚠️ 為什麼需要立即部署？

資料庫已更新，但前端代碼還沒部署。雖然大部分功能是向後相容的，但有以下風險：

### 風險 1: 缺少 cleanup_minutes（已修復）
**影響:** 重複預約功能
- ❌ 舊版本：`RepeatBookingDialog` 不會設定 `cleanup_minutes`
- ✅ 新版本：已加入 `cleanup_minutes: isSelectedBoatFacility ? 0 : 15`
- 📝 如果用戶在部署前使用重複預約功能，資料庫會使用預設值 15，對設施（彈簧床）可能不正確

### 風險 2: 扣款函數不一致
**影響:** 扣款處理功能
- ❌ 舊版本：使用多個步驟的扣款流程（沒有交易保護）
- ✅ 新版本：使用 `process_deduction_transaction` 函數（有交易保護）
- 📝 舊版本仍然能運作，但沒有交易保護的好處

### 風險 3: 手勢操作已移除
**影響:** DayView 頁面
- ❌ 舊版本：引用了 `useSwipeGesture` 和 `usePullToRefresh`（檔案已刪除）
- ✅ 新版本：已移除所有引用
- 📝 **如果不部署，DayView 會報錯！**

---

## ✅ 立即部署步驟

### 1. 確認所有變更已提交

```bash
git status
git add -A
git commit -m "修復: 會員搜尋競態條件、衝突檢查假設、扣款交易保護、移除手勢操作"
```

### 2. 推送到 GitHub

```bash
git push origin main
```

### 3. Vercel 會自動部署

- 檢查 Vercel Dashboard 確認部署狀態
- 等待部署完成（通常 2-3 分鐘）

### 4. 驗證部署

訪問你的網站，確認：
- ✅ DayView 頁面正常載入（不會報錯找不到 useSwipeGesture）
- ✅ 可以建立新預約
- ✅ 可以使用重複預約
- ✅ 扣款功能正常

---

## 🔍 部署後測試清單

### 高優先級測試（必須）

1. **預約建立**
   - [ ] 建立一般船隻預約
   - [ ] 建立設施（彈簧床）預約
   - [ ] 檢查資料庫中 `cleanup_minutes` 是否正確（船隻 15，設施 0）

2. **重複預約**
   - [ ] 建立重複預約
   - [ ] 檢查資料庫中所有預約的 `cleanup_minutes` 是否正確

3. **扣款處理**
   - [ ] 處理一筆扣款（成功情況）
   - [ ] 檢查交易記錄是否正確
   - [ ] 檢查會員餘額是否正確

4. **DayView 頁面**
   - [ ] 確認頁面正常載入
   - [ ] 確認沒有 console 錯誤
   - [ ] 確認列表和時間軸視圖都正常

### 中優先級測試（建議）

5. **扣款回滾測試**
   - [ ] 故意製造錯誤情況（例如餘額不足）
   - [ ] 確認資料有正確回滾（沒有部分更新）

6. **衝突檢查**
   - [ ] 嘗試建立衝突的預約
   - [ ] 確認衝突訊息正確顯示清理時間

7. **會員搜尋**
   - [ ] 快速輸入測試（檢查下拉選單是否正常顯示/隱藏）

---

## 📊 監控重點

部署後的前 24 小時，注意：

### 1. Sentry 錯誤監控（如果有設定）
- 檢查是否有新的錯誤報告
- 特別注意 `useSwipeGesture` 或 `usePullToRefresh` 相關錯誤

### 2. 資料庫完整性
```sql
-- 檢查是否有 cleanup_minutes 為 NULL 的記錄
SELECT COUNT(*) FROM bookings WHERE cleanup_minutes IS NULL;
-- 應該是 0

-- 檢查設施的清理時間
SELECT b.id, bo.name, b.cleanup_minutes
FROM bookings b
JOIN boats bo ON b.boat_id = bo.id
WHERE bo.name LIKE '%彈簧床%'
ORDER BY b.created_at DESC
LIMIT 10;
-- 應該都是 0

-- 檢查船隻的清理時間
SELECT b.id, bo.name, b.cleanup_minutes
FROM bookings b
JOIN boats bo ON b.boat_id = bo.id
WHERE bo.name NOT LIKE '%彈簧床%'
ORDER BY b.created_at DESC
LIMIT 10;
-- 應該都是 15
```

### 3. 扣款功能
```sql
-- 檢查最近的扣款交易
SELECT 
  t.id,
  t.transaction_type,
  t.category,
  t.amount,
  t.balance_after,
  t.created_at,
  m.name as member_name
FROM transactions t
JOIN members m ON t.member_id = m.id
WHERE t.transaction_type = 'consume'
ORDER BY t.created_at DESC
LIMIT 20;
```

---

## 🆘 回滾計劃

如果部署後發現嚴重問題，可以快速回滾：

### 1. 前端回滾
在 Vercel Dashboard：
1. 進入 Deployments
2. 找到上一個穩定版本
3. 點擊 "Promote to Production"

### 2. 資料庫回滾（只有在必要時）

⚠️ **警告：** 資料庫回滾會丟失部署後的新資料！

```sql
-- 備份當前資料
CREATE TABLE bookings_backup AS SELECT * FROM bookings;

-- 移除 cleanup_minutes 欄位（不建議，除非有嚴重問題）
ALTER TABLE bookings DROP COLUMN cleanup_minutes;

-- 移除扣款函數（不建議，除非有嚴重問題）
DROP FUNCTION IF EXISTS process_deduction_transaction;
```

---

## 💡 向後相容性說明

為什麼部分功能可以延後部署？

### ✅ 安全延後
- **會員搜尋修復**: 舊版本雖然有 bug，但不會導致錯誤，只是偶爾顯示問題
- **扣款函數**: 舊版本會繼續用舊的多步驟方式，雖然沒有交易保護但還是能運作

### ⚠️ 不能延後
- **手勢操作移除**: 檔案已刪除，舊版本會報錯
- **cleanup_minutes**: 雖然有預設值，但重複預約可能不正確

---

## 📞 需要協助？

如果遇到問題：
1. 檢查 Vercel 部署日誌
2. 檢查瀏覽器 Console
3. 檢查 Sentry 錯誤報告（如果有設定）
4. 檢查資料庫日誌

---

**當前狀態:** ⚠️ 資料庫已更新，等待前端部署
**建議行動:** 🚀 立即部署前端代碼
**預計時間:** 5-10 分鐘


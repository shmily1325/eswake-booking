# ES Wake 離線備援工具

`offline.html` 是單一檔案、無外部套件依賴的緊急查詢工具。它用於網站短暫故障的
數小時內，透過 IndexedDB 載入完整 SQL 備份並暫時查詢必要營運資料；它不是完整的
離線管理後台。導覽名稱、入口位置與查詢流程維持線上系統的熟悉方式，僅移除實際
新增、修改與儲存能力。

## 使用方式

1. 從管理後台的備份頁下載「完整 SQL 備份」及 `eswake-offline.html`。
2. 建議先確認 SQL 檔案的 SHA-256。
3. 直接用目前版本的 Chrome、Edge 或 Firefox 開啟 HTML。
4. 點選「載入備份」，選擇完整 SQL 檔案。
5. 等待逐表筆數驗證完成後再開始查詢。

首頁會直接顯示備份時間；備份超過 24 小時會提出警告。若瀏覽器內的資料與驗證
紀錄不一致，工具會要求重新載入完整備份。

匯入過程會先建立暫存 IndexedDB。只有 manifest 格式、必要資料表及每張資料表
筆數全部正確，才會切換為目前使用中的資料庫；驗證失敗會保留上一份有效備份。

## 可用功能

- 今日預約與日期式預約清單
- 依預約人查詢預約
- 明日會員及教練提醒
- 會員、交易、置板與 LINE 綁定資料
- 商品庫存、全部商品訂單及結帳紀錄
- 公告、預約限制、人員與帳號快照、船隻狀態及停用日期
- 編輯記錄與匯入當下的備份紀錄

所有備份資料皆為唯讀。離線工具不提供新增、修改或自動同步功能。
技術性原始資料表仍會完整匯入供備援驗證，但不會作為一般使用者的頁面入口。

## 資料範圍

離線工具會匯入 `src/server/backup-config.ts` 的全部 `BACKUP_TABLES`，並依 manifest
逐表核對筆數。`user_click_events` 是非營運分析資料，刻意不包含在備份內。

商品圖片屬於 Storage 備份，不會嵌入 SQL 或離線 HTML；商品及訂單文字資料仍可查閱。

## 安全注意事項

- SQL 備份含會員、電話、帳務與營運資料，請保存在受控裝置。
- 資料只保存在開啟工具的瀏覽器，不會自動同步。
- 清除瀏覽器網站資料會移除已匯入的 IndexedDB。
- 此工具不是可直接還原 PostgreSQL 的替代品；正式還原仍依 `docs/BACKUP_RUNBOOK.md`。

## 維護

備份格式、資料表或線上顯示規則變更時，需同步更新：

- `src/server/backup-config.ts`
- `offline.html`
- `src/__tests__/offlineArtifact.test.ts`
- `src/__tests__/offlineImport.test.ts`

執行：

```bash
npm test -- --run src/__tests__/offlineArtifact.test.ts src/__tests__/offlineImport.test.ts
```

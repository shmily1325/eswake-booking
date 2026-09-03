# LINE 與 LIFF 設定指南

## 現行功能

- `/liff`：會員專區。必須以電話與生日完成正式會員綁定。
- `/liff/book`：LINE 內的線上預約。
- `/api/line-webhook`：被動收集加好友、訊息與 Rich Menu 互動者，供員工手動建立「提醒專用配對」。
- `/tomorrow`：員工人工檢查並傳送明日提醒；目前沒有自動提醒 Cron。

提醒專用配對不會寫入 `line_bindings`，也不會讓非會員取得會員專區權限。

## LINE Developers

Messaging API Channel 與 LIFF 所在的 LINE Login Channel 應位於同一個 Provider。LINE user ID 在不同 Provider 之間不相同。

Messaging API 設定：

1. 發行長效 Channel access token。
2. 複製 Basic settings 內的 Channel secret。
3. Webhook URL 設為：

   ```text
   https://<正式網域>/api/line-webhook
   ```

4. 開啟 Use webhook，按 Verify 確認回應成功。
5. Rich Menu「芝麻開門」動作必須是 `message` 或 `postback`；一般網址不會產生可收集 user ID 的 webhook。

未認證官方帳號無法批次取得既有好友 user ID。只有啟用 webhook 後的新 `follow`、`message` 或 `postback` 事件會被收集。

## Vercel 環境變數

以下機密只可存入 Vercel，不可提交到 Git、聊天或截圖：

| 變數 | 用途 |
|---|---|
| `LINE_CHANNEL_SECRET` | 驗證 `/api/line-webhook` 的 `x-line-signature` |
| `LINE_CHANNEL_ACCESS_TOKEN` | 讀取 LINE Profile 及傳送提醒 |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook 與員工 API 的 server-only 資料庫權限 |
| `SUPABASE_URL` 或 `VITE_SUPABASE_URL` | Supabase 專案 URL |
| `LINE_LIFF_ALLOWED_CHANNEL_IDS` | 允許會員 API 的 Channel ID，逗號分隔 |
| `LINE_PUSH_LIFF_CHANNEL_IDS` | 與 Messaging API 同 Provider、可推播的 LIFF Channel ID |
| `VITE_LIFF_ID` | 會員專區 LIFF ID |
| `VITE_LIFF_BOOK_ID` | 線上預約 LIFF ID |

新增或修改後必須重新部署。

## 資料庫

依 migration 順序執行。LINE 提醒聯絡人功能由：

```text
migrations/203_restore_line_reminder_contacts.sql
migrations/204_bind_line_reminders_to_bookings.sql
migrations/205_clear_guest_line_mapping_on_booking_identity_change.sql
```

建立。三張資料表皆強制 RLS，只有 server-side `service_role` 可讀寫：

- `line_webhook_contacts`
- `line_webhook_events`
- `line_reminder_mappings`

請勿將 service role key 放到 `VITE_*` 變數。

## 上線驗證

1. 部署 migration 與程式碼。
2. 在 LINE Developers 設定並 Verify webhook。
3. 用測試帳號加好友或按「芝麻開門」。
4. 到「LINE 配對 → 提醒配對」，確認出現 LINE 名稱、頭像與互動時間。
5. 分別測試：
   - 配對未正式綁定會員。
   - 配對有電話的非會員。
   - 配對沒有電話的非會員；明日提醒頁必須再次確認姓名候選。
   - 同一 LINE 帳號對應多人時只收到一則整合訊息。
   - 封鎖官方帳號後不再列為可推播。

## 日常操作

1. 客人加好友、傳訊息或按 Rich Menu；系統背景收集 user ID，不要求客人綁定。
2. 員工在「LINE 配對 → 提醒配對」選擇已建檔會員，或替新客選擇一筆預約。
3. 明日提醒依序使用：
   - 正式會員綁定
   - 會員提醒配對
   - 新客預約配對
4. 找不到候選者維持複製訊息人工傳送。

若編輯預約並更換預約人姓名或主要會員，該預約的新客提醒配對會自動解除，
避免將提醒傳送給原本的預約人。只修改時間、船隻或教練不會解除配對。

## 故障排除

- Webhook Verify 失敗：確認 URL、`LINE_CHANNEL_SECRET` 及 Vercel logs。簽章必須使用未解析的原始 request body。
- 有互動但後台沒有聯絡人：確認 Use webhook 已開啟、事件來源是個人聊天室，且 migration 203 已執行。
- 聯絡人顯示「資格待確認」：重新加好友或互動；長期 push 應以好友狀態為準。
- 推播失敗：確認 Channel access token、好友／封鎖狀態與 Vercel logs。

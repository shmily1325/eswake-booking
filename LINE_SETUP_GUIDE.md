# LINE Bot & LIFF 設置指南

## 📋 功能概述

1. **LIFF 查詢預約**：會員可透過 LINE 查看自己的預約
2. **LINE Webhook 綁定**：會員透過 LINE 聊天綁定帳號
3. **每日自動提醒**：每天 19:00 自動發送明日預約提醒

---

## 🚀 第一步：創建 LINE Bot

### 1. 前往 LINE Developers Console
https://developers.line.biz/console/

### 2. 創建 Provider（如果還沒有）
- 點擊 "Create a new provider"
- 輸入名稱（例如：ES Wake）

### 3. 創建 Messaging API Channel
- 點擊 "Create a Messaging API channel"
- 填寫資料：
  - **Channel name**: ES Wake 預約系統
  - **Channel description**: 查詢預約與自動提醒
  - **Category**: 選擇適合的類別（如：Sports & Recreation）
  - **Subcategory**: 選擇子類別
- 同意條款後點擊 "Create"

### 4. 設定 Channel
進入創建好的 Channel，進行以下設定：

#### Messaging API 設定
1. 滾動到 **Messaging API** 區塊
2. 點擊 **Channel access token** 的 "Issue" 按鈕
3. **複製這個 Token**（稍後要用）
4. 設定 **Webhook URL**:
   ```
   https://your-domain.vercel.app/api/line-webhook
   ```
5. 啟用 **Use webhook**: 打開開關
6. 關閉 **Auto-reply messages**: 關閉開關
7. 關閉 **Greeting messages**: 關閉開關

---

## 🔐 第二步：創建 LIFF App

### 1. 在同一個 Channel 中找到 LIFF 區塊
- 滾動到 **LIFF** 區塊
- 點擊 "Add" 按鈕

### 2. 填寫 LIFF 設定
- **LIFF app name**: 我的預約
- **Size**: Full
- **Endpoint URL**: 
  ```
  https://your-domain.vercel.app/liff
  ```
- **Scope**: 選擇 `profile`, `openid`
- **Bot link feature**: 選擇 "On (Normal)"

### 3. 複製 LIFF ID
創建完成後，會顯示 **LIFF ID**（格式：`1234567890-abcdefgh`）
**複製這個 LIFF ID**（稍後要用）

---

## ⚙️ 第三步：Vercel 環境變數設定

前往 Vercel 專案設定 → Environment Variables，添加以下變數：

### 必要變數

| 變數名稱 | 說明 | 範例 |
|---------|------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Channel Access Token | `eyJhbGc...` |
| `VITE_LIFF_ID` | LIFF App ID | `1234567890-abcdefgh` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（已有） | `eyJhbGc...` |
| `VITE_SUPABASE_URL` | Supabase URL（已有） | `https://xxx.supabase.co` |

### 設定步驟
1. 在 Vercel Dashboard 打開你的專案
2. 前往 **Settings** → **Environment Variables**
3. 依次添加上述變數
4. **重新部署**專案使變數生效

---

## 💾 第四步：資料庫初始化

在 Supabase SQL Editor 執行以下 SQL：

```sql
-- 確保 line_bindings 表存在
CREATE TABLE IF NOT EXISTS line_bindings (
  id SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  member_id UUID REFERENCES members(id),
  phone TEXT,
  status TEXT DEFAULT 'pending',
  verification_code TEXT,
  created_at TEXT,
  expires_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_line_bindings_member ON line_bindings(member_id);
CREATE INDEX IF NOT EXISTS idx_line_bindings_phone ON line_bindings(phone);

-- 啟用 RLS
ALTER TABLE line_bindings ENABLE ROW LEVEL SECURITY;

-- 允許認證用戶完全訪問
DROP POLICY IF EXISTS "Allow authenticated users full access to line_bindings" ON line_bindings;
CREATE POLICY "Allow authenticated users full access to line_bindings" 
  ON line_bindings FOR ALL 
  USING (auth.role() = 'authenticated');

-- 初始化系統設定
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('line_reminder_enabled', 'false', 'LINE 提醒功能開關'),
  ('line_webhook_enabled', 'false', 'LINE Webhook 開關（綁定功能）'),
  ('line_channel_access_token', '', 'LINE Channel Access Token'),
  ('line_reminder_time', '19:00', 'LINE 提醒發送時間')
ON CONFLICT (setting_key) DO NOTHING;
```

---

## 📱 第五步：設定 LIFF 路由

在 `src/App.tsx` 中添加 LIFF 路由：

```typescript
import { LiffMyBookings } from './pages/LiffMyBookings'

// 在 Routes 中添加
<Route path="/liff" element={<LiffMyBookings />} />
```

---

## 🧪 第六步：測試

### 測試 1：LIFF 查詢預約
1. 在 LINE Developers Console 找到你的 LIFF App
2. 複製 LIFF URL
3. 用手機 LINE 打開這個 URL
4. 應該會看到綁定畫面
5. 輸入已註冊的手機號碼進行綁定
6. 綁定成功後應該能看到自己的預約

### 測試 2：LINE Webhook 綁定
1. 掃描 LINE Bot 的 QR Code 加為好友
2. 在後台（BaoHub → LINE 提醒設置）啟用 "LINE Webhook"
3. 發送訊息：`綁定 0912345678`（你的手機號碼）
4. 應該會收到綁定成功的回覆

### 測試 3：測試提醒發送
1. 在後台啟用 "LINE 預約提醒"
2. 設定 Channel Access Token
3. 創建一個明天的預約
4. 手動觸發 API：
   ```bash
   curl https://your-domain.vercel.app/api/line-reminder
   ```
5. 已綁定的會員應該會收到提醒訊息

---

## 📊 第七步：在後台啟用功能

1. 登入系統
2. 前往 **BaoHub** → **📱 LINE 提醒設置**
3. 填寫 **LINE Channel Access Token**
4. 啟用 **LINE 預約提醒**
5. 設定提醒時間（預設 19:00）
6. 點擊 **💾 儲存設置**

---

## 🔄 Cron Job 說明

Vercel 會自動執行以下 Cron Jobs：

| 路徑 | 時間 | 說明 |
|-----|------|------|
| `/api/backup-to-drive` | 每天 19:20 | 資料備份 |
| `/api/line-reminder` | 每天 19:00 | 發送明日預約提醒 |

---

## 📝 使用說明（給會員）

### 方式一：透過 LIFF 查詢預約
1. 打開 LINE Bot 聊天室
2. 點擊下方選單的「我的預約」按鈕（需在 LINE Bot 設定 Rich Menu）
3. 首次使用需要綁定手機號碼
4. 綁定後即可查看所有預約

### 方式二：透過聊天綁定
1. 加 LINE Bot 為好友
2. 發送：`綁定 0912345678`（你的手機號碼）
3. 綁定成功後會自動收到每日提醒

---

## 🎨 Rich Menu 設定（選用）

在 LINE Developers Console 可以設定 Rich Menu：

**建議設定**：
- **按鈕 1**: 我的預約（連結到 LIFF URL）
- **按鈕 2**: 查詢綁定狀態（發送文字：`說明`）
- **按鈕 3**: 取消綁定（發送文字：`取消綁定`）

---

## 🔍 故障排除

### LIFF 無法載入
- 確認 `VITE_LIFF_ID` 環境變數正確
- 確認 LIFF Endpoint URL 設定正確
- 檢查瀏覽器 Console 是否有錯誤

### Webhook 沒有回應
- 確認 Webhook URL 設定正確
- 確認已啟用 "Use webhook"
- 檢查 Vercel Logs 是否有錯誤

### 提醒沒有發送
- 確認後台已啟用 LINE 提醒
- 確認 Channel Access Token 正確
- 檢查會員是否已綁定
- 檢查預約的 `booking_members` 是否正確

---

## 📞 支援

如有問題，請檢查：
1. Vercel Deployment Logs
2. Supabase Logs
3. LINE Developers Console Logs



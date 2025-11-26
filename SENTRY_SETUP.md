# 🔍 Sentry 錯誤監控設置指南

## ✅ 當前狀態

你的專案**已經完整配置好 Sentry**！代碼在 `src/main.tsx` 中。

## 🚀 如何啟動 Sentry

### 步驟 1：取得 Sentry DSN

1. 登入 [Sentry.io](https://sentry.io/)
2. 建立新專案（或使用現有專案）
   - 專案類型選擇：**React**
   - 專案名稱：`eswake-booking`
3. 建立後，複製 **DSN**（格式類似 `https://xxxxx@o123456.ingest.sentry.io/7890123`）

### 步驟 2：設定環境變數

#### 本地開發（測試用）

建立 `.env.local` 檔案：

```bash
# .env.local
VITE_SENTRY_DSN=https://你的dsn@o123456.ingest.sentry.io/7890123
```

**注意：** Sentry 在開發模式下**不會啟動**（為了不浪費配額），只在正式環境啟用。

#### Vercel 部署（正式環境）

1. 前往 Vercel 專案設定
2. 進入 **Settings** → **Environment Variables**
3. 新增變數：
   - **Name**: `VITE_SENTRY_DSN`
   - **Value**: `https://你的dsn@o123456.ingest.sentry.io/7890123`
   - **Environments**: 勾選 **Production**
4. 重新部署

### 步驟 3：測試 Sentry

#### 方法 1：在正式環境觸發錯誤

在任何組件中加入測試按鈕：

```tsx
<button onClick={() => {
  throw new Error('Sentry 測試錯誤')
}}>
  測試 Sentry
</button>
```

部署後點擊按鈕，錯誤會自動送到 Sentry。

#### 方法 2：用 Vercel Preview 測試

```bash
# 部署到 preview 環境（也會啟用 Sentry）
git push
```

Vercel 的 preview 環境也算是 production build，所以 Sentry 會啟動。

---

## 📊 Sentry 功能說明

### 當前配置

```typescript
// src/main.tsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // "production" 或 "preview"
  
  // 效能監控：只追蹤 10% 的請求（省配額）
  tracesSampleRate: 0.1,
  
  // 自動過濾不重要的錯誤：
  // ✅ 已過濾網路錯誤（使用者網路問題）
  // ✅ 已過濾取消的請求（AbortError）
  // ✅ 已過濾一般 console.log（只記錄 error）
})
```

### 錯誤邊界

使用者看到錯誤時會顯示友善的畫面：

```
😰
系統發生錯誤
很抱歉，系統遇到了一個問題

[重新整理] [返回首頁]
```

### 自動收集的資訊

Sentry 會自動記錄：
- ✅ 錯誤訊息和堆疊追蹤
- ✅ 使用者的瀏覽器和作業系統
- ✅ 發生錯誤的頁面 URL
- ✅ 使用者的操作歷程（breadcrumbs）
- ✅ 專案版本號（如果有設定）

---

## 🎯 手動追蹤錯誤

在程式碼中可以手動發送錯誤：

```typescript
import * as Sentry from '@sentry/react'

try {
  // 危險操作
  await riskyOperation()
} catch (error) {
  // 發送到 Sentry
  Sentry.captureException(error)
  
  // 附加額外資訊
  Sentry.captureException(error, {
    extra: {
      userId: user.id,
      action: '處理扣款',
      bookingId: 123
    }
  })
}
```

---

## 💡 最佳實踐

### 1. 設定使用者資訊

在登入後設定使用者資訊，方便追蹤：

```typescript
// 在 AuthContext.tsx 或 App.tsx 中
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.user_metadata?.name
})

// 登出時清除
Sentry.setUser(null)
```

### 2. 設定版本號

在 `package.json` 中：

```json
{
  "version": "1.0.0"
}
```

在 Sentry 配置中：

```typescript
Sentry.init({
  dsn: '...',
  release: `eswake-booking@${import.meta.env.VITE_APP_VERSION}`
})
```

在 `vite.config.ts` 中定義版本：

```typescript
import packageJson from './package.json'

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  }
})
```

### 3. 關鍵操作加入麵包屑

```typescript
// 在重要操作前記錄
Sentry.addBreadcrumb({
  category: 'deduction',
  message: '開始處理扣款',
  level: 'info',
  data: {
    memberId: member.id,
    amount: 10800
  }
})
```

---

## 🔍 查看錯誤

1. 登入 [Sentry.io](https://sentry.io/)
2. 進入你的專案
3. 查看 **Issues** 頁面
4. 點擊任何錯誤查看詳細資訊：
   - 錯誤堆疊
   - 使用者資訊
   - 操作歷程
   - 環境資訊

---

## ⚙️ 調整設定

### 提高效能追蹤比例（如果需要）

```typescript
// 預設是 10%，可以調高（但會消耗配額）
tracesSampleRate: 0.5, // 50%
```

### 關閉 Sentry（測試用）

```typescript
// 在 main.tsx 中暫時註解掉
// if (import.meta.env.PROD) {
//   Sentry.init({ ... })
// }
```

---

## ❓ 常見問題

### Q: 為什麼開發環境沒有啟動 Sentry？

A: 為了節省配額，只在 `import.meta.env.PROD` 為 `true` 時啟動（即 production build）。

### Q: 如何在開發環境測試？

A: 執行 production build：

```bash
npm run build
npm run preview
```

### Q: Sentry 免費版有限制嗎？

A: 有的，免費版每月有錯誤數量限制。已經設定 `tracesSampleRate: 0.1` 來節省配額。

### Q: 如何停用特定頁面的錯誤追蹤？

A: 在 `beforeSend` 中過濾：

```typescript
beforeSend(event) {
  // 不追蹤特定頁面的錯誤
  if (event.request?.url?.includes('/admin')) {
    return null
  }
  return event
}
```

---

## 📝 檢查清單

- [ ] 已在 Sentry.io 建立專案
- [ ] 已複製 DSN
- [ ] 已在 Vercel 設定環境變數 `VITE_SENTRY_DSN`
- [ ] 已重新部署到正式環境
- [ ] 已測試錯誤能正確送到 Sentry
- [ ] （選用）已設定使用者資訊追蹤
- [ ] （選用）已設定版本號

---

**總結：** 你的 Sentry 已經配置完成！只需要：
1. 在 Sentry.io 取得 DSN
2. 在 Vercel 設定環境變數
3. 重新部署

就可以開始追蹤錯誤了！🎉


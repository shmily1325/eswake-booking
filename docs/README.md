# 📚 ES Wake 預約系統 - 文檔中心

> 更新日期：2025-11-23

---

## 🎯 快速導航

### 核心文檔
- [**系統總覽**](#系統總覽) - 專案架構和技術棧
- [**最新改善報告**](./IMPROVEMENTS_SUMMARY.md) - 程式碼品質和 UI 改善完整記錄
- [**功能特性**](./features/) - 各功能模組說明

### 操作指南
- [**備份策略**](./BACKUP_STRATEGY.md) - 完整的資料備份方案
- [**備份快速開始**](./BACKUP_QUICK_START.md) - 5 分鐘上手備份功能

### 開發文檔
- [**測試指南**](./testing/) - 測試清單和工具
- [**CoachReport 架構**](./CoachReport-Architecture.md) - 教練回報系統設計

---

## 🏗️ 系統總覽

### 技術棧
- **前端框架**: React 18 + TypeScript
- **狀態管理**: React Hooks (useState, useEffect, custom hooks)
- **資料庫**: Supabase (PostgreSQL)
- **部署平台**: Vercel
- **UI 組件**: 自建組件庫 (Button, Card, Input 等)
- **樣式系統**: 統一設計系統 (designSystem.ts)

### 專案結構
```
eswake-booking/
├── src/
│   ├── components/        # 共用組件
│   │   └── ui/           # UI 組件庫 ✨ 新
│   ├── pages/            # 頁面組件
│   │   ├── admin/        # 管理員頁面
│   │   ├── coach/        # 教練頁面
│   │   └── member/       # 會員頁面
│   ├── hooks/            # 自定義 Hooks
│   │   ├── useAsyncOperation.ts  ✨ 新
│   │   └── useCrud.ts            ✨ 新
│   ├── utils/            # 工具函數
│   │   └── errorHandler.ts      ✨ 新
│   ├── types/            # TypeScript 類型
│   │   └── common.ts             ✨ 新
│   └── styles/           # 樣式和設計系統
│       └── designSystem.ts       ✨ 升級
├── docs/                 # 文檔
└── public/              # 靜態資源
```

---

## 🎉 最新改善 (2025-11-23)

### ✅ UI 組件庫建立
- 建立 7 個可復用組件 (Button, Card, Input, Select, Textarea, Badge, EmptyState)
- 完整手機版支援
- 減少 50-70% 重複代碼

### ✅ 程式碼品質提升
- 統一錯誤處理機制
- 建立 useAsyncOperation 和 useCrud hooks
- 完整 TypeScript 類型定義
- 零 linter 錯誤

### ✅ 頁面改善
- 遷移 7 個頁面到新 UI 組件系統
- 統一視覺風格
- 提升可維護性

詳細內容請參考 [**改善總結報告**](./IMPROVEMENTS_SUMMARY.md)

---

## 📖 功能模組

### 管理功能
- **預約管理** - 查看和管理所有預約
- **會員管理** - 會員資料和財務管理
- **船隻管理** - 船隻狀態和維修排程
- **人員管理** - 教練和駕駛員管理
- **置板區管理** - 板位分配和管理
- **權限管理** - 白名單和管理員管理
- **公告管理** - 系統公告發布
- **備份管理** - 資料備份和匯出

### 教練功能
- **教練回報** - 課程回報和學員管理
- **課表查看** - 個人課程安排

### 會員功能
- **儲值管理** - 查看和管理個人財務

---

## 🔧 開發指南

### 環境設定
```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build
```

### 使用 UI 組件
```tsx
import { Button, Card, Badge } from '../components/ui'

// 按鈕
<Button variant="primary" size="medium">確認</Button>

// 卡片
<Card variant="highlighted">內容</Card>

// 標籤
<Badge variant="success">啟用中</Badge>
```

---

## 📝 文檔說明

### 當前文檔結構
```
docs/
├── README.md                      # 📍 你在這裡
├── IMPROVEMENTS_SUMMARY.md        # 🎯 最新改善總結
├── BACKUP_STRATEGY.md             # 備份策略完整說明
├── BACKUP_QUICK_START.md          # 備份快速開始
├── CoachReport-Architecture.md    # 教練回報架構
├── features/                      # 功能特性文檔
│   ├── COACH_REPORT_V2_README.md
│   └── MEMBERSHIP_FIELDS.md
├── testing/                       # 測試相關
│   ├── TEST_CHECKLIST.md
│   ├── TEST_HELPER.html
│   └── TEST_REQUIRES_DRIVER.md
└── archive/                       # 歷史文檔歸檔
    └── (舊文檔)
```

---

## 🚀 部署

系統部署在 Vercel，使用 Canary Deployment 策略確保穩定性。

---

## 📞 聯絡資訊

如有問題，請聯絡系統管理員。

---

**最後更新**: 2025-11-23  
**版本**: v2.0 (UI 組件庫版本)

# UI 設計系統升級指南

## 概述

本次升級全面改進了 ES Wake 的 UI 設計系統，提升了視覺質感和用戶體驗。

## ✨ 主要改進

### 1. 設計系統升級 (`designSystem.ts`)

#### 色階系統
從單一顏色升級為完整的色階系統（50-900），提供更豐富的顏色變化：

```typescript
// 舊版
colors: {
  primary: '#4a90e2'
}

// 新版
colors: {
  primary: {
    50: '#e3f2fd',   // 最淺
    500: '#4a90e2',  // 主色
    900: '#0d47a1',  // 最深
  }
}
```

#### 玻璃擬態效果
標準化的玻璃擬態樣式定義：

```typescript
glass: {
  background: 'rgba(255, 255, 255, 0.8)',
  blur: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  shadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
}
```

#### 漸層定義
預設的漸層配色：

```typescript
gradients: {
  primary: 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)',
  secondary: 'linear-gradient(135deg, #757575 0%, #424242 100%)',
  success: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
  subtle: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
}
```

#### Elevation 系統
Material Design 風格的陰影層次（0-24）：

```typescript
shadows: {
  elevation: {
    0: 'none',
    1: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    2: '0 3px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.12)',
    // ... 更多層次
    24: '0 40px 80px rgba(0,0,0,0.20), 0 20px 30px rgba(0,0,0,0.12)',
  }
}
```

---

### 2. Button 組件優化

#### 新增功能

**Loading 狀態**
```tsx
<Button isLoading={true}>提交</Button>
// 自動顯示轉圈圈和「處理中...」文字
```

**圖標支援**
```tsx
<Button icon={<PlusIcon />} iconPosition="left">
  新增預約
</Button>
```

**全寬按鈕**
```tsx
<Button fullWidth>登入</Button>
```

**漸層背景**
Primary 和 Success 按鈕現在使用漸層背景，視覺效果更豐富。

#### 增強的 Hover 效果
- 輕微上浮（translateY -1px）
- 透明度變化（0.9）
- 陰影加深

---

### 3. Card 組件優化

#### 新增功能

**Hover 效果**
```tsx
<Card hoverable>
  {/* 滑鼠移入時會上浮並增加陰影 */}
</Card>
```

**標題裝飾線**
```tsx
<Card title="會員資訊" titleAccent>
  {/* 標題左側會有一條藍色裝飾線 */}
</Card>
```

**玻璃擬態變體**
```tsx
<Card variant="glass">
  {/* 半透明背景 + 模糊效果 */}
</Card>
```

#### 使用範例
```tsx
<Card
  variant="highlighted"
  title="今日預約"
  titleAccent
  hoverable
  onClick={() => console.log('點擊卡片')}
>
  <p>這是一個可點擊的卡片，帶有標題裝飾線</p>
</Card>
```

---

### 4. 新增 Input 組件

完整的輸入框組件，帶有 Focus Ring 和錯誤狀態。

#### 基本用法
```tsx
<Input
  label="電子郵件"
  placeholder="請輸入電子郵件"
  type="email"
/>
```

#### 錯誤狀態
```tsx
<Input
  label="密碼"
  type="password"
  error="密碼長度至少 8 個字元"
/>
```

#### 圖標支援
```tsx
<Input
  label="搜尋"
  placeholder="搜尋會員"
  leftIcon={<SearchIcon />}
  rightIcon={<FilterIcon />}
/>
```

#### Focus Ring 效果
當輸入框獲得焦點時，會顯示半透明的藍色光圈，提升可訪問性和視覺回饋。

---

### 5. 新增 Textarea 組件

多行文字輸入框，功能與 Input 組件類似。

```tsx
<Textarea
  label="備註"
  placeholder="請輸入備註資訊"
  rows={4}
  helperText="最多 500 字"
/>
```

---

### 6. 新增 StatusBadge 組件

用於顯示預約狀態的標籤組件。

#### 圓點模式（用於卡片右上角）
```tsx
<StatusBadge status="confirmed" />
<StatusBadge status="pending" />
<StatusBadge status="checked_in" />
```

#### 完整標籤模式
```tsx
<StatusBadge status="confirmed" showLabel size="medium" />
// 顯示：🟢 已確認
```

#### 支援的狀態
- `confirmed` - 已確認（綠色）
- `pending` - 未付款（橘色）
- `checked_in` - 已報到（藍色）
- `completed` - 已完成（灰色）
- `cancelled` - 已取消（紅色）

---

### 7. 預約卡片優化

時間顯示加強：
- 字體從 12px/14px 增大到 14px/16px
- 字重從 600 增加到 700
- 增加字距（letterSpacing: 0.5px）

狀態標籤：
- 使用 `getStatusBadgeStyle()` 在卡片右上角顯示狀態圓點

---

## 📦 統一導出

所有 UI 組件現在可以從單一入口導入：

```tsx
import { Card, Input, Textarea, StatusBadge } from '../components/ui'
```

---

## 🎨 使用建議

### 1. 卡片設計
- 一般卡片：使用 `variant="default"` + `elevation[2]` 陰影
- 重要卡片：使用 `variant="highlighted"` + `titleAccent`
- 可點擊卡片：加上 `hoverable` 屬性
- 特殊效果：使用 `variant="glass"` 實現玻璃擬態

### 2. 按鈕設計
- 主要操作：`variant="primary"`（自動使用漸層）
- 次要操作：`variant="secondary"` 或 `variant="outline"`
- 危險操作：`variant="danger"`
- 帶圖標：使用 `icon` 和 `iconPosition` 屬性
- 載入中：使用 `isLoading` 屬性，防止重複提交

### 3. 表單設計
- 使用新的 `Input` 和 `Textarea` 組件
- 善用 `label`、`error`、`helperText` 屬性
- 重要欄位可加上左側圖標增加辨識度

### 4. 狀態顯示
- 列表中：使用 `<StatusBadge showLabel />`
- 卡片中：使用 `<StatusBadge />` 在右上角顯示圓點

---

## 🔄 遷移指南

### 舊組件更新

如果您的程式碼中使用了舊的樣式：

```tsx
// 舊版
border: `2px solid ${designSystem.colors.primary}`

// 新版
border: `2px solid ${designSystem.colors.primary[500]}`
```

### 建議遷移步驟

1. **更新導入**：使用新的統一導出
2. **替換 Input**：將原生 `<input>` 替換為 `<Input>`
3. **加入狀態標籤**：在預約卡片中加入 `<StatusBadge>`
4. **啟用 Hover**：為可點擊的卡片加上 `hoverable` 屬性
5. **使用 Loading**：為提交按鈕加上 `isLoading` 狀態

---

## 🌟 最佳實踐範例

### 登入表單
```tsx
<Card title="會員登入" titleAccent>
  <Input
    label="電子郵件"
    type="email"
    placeholder="請輸入電子郵件"
    leftIcon={<EmailIcon />}
  />
  <Input
    label="密碼"
    type="password"
    placeholder="請輸入密碼"
    leftIcon={<LockIcon />}
  />
  <Button
    variant="primary"
    fullWidth
    isLoading={isSubmitting}
  >
    登入
  </Button>
</Card>
```

### 預約卡片
```tsx
<div style={getBookingCardStyle(boatColor, isMobile, true)}>
  <StatusBadge status="confirmed" />
  <div style={bookingCardContentStyles.timeRange(isMobile)}>
    09:00 - 11:00
  </div>
  <div style={bookingCardContentStyles.contactName(isMobile)}>
    王小明
  </div>
  {/* 其他內容 */}
</div>
```

### 操作按鈕組
```tsx
<div style={{ display: 'flex', gap: '8px' }}>
  <Button
    variant="primary"
    icon={<PlusIcon />}
    onClick={handleAdd}
  >
    新增
  </Button>
  <Button
    variant="outline"
    icon={<FilterIcon />}
    onClick={handleFilter}
  >
    篩選
  </Button>
  <Button
    variant="ghost"
    icon={<RefreshIcon />}
    onClick={handleRefresh}
  >
    重新整理
  </Button>
</div>
```

---

## 🎯 後續建議

1. **逐步遷移**：不需要一次性更新所有頁面，可以在開發新功能時使用新組件
2. **保持一致**：同類型的操作使用同樣的按鈕變體和尺寸
3. **測試回饋**：在真實裝置上測試 Focus Ring 和 Hover 效果
4. **Dark Mode**：未來可以擴展設計系統支援深色模式

---

## 📞 技術支援

如有任何問題或建議，請參考：
- 設計系統：`src/styles/designSystem.ts`
- UI 組件：`src/components/ui/`
- 範例用法：本文檔的最佳實踐部分


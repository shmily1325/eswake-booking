# UI 組件使用範例

快速參考指南，展示新 UI 組件的常見使用方式。

## 📦 導入方式

```tsx
// 從統一入口導入
import { Button, Card, Input, Textarea, Badge, StatusBadge } from '../../components/ui'

// 設計系統
import { designSystem } from '../../styles/designSystem'
```

## 🔘 Button 按鈕

### 基本用法
```tsx
<Button variant="primary" onClick={handleClick}>
  儲存
</Button>
```

### Loading 狀態
```tsx
<Button 
  variant="primary" 
  isLoading={isSubmitting}
  onClick={handleSubmit}
>
  提交表單
</Button>
```

### 帶圖標的按鈕
```tsx
// 圖標在左側
<Button 
  variant="primary"
  icon={<span>➕</span>}
  iconPosition="left"
>
  新增預約
</Button>

// 圖標在右側
<Button 
  variant="outline"
  icon={<span>→</span>}
  iconPosition="right"
>
  下一步
</Button>
```

### 全寬按鈕
```tsx
<Button variant="primary" fullWidth>
  登入
</Button>
```

### 按鈕變體
```tsx
<Button variant="primary">主要操作</Button>
<Button variant="secondary">次要操作</Button>
<Button variant="success">成功</Button>
<Button variant="warning">警告</Button>
<Button variant="danger">刪除</Button>
<Button variant="info">資訊</Button>
<Button variant="outline">外框</Button>
<Button variant="ghost">透明</Button>
```

### 按鈕尺寸
```tsx
<Button size="small">小按鈕</Button>
<Button size="medium">中按鈕</Button>
<Button size="large">大按鈕</Button>
```

## 🎴 Card 卡片

### 基本卡片
```tsx
<Card>
  <p>這是卡片內容</p>
</Card>
```

### 帶標題的卡片
```tsx
<Card title="會員資訊">
  <p>卡片內容</p>
</Card>
```

### 帶裝飾線的標題
```tsx
<Card title="今日預約" titleAccent>
  {/* 標題左側會有藍色裝飾線 */}
  <p>卡片內容</p>
</Card>
```

### 可 Hover 的卡片
```tsx
<Card 
  hoverable
  onClick={() => console.log('點擊卡片')}
>
  <p>將滑鼠移到我身上試試！</p>
</Card>
```

### 卡片變體
```tsx
<Card variant="default">預設卡片</Card>
<Card variant="highlighted">高亮卡片</Card>
<Card variant="warning">警告卡片</Card>
<Card variant="success">成功卡片</Card>
<Card variant="glass">玻璃擬態卡片</Card>
```

### 完整範例
```tsx
<Card
  variant="highlighted"
  title="重要通知"
  titleAccent
  hoverable
  onClick={handleCardClick}
>
  <p>這是一個帶有標題裝飾線、可點擊、會 hover 的高亮卡片</p>
</Card>
```

## 📝 Input 輸入框

### 基本輸入框
```tsx
<Input
  label="姓名"
  placeholder="請輸入姓名"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### 帶錯誤提示
```tsx
<Input
  label="電子郵件"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={emailError}
/>
```

### 帶提示文字
```tsx
<Input
  label="密碼"
  type="password"
  helperText="密碼長度至少 8 個字元"
/>
```

### 帶圖標
```tsx
<Input
  label="搜尋"
  placeholder="搜尋會員"
  leftIcon={<span>🔍</span>}
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
/>
```

### 不同尺寸
```tsx
<Input label="小輸入框" size="small" />
<Input label="中輸入框" size="medium" />
<Input label="大輸入框" size="large" />
```

## 📄 Textarea 多行文字框

### 基本用法
```tsx
<Textarea
  label="備註"
  placeholder="請輸入備註"
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  rows={4}
/>
```

### 帶錯誤和提示
```tsx
<Textarea
  label="描述"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  error={descError}
  helperText="最多 500 字"
  rows={5}
/>
```

### 調整大小設定
```tsx
<Textarea resize="none" />      {/* 無法調整 */}
<Textarea resize="vertical" />  {/* 只能垂直調整 */}
<Textarea resize="horizontal" />{/* 只能水平調整 */}
<Textarea resize="both" />      {/* 可以任意調整 */}
```

## 🏷️ Badge 徽章

### 基本用法
```tsx
<Badge variant="success">已完成</Badge>
<Badge variant="warning">待處理</Badge>
<Badge variant="danger">已逾期</Badge>
<Badge variant="info">資訊</Badge>
<Badge variant="default">預設</Badge>
```

### 不同尺寸
```tsx
<Badge size="small">小</Badge>
<Badge size="medium">中</Badge>
```

## 🔵 StatusBadge 狀態標籤

### 圓點模式（用於卡片右上角）
```tsx
<div style={{ position: 'relative' }}>
  <StatusBadge status="confirmed" />
  {/* 其他卡片內容 */}
</div>
```

### 完整標籤模式
```tsx
<StatusBadge status="confirmed" showLabel />
<StatusBadge status="pending" showLabel />
<StatusBadge status="checked_in" showLabel />
<StatusBadge status="completed" showLabel />
<StatusBadge status="cancelled" showLabel />
```

### 不同尺寸
```tsx
<StatusBadge status="confirmed" showLabel size="small" />
<StatusBadge status="pending" showLabel size="medium" />
```

## 🎨 設計系統使用

### 顏色
```tsx
// 使用色階
<div style={{ color: designSystem.colors.primary[500] }}>主色</div>
<div style={{ color: designSystem.colors.primary[700] }}>深色</div>

// 使用語義色
<div style={{ color: designSystem.colors.success[500] }}>成功</div>
<div style={{ color: designSystem.colors.danger[500] }}>危險</div>
```

### 漸層
```tsx
<div style={{ background: designSystem.gradients.primary }}>
  漸層背景
</div>
```

### 玻璃擬態
```tsx
<div style={{
  background: designSystem.glass.background,
  backdropFilter: designSystem.glass.blur,
  border: designSystem.glass.border,
  boxShadow: designSystem.glass.shadow,
}}>
  玻璃擬態效果
</div>
```

### 陰影（Elevation）
```tsx
<div style={{ boxShadow: designSystem.shadows.elevation[2] }}>
  低海拔（卡片）
</div>
<div style={{ boxShadow: designSystem.shadows.elevation[8] }}>
  高海拔（Modal）
</div>
```

## 🎯 實戰範例

### 登入表單
```tsx
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Card title="會員登入" titleAccent>
      <Input
        label="電子郵件"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        leftIcon={<span>📧</span>}
        fullWidth
      />
      <Input
        label="密碼"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        leftIcon={<span>🔒</span>}
        fullWidth
      />
      <Button
        variant="primary"
        fullWidth
        isLoading={isLoading}
        onClick={handleLogin}
      >
        登入
      </Button>
    </Card>
  )
}
```

### 預約卡片
```tsx
function BookingCard({ booking }) {
  return (
    <div style={getBookingCardStyle(booking.boatColor, false, true)}>
      {/* 狀態標籤 */}
      <StatusBadge status={booking.status} />
      
      {/* 時間 */}
      <div style={bookingCardContentStyles.timeRange(false)}>
        {booking.startTime} - {booking.endTime}
      </div>
      
      {/* 聯絡人 */}
      <div style={bookingCardContentStyles.contactName(false)}>
        {booking.contactName}
      </div>
      
      {/* 其他資訊 */}
    </div>
  )
}
```

### 操作按鈕組
```tsx
<div style={{ display: 'flex', gap: '8px' }}>
  <Button
    variant="primary"
    icon={<span>➕</span>}
    onClick={handleAdd}
  >
    新增
  </Button>
  <Button
    variant="outline"
    icon={<span>🔍</span>}
    onClick={handleSearch}
  >
    搜尋
  </Button>
  <Button
    variant="ghost"
    icon={<span>🔄</span>}
    onClick={handleRefresh}
  >
    重新整理
  </Button>
</div>
```

## 💡 小技巧

1. **Focus Ring 效果**：新的 Input 和 Textarea 組件在獲得焦點時會自動顯示藍色光圈
2. **Loading 狀態**：使用 `isLoading` 屬性可防止使用者重複點擊按鈕
3. **全寬元素**：使用 `fullWidth` 屬性讓按鈕或輸入框佔滿父容器寬度
4. **卡片 Hover**：為可點擊的卡片加上 `hoverable` 屬性提供視覺反饋
5. **色階使用**：使用 `[500]` 作為主色，`[50]` 作為背景色，`[700]` 作為深色變體


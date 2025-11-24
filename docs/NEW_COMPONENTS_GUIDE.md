# 新增 UI 組件完整指南

本次優化新增了多個實用的 UI 組件，大幅提升用戶體驗和開發效率。

---

## 📦 組件清單

### 反饋組件
- ✅ **Modal** - 對話框/彈窗
- ✅ **ConfirmModal** - 確認對話框
- ✅ **Toast** - 通知提示
- ✅ **Tooltip** - 工具提示
- ✅ **Loading** - 加載動畫
- ✅ **Skeleton** - 骨架屏
- ✅ **Spinner** - 內聯轉圈圈

### 工具函數
- ✅ **animations** - 動畫工具函數
- ✅ **touchGestures** - 移動端手勢識別

---

## 🎭 Modal 對話框

### 基本用法

```tsx
import { Modal } from '../../components/ui'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>打開對話框</Button>
      
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="編輯會員"
      >
        <p>這是對話框內容</p>
      </Modal>
    </>
  )
}
```

### 自定義 Footer

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="確認操作"
  footer={
    <>
      <Button variant="outline" onClick={onClose}>
        取消
      </Button>
      <Button variant="primary" onClick={handleSave}>
        儲存
      </Button>
    </>
  }
>
  <p>您確定要儲存這些更改嗎？</p>
</Modal>
```

### 不同尺寸

```tsx
<Modal size="small">...</Modal>     {/* 400px */}
<Modal size="medium">...</Modal>    {/* 600px */}
<Modal size="large">...</Modal>     {/* 800px */}
<Modal size="fullscreen">...</Modal> {/* 全螢幕 */}
```

### 玻璃擬態效果

```tsx
<Modal variant="glass" title="玻璃效果">
  <p>半透明背景 + 模糊效果</p>
</Modal>
```

### ConfirmModal 快捷確認框

```tsx
import { ConfirmModal } from '../../components/ui'

<ConfirmModal
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  onConfirm={handleDelete}
  title="刪除確認"
  message="確定要刪除這個會員嗎？此操作無法復原。"
  confirmText="刪除"
  cancelText="取消"
  variant="danger"
  isLoading={isDeleting}
/>
```

### Modal 屬性

| 屬性 | 類型 | 默認值 | 說明 |
|------|------|--------|------|
| `isOpen` | `boolean` | - | 是否顯示 |
| `onClose` | `() => void` | - | 關閉回調 |
| `title` | `string` | - | 標題 |
| `children` | `ReactNode` | - | 內容 |
| `footer` | `ReactNode` | - | 底部內容 |
| `size` | `'small' \| 'medium' \| 'large' \| 'fullscreen'` | `'medium'` | 尺寸 |
| `variant` | `'default' \| 'glass'` | `'default'` | 變體 |
| `closeOnOverlayClick` | `boolean` | `true` | 點擊遮罩關閉 |
| `showCloseButton` | `boolean` | `true` | 顯示關閉按鈕 |

---

## 🔔 Toast 通知

### 使用 Hook

```tsx
import { useToast, ToastContainer } from '../../components/ui'

function MyComponent() {
  const toast = useToast()

  const handleSave = async () => {
    try {
      await saveData()
      toast.success('儲存成功！')
    } catch (error) {
      toast.error('儲存失敗：' + error.message)
    }
  }

  return (
    <>
      <Button onClick={handleSave}>儲存</Button>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </>
  )
}
```

### 不同類型

```tsx
toast.success('操作成功')
toast.error('操作失敗')
toast.warning('請注意')
toast.info('提示訊息')

// 自定義持續時間（毫秒）
toast.success('3 秒後消失', 3000)
toast.error('5 秒後消失', 5000)
```

### 位置設置

```tsx
<ToastContainer
  messages={toast.messages}
  onClose={toast.closeToast}
  position="top-right"    // 右上角（默認）
  position="top-left"     // 左上角
  position="bottom-right" // 右下角
  position="bottom-left"  // 左下角
  position="top-center"   // 頂部居中
/>
```

### 在頁面中整合

```tsx
// App.tsx 或佈局組件中
function App() {
  const toast = useToast()

  // 將 toast 方法暴露給全局使用（可選）
  React.useEffect(() => {
    window.showToast = toast
  }, [toast])

  return (
    <div>
      {/* 您的應用內容 */}
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
```

---

## 💡 Tooltip 工具提示

### 基本用法

```tsx
import { Tooltip } from '../../components/ui'

<Tooltip content="這是提示文字">
  <Button>Hover me</Button>
</Tooltip>
```

### 不同位置

```tsx
<Tooltip content="頂部提示" position="top">
  <span>上</span>
</Tooltip>

<Tooltip content="底部提示" position="bottom">
  <span>下</span>
</Tooltip>

<Tooltip content="左側提示" position="left">
  <span>左</span>
</Tooltip>

<Tooltip content="右側提示" position="right">
  <span>右</span>
</Tooltip>
```

### 延遲顯示

```tsx
<Tooltip content="1 秒後顯示" delay={1000}>
  <span>慢慢移過來</span>
</Tooltip>
```

---

## ⏳ Loading 加載組件

### 全螢幕加載

```tsx
import { Loading } from '../../components/ui'

{isLoading && <Loading fullScreen text="載入中..." />}
```

### 區域加載

```tsx
<div style={{ padding: '40px' }}>
  {isLoading ? (
    <Loading size="large" text="載入資料中..." />
  ) : (
    <div>資料內容</div>
  )}
</div>
```

### 不同尺寸

```tsx
<Loading size="small" />
<Loading size="medium" />
<Loading size="large" />
```

### 自定義顏色

```tsx
<Loading color="#4a90e2" />
<Loading color={designSystem.colors.success[500]} />
```

---

## 💀 Skeleton 骨架屏

### 基本用法

```tsx
import { Skeleton } from '../../components/ui'

{isLoading ? (
  <Skeleton width="100%" height="20px" count={5} />
) : (
  <div>{content}</div>
)}
```

### 卡片骨架

```tsx
<Card>
  {isLoading ? (
    <>
      <Skeleton width="60%" height="24px" />
      <Skeleton width="100%" height="16px" count={3} />
      <Skeleton width="40%" height="16px" />
    </>
  ) : (
    <div>{data}</div>
  )}
</Card>
```

### 自定義樣式

```tsx
<Skeleton
  width="200px"
  height="200px"
  borderRadius="50%"  // 圓形
  style={{ margin: '0 auto' }}
/>
```

---

## 🔄 Spinner 內聯轉圈圈

用於按鈕、文字旁等小型加載指示器。

```tsx
import { Spinner } from '../../components/ui'

<div>
  <Spinner size={16} /> 載入中...
</div>

<button disabled={isLoading}>
  {isLoading && <Spinner size={14} color="white" />}
  {isLoading ? '處理中...' : '提交'}
</button>
```

---

## 🎬 動畫工具函數

### 基本動畫

```tsx
import { animate, easing } from '../../utils/animations'

// 從 0 到 100，持續 300ms
const cancel = animate(0, 100, 300, (value) => {
  element.style.width = `${value}%`
}, easing.easeOutQuad)

// 取消動畫
cancel()
```

### 平滑滾動

```tsx
import { scrollTo } from '../../utils/animations'

// 滾動到頂部
scrollTo(window, 0, 300)

// 滾動到指定元素
const element = document.getElementById('target')
scrollTo(element, 500, 500, easing.easeInOutQuad)
```

### 淡入淡出

```tsx
import { fade } from '../../utils/animations'

// 淡入
await fade(element, 'in', 300)

// 淡出
await fade(element, 'out', 300)
```

### 滑動效果

```tsx
import { slide } from '../../utils/animations'

// 向下滑動 100px
await slide(element, 'down', 100, 300)

// 向右滑動 200px
await slide(element, 'right', 200, 500)
```

### 縮放效果

```tsx
import { scale } from '../../utils/animations'

// 從 0 放大到 1
await scale(element, 0, 1, 300, easing.easeOutElastic)
```

### 組合動畫

```tsx
import { sequence, parallel } from '../../utils/animations'

// 依序執行
await sequence(
  () => fade(element1, 'in', 300),
  () => slide(element2, 'down', 100, 300),
  () => scale(element3, 0, 1, 300)
)

// 同時執行
await parallel(
  () => fade(element1, 'in', 300),
  () => fade(element2, 'in', 300),
  () => fade(element3, 'in', 300)
)
```

### 數字計數動畫

```tsx
import { countUp } from '../../utils/animations'

const cancel = countUp(0, 1000, 2000, (value) => {
  element.textContent = value.toString()
})
```

### 可用的緩動函數

```tsx
import { easing } from '../../utils/animations'

easing.linear
easing.easeInQuad
easing.easeOutQuad
easing.easeInOutQuad
easing.easeInCubic
easing.easeOutCubic
easing.easeInOutCubic
easing.easeInQuart
easing.easeOutQuart
easing.easeInOutQuart
easing.easeInElastic
easing.easeOutElastic
easing.easeOutBounce
```

---

## 📱 移動端手勢識別

### 基本用法

```tsx
import { TouchGestureHandler } from '../../utils/touchGestures'

useEffect(() => {
  if (!elementRef.current) return

  const handler = new TouchGestureHandler(elementRef.current, {
    onSwipe: (event) => {
      console.log(`滑動方向: ${event.direction}`)
      console.log(`滑動距離: ${event.distance}px`)
    },
    onLongPress: (point) => {
      console.log('長按觸發')
    },
    onDoubleTap: (point) => {
      console.log('雙擊觸發')
    },
    onTap: (point) => {
      console.log('單擊觸發')
    },
  })

  return () => handler.destroy()
}, [])
```

### React Hook 方式

```tsx
import { useTouchGesture } from '../../utils/touchGestures'

function MyComponent() {
  const elementRef = useRef<HTMLDivElement>(null)

  useTouchGesture(elementRef, {
    onSwipe: (event) => {
      if (event.direction === 'left') {
        // 向左滑動，顯示下一頁
        nextPage()
      } else if (event.direction === 'right') {
        // 向右滑動，顯示上一頁
        prevPage()
      }
    },
    swipeThreshold: 50, // 最小滑動距離
  })

  return <div ref={elementRef}>可滑動的內容</div>
}
```

### 實用工具

```tsx
import {
  preventBounce,
  enhanceTouchTarget,
  hapticFeedback,
  lockScroll,
  unlockScroll,
} from '../../utils/touchGestures'

// 防止 iOS 橡皮筋效果
preventBounce(scrollContainer)

// 增強觸摸目標（確保最小 44x44pt）
enhanceTouchTarget(smallButton)

// 觸覺反饋
hapticFeedback() // 單次震動
hapticFeedback([100, 50, 100]) // 震動模式

// 鎖定/解鎖滾動（用於 Modal）
lockScroll()   // 打開 Modal
unlockScroll() // 關閉 Modal
```

---

## 🎯 實戰範例

### 1. 刪除確認流程

```tsx
function MemberList() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const toast = useToast()

  const handleDeleteClick = (id: string) => {
    setSelectedId(id)
    setShowConfirm(true)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMember(selectedId!)
      toast.success('刪除成功')
      setShowConfirm(false)
      refreshList()
    } catch (error) {
      toast.error('刪除失敗：' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {members.map((member) => (
        <div key={member.id}>
          {member.name}
          <Button variant="danger" onClick={() => handleDeleteClick(member.id)}>
            刪除
          </Button>
        </div>
      ))}

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        message="確定要刪除這個會員嗎？"
        variant="danger"
        isLoading={isDeleting}
      />

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </>
  )
}
```

### 2. 表單編輯對話框

```tsx
function EditMemberModal({ member, isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState(member)
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToast()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateMember(formData)
      toast.success('儲存成功')
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('儲存失敗：' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="編輯會員"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
            儲存
          </Button>
        </>
      }
    >
      <Input
        label="姓名"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <Input
        label="電話"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      {/* 更多欄位 */}
    </Modal>
  )
}
```

### 3. 帶骨架屏的資料載入

```tsx
function MemberList() {
  const [members, setMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setIsLoading(true)
    try {
      const data = await fetchMembers()
      setMembers(data)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card title="會員列表" titleAccent>
      {isLoading ? (
        <>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <Skeleton width="100%" height="60px" />
            </div>
          ))}
        </>
      ) : (
        members.map((member) => (
          <div key={member.id}>{member.name}</div>
        ))
      )}
    </Card>
  )
}
```

---

## 📝 最佳實踐

### 1. Toast 使用建議
- ✅ 成功操作使用 `toast.success()`
- ✅ 錯誤操作使用 `toast.error()`
- ✅ 重要提醒使用 `toast.warning()`
- ✅ 一般訊息使用 `toast.info()`
- ❌ 不要濫用，避免打擾用戶

### 2. Modal 使用建議
- ✅ 重要操作使用 Modal 確認
- ✅ 複雜表單使用 Modal
- ✅ 提供明確的關閉方式
- ❌ 不要嵌套 Modal
- ❌ 不要在 Modal 中放太多內容

### 3. Loading 使用建議
- ✅ 超過 0.5 秒的操作顯示 Loading
- ✅ 長時間操作顯示進度文字
- ✅ 列表載入使用 Skeleton
- ❌ 快速操作不需要 Loading

### 4. 動畫使用建議
- ✅ 使用適當的緩動函數
- ✅ 持續時間控制在 200-500ms
- ✅ 重要元素使用動畫引導注意力
- ❌ 不要過度使用動畫
- ❌ 不要使用太慢的動畫

---

## 🎉 總結

本次優化新增了：
- ✅ 6 個反饋組件（Modal、Toast、Tooltip、Loading、Skeleton、Spinner）
- ✅ 完整的動畫工具函數庫
- ✅ 移動端手勢識別系統
- ✅ 所有組件都支援響應式設計
- ✅ 完整的 TypeScript 類型支援
- ✅ 零依賴，純手寫實現

這些組件將大幅提升用戶體驗和開發效率！🚀


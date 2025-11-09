# ESWake Booking System V5 实作进度

## ✅ 已完成的任务

### 1. 数据库 V5 迁移 ✅
- ✅ 创建 `reset_and_setup_v5.sql` 全新 V5 数据库
- ✅ 新增 `booking_members` 表（支持一个预约多个会员）
- ✅ 新增 `coach_reports` 表（教练驾驶回报）
- ✅ 简化 `booking_participants` 表（单一 payment_method 字段）
- ✅ 删除 `drivers` 表和 `bookings.driver_coach_id` 字段
- ✅ 保留 `boat_unavailable_dates` 和 `coach_time_off`（日期范围管理）
- ✅ 所有时间字段改为 TEXT 格式（无时区转换）
- ✅ 添加 Audit Log Triggers（自动记录 bookings, booking_coaches, coach_reports 变更）

### 2. LINE API 更新 ✅
- ✅ `line-webhook.ts`: 
  - 自动记录所有发送消息的 LINE User ID 到 `line_bindings` 表
  - 支持会员绑定/取消绑定
  - 添加静默模式开关（`line_webhook_enabled`）
- ✅ `line-reminder.ts`:
  - 支持从 `booking_members` 查询多会员
  - 使用 `line_bindings` 表查找 LINE ID
  - 每个绑定会员都会收到提醒

### 3. 前端预约显示 ✅
- ✅ `DayView.tsx`:
  - 移除 `driver` 字段和显示
  - 简化数据查询（不再查询 driver_coach_id）
  - 只显示教练，不显示驾驶

### 4. 新增预约对话框 ✅
- ✅ `NewBookingDialog.tsx`:
  - 移除驾驶选择 UI 和逻辑
  - 支持多会员选择（可选择多个会员）
  - 已选会员显示为绿色标签，可单独移除
  - 插入 `booking_members` 表记录所有选中的会员
  - 移除所有驾驶冲突检查逻辑
  - 简化预约插入（不再包含 driver_coach_id）

### 5. Audit Log 工具 ✅
- ✅ `auditLog.ts`:
  - 移除 `driverName` 参数
  - 简化日志记录格式

---

## ⚠️ 进行中/待修复

### 6. 编辑预约对话框 ⚠️
- ⚠️ `EditBookingDialog.tsx`:
  - ✅ 移除 interface 中的 driver 字段
  - ✅ 改为支持 `selectedMemberIds` 数组
  - ❌ **还有 35 个 linter 错误需要修复**（类似 NewBookingDialog 的修改）
  - 需要：
    - 移除所有 `selectedDriver`, `setSelectedDriver` 引用
    - 移除所有 `student`, `setStudent` 引用
    - 修复所有 `selectedMemberId` -> `selectedMemberIds`
    - 修复所有 `setSelectedMemberId` -> `setSelectedMemberIds`
    - 更新 UI 支持多会员选择
    - 加载现有预约的会员列表

---

## 📋 尚未开始的任务

### 7. 教练指派页面（可选）⏸️
- ⏸️ `CoachAssignment.tsx`:
  - 创建新页面供 Bao 使用
  - 可以查看今日预约
  - 可以手动添加教练排班备注
  - **你提到这个功能可能不需要那么复杂**

### 8. 教练回报页面（重要）🚨
- 🚨 `CoachCheck.tsx`:
  - **重构为手机友善界面**
  - 每个教练分别回报：
    - 驾驶部分：油量、驾驶时数
    - 参与者部分：姓名、时数、收费方式
  - 需要插入 `coach_reports` 表
  - 简化 `booking_participants` 插入（只用 payment_method）

---

## 🎯 接下来的步骤建议

### 选项 A：先完成基础功能（推荐）
1. 修复 `EditBookingDialog.tsx` 的所有错误
2. 测试基本的预约创建/编辑流程
3. Git commit & push，部署到 Vercel
4. 测试数据库和 API 是否正常工作

### 选项 B：先实作教练回报
1. 跳过 EditBookingDialog 的修复（暂时不编辑预约）
2. 直接重构 `CoachCheck.tsx` 为手机友善的回报界面
3. 这样教练可以立即开始使用新的回报功能

### 选项 C：最小可用版本
1. 只修复 `EditBookingDialog.tsx` 中最关键的错误（让它能编译通过）
2. 简单重构 `CoachCheck.tsx`（只改 UI，暂不加驾驶回报）
3. 先部署，再慢慢完善

---

## 💬 需要你决定

1. **EditBookingDialog 要修复吗？**
   - 如果需要编辑预约功能，我会立即修复所有 35 个错误
   - 如果暂时不用，可以先跳过

2. **教练指派页面还需要吗？**
   - 你之前提到"不用那么复杂"
   - 如果不需要，我会跳过这个功能

3. **教练回报是重点吗？**
   - 如果是，我会优先重构 `CoachCheck.tsx`
   - 手机友善 + 驾驶回报 + 简化参与者回报

---

## 📊 当前文件状态

### ✅ 没有错误
- `src/pages/DayView.tsx`
- `src/components/NewBookingDialog.tsx`
- `src/utils/auditLog.ts`
- `api/line-webhook.ts`
- `api/line-reminder.ts`
- `database_schema_v5.sql`
- `reset_and_setup_v5.sql`

### ❌ 有错误（35个）
- `src/components/EditBookingDialog.tsx`

### ⏸️ 未开始
- `src/pages/CoachCheck.tsx`（需要大幅重构）
- `src/pages/CoachAssignment.tsx`（可能不需要）


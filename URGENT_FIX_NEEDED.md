# ⚠️ 紧急修复：reported_at 字段类型不匹配

## 🔴 问题

**booking_participants.reported_at** 当前是 `timestamp with time zone`，但代码使用 `getLocalTimestamp()` 返回 TEXT 字符串！

### 代码中：
```typescript
reported_at: getLocalTimestamp()  // 返回 "2025-11-19T16:00:00" (TEXT)
```

### 数据库中：
```sql
reported_at TIMESTAMPTZ  -- 期望 timestamp with time zone 类型
```

## ❌ 导致的错误

当执行回报提交时会报错：
```
ERROR: column "reported_at" is of type timestamp with time zone but expression is of type text
```

## ✅ 解决方案

### 立即执行以下 SQL 脚本：

```sql
-- 在 Supabase SQL Editor 执行
→ current_state_migration.sql
```

**或者**（两个脚本功能相同，任选一个）：

```sql
→ fix_reported_at_to_text.sql
```

这个脚本会：
1. 将现有的 TIMESTAMPTZ 数据转换为本地时间 TEXT  
2. 删除旧的 TIMESTAMPTZ 列
3. 创建新的 TEXT 列
4. 保留所有现有数据

### ❌ 不需要执行的脚本

```bash
# ❌ 不要执行 complete_migration.sql
#    因为其他字段都已经存在了！
#    只有 reported_at 需要类型转换。
```

## 📋 确认清单

### 已经存在且正确的字段：
- ✅ is_teaching (BOOLEAN)
- ✅ lesson_type (VARCHAR)
- ✅ status (TEXT)
- ✅ is_deleted (BOOLEAN)
- ✅ deleted_at (TEXT) ✅
- ✅ updated_at (TEXT) ✅
- ✅ created_at (TEXT) ✅

### 需要修复的字段：
- ⚠️ reported_at (TIMESTAMPTZ → TEXT)

## 🚀 执行步骤

1. **备份数据**（可选但推荐）
   ```sql
   -- 查看现有 reported_at 数据
   SELECT id, booking_id, participant_name, reported_at
   FROM booking_participants
   WHERE reported_at IS NOT NULL;
   ```

2. **执行修复脚本**
   ```sql
   -- 执行 fix_reported_at_to_text.sql
   ```

3. **验证结果**
   ```sql
   -- 确认 reported_at 已是 TEXT 类型
   SELECT column_name, data_type, udt_name
   FROM information_schema.columns
   WHERE table_name = 'booking_participants' 
     AND column_name = 'reported_at';
   
   -- 应该显示：
   -- column_name: reported_at
   -- data_type: text
   -- udt_name: text
   ```

4. **测试应用**
   - 尝试提交一个教练回报
   - 应该可以正常保存

## ⏱️ 紧急程度

**高优先级！** 

当前代码已经提交并使用 `getLocalTimestamp()`，如果不修复数据库，**所有回报提交都会失败**！

## 📝 后续

修复完成后，可以安全部署代码。所有其他字段都已正确配置为 TEXT 类型。


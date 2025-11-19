# 資料庫遷移腳本

這個資料夾包含所有的資料庫遷移 SQL 腳本。

## ⚠️ 重要提醒

**這些是歷史遷移腳本，僅供參考。**

- ✅ 生產環境資料庫已經包含這些變更
- ✅ 用戶資料不會受到影響
- ❌ **請勿重複執行這些腳本**

## 📁 檔案說明

### 主要架構檔案
- `database_schema_v5.sql` - 完整的資料庫架構定義
- `reset_and_setup_v5.sql` - 重設和初始化腳本（僅供開發環境使用）

### 遷移檔案（依時間順序）
1. 預約相關
   - `add_booking_drivers_table.sql` - 新增預約駕駛關聯表
   - `add_driver_field.sql` - 新增駕駛欄位
   - `add_requires_driver_field.sql` - 新增是否需要駕駛欄位

2. 會員相關
   - `add_membership_fields.sql` - 新增會員欄位
   - `migration_member_fields_v2.sql` - 會員欄位遷移 v2

3. 交易相關
   - `add_transaction_date.sql` - 新增交易日期
   - `add_transaction_fields.sql` - 新增交易欄位
   - `add_transactions_read_policy.sql` - 新增交易讀取權限
   - `migration_transactions_add_fields.sql` - 交易欄位遷移

4. 權限相關
   - `create_permission_tables.sql` - 建立權限表
   - `check_permission_data.sql` - 檢查權限資料
   - `fix_permission_policies.sql` - 修復權限政策
   - `disable_permission_rls.sql` - 停用權限 RLS
   - `fix_cancel_booking_permission.sql` - 修復取消預約權限

5. 其他功能
   - `add_schedule_notes.sql` - 新增排程備註
   - `migration_booking_participants_v2.sql` - 預約參與者遷移 v2
   - `fix_audit_log.sql` - 修復審計日誌
   - `fix_created_at.sql` - 修復建立時間
   - `update_boat_colors.sql` - 更新船隻顏色
   - `update_g23_color_to_silver.sql` - 更新 G23 顏色為銀色

### 管理和維護
- `init_line_settings.sql` - 初始化 LINE 設定
- `insert_super_admins.sql` - 插入超級管理員
- `current_state_migration.sql` - 目前狀態遷移
- `database_indexes_recommendation.sql` - 資料庫索引建議

### 清理腳本（⚠️ 危險操作）
- `clear_all_reports.sql` - 清除所有報告
- `clear_coach_reports.sql` - 清除教練報告
- `clear_transactions.sql` - 清除交易記錄
- `reset_data_keep_boats_coaches.sql` - 重設資料但保留船隻和教練

## 🔧 使用方式

### 新環境設置
```bash
# 在 Supabase SQL Editor 中執行
psql -f migrations/database_schema_v5.sql
```

### 查看遷移歷史
這些腳本代表了系統的演進過程，建議：
1. 查看檔案以了解資料庫結構變化
2. 參考這些腳本來理解系統設計
3. **絕不在生產環境重複執行**

## 📝 維護指南

### 新增遷移腳本
1. 使用清楚的檔名：`add_feature_name.sql` 或 `fix_issue_name.sql`
2. 在腳本開頭加上註解說明目的和日期
3. 更新此 README 檔案

### 最佳實踐
- ✅ 遷移腳本應該是冪等的（可重複執行）
- ✅ 先在開發環境測試
- ✅ 保留完整的遷移歷史
- ❌ 不要修改已執行的遷移腳本

---

*最後更新：2025-11-19*


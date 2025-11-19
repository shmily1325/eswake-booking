# 會員資料欄位說明

## 基本資料
- `name` - 姓名（必填）
- `nickname` - 暱稱
- `phone` - 電話
- `birthday` - 生日 (YYYY-MM-DD)
- `notes` - 備註

## 會員類型與配對
- `member_type` - 系統會員類型 (guest/member/vip 等)
- `membership_type` - 會員類型
  - `general` - 一般會員
  - `dual` - 雙人會員
  - `board` - 置板會員
- `membership_partner_id` - 雙人會員配對的另一位會員 ID

## 會員期限
- `membership_start_date` - 會員開始日期 (YYYY-MM-DD)
- `membership_end_date` - 會員截止日期 (YYYY-MM-DD)

## 置板相關（僅限置板會員）
- `board_slot_number` - 置板位號碼
- `board_expiry_date` - 置板到期日 (YYYY-MM-DD)

## 贈送時數
- `free_hours` - 贈送時數（分鐘）
- `free_hours_used` - 已使用贈送時數（分鐘）
- `free_hours_notes` - 贈送時數使用註記

## 會員財務資訊
- `balance` - 帳戶餘額
- `designated_lesson_minutes` - 指定課程分鐘數
- `boat_voucher_g23_minutes` - G23 船券分鐘數
- `boat_voucher_g21_minutes` - G21 船券分鐘數

## 狀態
- `status` - 狀態 (active/inactive)
- `created_at` - 建立時間
- `updated_at` - 更新時間

## CSV 匯入格式

### 會員資料匯入（基本資料 + 會籍資料）

```csv
姓名,暱稱,會員類型,會員開始日期,會員截止日期,置板位號碼,置板到期日,生日,電話,贈送時數,備註
王小明,小明,general,2024-01-01,2024-12-31,,,1990-05-15,0912345678,120,VIP客戶
李大華,大華,dual,2024-01-01,2024-12-31,,,1985-08-20,0987654321,120,與王小明配對
陳美玲,美玲,board,2024-01-01,2024-12-31,A-05,2024-12-31,1992-03-10,0923456789,0,置板會員
```

**注意：** 
- 財務資料（儲值餘額、船券、指定課）不在此匯入
- 這些欄位會自動設為 0
- 財務資料應在「財務管理」或「快速交易」頁面中單獨管理和匯入

### 財務資料匯入（在其他頁面）

如需批量匯入財務資料，可在財務管理頁面使用以下格式：

```csv
姓名,電話,儲值餘額,指定課(分鐘),G23船券(分鐘),G21船券(分鐘)
王小明,0912345678,5000,120,180,90
李大華,0987654321,3000,60,0,120
```

## 雙人會員配對邏輯

1. 匯入時，系統會根據相同的會員開始日期和截止日期自動配對
2. 配對後，兩人的 `membership_partner_id` 會互相指向對方
3. 到期日會自動同步為較晚的日期
4. 可在會員管理頁面手動解除或重新配對

## 置板會員特殊處理

- 如果 `membership_type` = 'board'，則必須填寫 `board_slot_number`
- `board_expiry_date` 可能與 `membership_end_date` 不同
- 置板到期後，會員身份可能仍然有效


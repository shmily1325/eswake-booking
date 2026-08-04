# 船券／VIP 分年（credit lots）分階段上線

> 範圍：僅 `vip_voucher`、`boat_voucher_g23`、`boat_voucher_g21_panther`  
> 原則：**絕對不能改錯總餘額**；標年是附加資訊。

## 安全原則

1. `members` 對應欄位 = 現行總餘額真相（須與流水金額加總一致）。
2. 標年／lots **不得**偷偷改 `members` 餘額或交易 `amount`／`minutes`／`adjust_type`。
3. 有 lot 之後：`Σ credit_lots.remaining`（同 member + category）必須 = `members` 該欄；否則禁止開 FIFO。
4. 先乾跑、人工抽樣，再正式寫入。
5. 未定案／未對完 Excel 的人先不要寫 lot。
6. `transactions.*_after` 不可當作對帳依據（見 `BALANCE_AFTER_FIELDS.md`）。

## 階段

| 階段 | 內容 | 狀態 |
|------|------|------|
| **A** | 只加結構：`voucher_year`、`credit_lots`、設定、稽核 view。不寫歷史、不改扣款。 | ✅ migration `162_credit_lots_phase_a.sql` |
| **B** | 乾跑 SQL／腳本產出 CSV：建議標年、各年剩餘；`Σ = members` | ✅（`tmp/*` 乾跑／對帳腳本；未進 repo 正式腳本也可） |
| **C** | 人工抽樣核對（建議 10～20 人 + 全部 2025 少數名單） | ✅ 已對 Excel；Julie 跳過；Mandy/Candy 部分延後 |
| **D** | 正式寫入 `voucher_year` + `credit_lots`（可回滾、先備份） | ✅ 已用 `tmp/insert_credit_lots_aligned.sql` 等寫入；audit delta≈0 |
| **E** | 新入帳可選／預設販售年；扣款 FIFO **僅套用已有 lot 者**；細帳可看／改入帳年 | ⏳ `163`+`164` 已上線；建議再套 `165`（FIFO 失敗不擋日常扣款） |
| **F** | 全開 FIFO + 畫面展開各年 | 未做（年度餘額已可看各年剩餘） |

## 階段 A 已新增

- `transactions.voucher_year`（可空）
- `credit_lots`（空表）
- `system_settings.current_voucher_year` = `2026`
- view `credit_lots_balance_audit`

套用：在 Supabase／DB 執行 `migrations/162_credit_lots_phase_a.sql`。

## 階段 B 乾跑要產出的欄位（建議）

每位會員 × 每個 category：

| 欄位 | 說明 |
|------|------|
| nickname / member_id | |
| category | vip / g23 / g21 |
| members_total | 現行 members 欄位 |
| ledger_sum | 流水金額加總（不看 after） |
| proposed_2025 | 建議 2025 剩餘 |
| proposed_2026 | 建議 2026 剩餘 |
| proposed_other | 其他年（通常 0） |
| sum_proposed | 2025+2026+… |
| delta_vs_members | 必須為 0 才可寫入 |
| confidence | 高／中／需人工 |
| notes | 來源規則 |

乾跑腳本放在後續 PR；**只 SELECT／匯出，不 UPDATE**。

## 回滾階段 A

見 `162_credit_lots_phase_a.sql` 檔案末尾註解（DROP view／table、DROP column、刪 setting）。  
不影響既有金額流水。

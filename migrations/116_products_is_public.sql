-- =============================================================================
-- 116_products_is_public.sql
--
-- 目的：為 products 加上「對外公開」旗標，跟 is_active 解耦。
--
-- 三種狀態的語意（is_active × is_public）：
--   is_active=false                       ：軟刪（後台、商城都不顯示）
--   is_active=true  ∧ is_public=false     ：後台看得到、商城不顯示
--                                            （編輯中、停售但要保留歷史、僅供員工內部查詢）
--   is_active=true  ∧ is_public=true      ：後台 + 商城都顯示，客人可看
--
-- 既有資料遷移（B 方案）：
--   把所有 is_active=true 的商品一次設為 is_public=true，
--   讓老闆從「目前狀態」開始，再把不想對外的逐一拿下。
--   新建商品預設 is_public=false（避免半成品被誤上架）。
--
-- 預期影響：
--   ✅ 庫存後台不受影響（仍以 is_active 為主篩選）
--   ✅ 商城新增 is_public=true 條件後才會生效
--   ❌ Migration 跑完前，商城會用舊邏輯顯示「所有 is_active 商品」（短暫）
--
-- Rollback：
--   ALTER TABLE products DROP COLUMN is_public;
-- =============================================================================

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- B 方案：既有上架中的商品全部標為公開
UPDATE products
   SET is_public = true
 WHERE is_active = true
   AND is_public = false;  -- 防止重跑

-- 商城列表查詢時會用到的複合條件，加個索引避免日後變慢
CREATE INDEX IF NOT EXISTS idx_products_public_active
  ON products (is_public, is_active)
  WHERE is_active = true AND is_public = true;

COMMIT;

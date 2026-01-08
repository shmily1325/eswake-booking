-- 建立代扣關係表
-- 用於記錄參與者（會員或非會員）的費用要從哪個會員帳戶扣款

CREATE TABLE IF NOT EXISTS billing_relations (
  id SERIAL PRIMARY KEY,
  participant_name TEXT NOT NULL,          -- 參與者名稱（可以是會員暱稱或非會員名字）
  billing_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,  -- 代扣會員 ID
  notes TEXT,                              -- 備註（選填）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引：加速查詢
CREATE INDEX IF NOT EXISTS idx_billing_relations_participant_name ON billing_relations(participant_name);
CREATE INDEX IF NOT EXISTS idx_billing_relations_billing_member_id ON billing_relations(billing_member_id);

-- 唯一約束：同一個參與者名稱只能有一個代扣關係
ALTER TABLE billing_relations ADD CONSTRAINT unique_participant_name UNIQUE (participant_name);

-- 啟用 RLS
ALTER TABLE billing_relations ENABLE ROW LEVEL SECURITY;

-- RLS 政策：允許已認證用戶完整存取
CREATE POLICY "Allow authenticated users full access to billing_relations" 
ON billing_relations 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 更新時自動更新 updated_at
CREATE OR REPLACE FUNCTION update_billing_relations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_billing_relations_updated_at
  BEFORE UPDATE ON billing_relations
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_relations_updated_at();

-- 註解
COMMENT ON TABLE billing_relations IS '代扣關係表：記錄參與者的費用由哪個會員代付';
COMMENT ON COLUMN billing_relations.participant_name IS '參與者名稱（會員暱稱或非會員名字）';
COMMENT ON COLUMN billing_relations.billing_member_id IS '代扣會員的 ID';
COMMENT ON COLUMN billing_relations.notes IS '備註說明';


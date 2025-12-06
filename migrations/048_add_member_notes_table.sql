-- 048_add_member_notes_table.sql
-- 新增會員備忘錄表
-- 用於記錄會員的歷史事件（續約、購買、贈送等）

-- 1. 建立 member_notes 表
CREATE TABLE IF NOT EXISTS member_notes (
  id SERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT '備註',  -- 續約、購買、贈送、使用、入會、備註
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_member_notes_member_id ON member_notes(member_id);
CREATE INDEX IF NOT EXISTS idx_member_notes_event_date ON member_notes(event_date DESC);

-- 3. 建立 RLS 政策
ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;

-- 允許所有認證用戶讀取
CREATE POLICY "member_notes_select_policy" ON member_notes
  FOR SELECT
  TO authenticated
  USING (true);

-- 允許所有認證用戶新增
CREATE POLICY "member_notes_insert_policy" ON member_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 允許所有認證用戶更新
CREATE POLICY "member_notes_update_policy" ON member_notes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 允許所有認證用戶刪除
CREATE POLICY "member_notes_delete_policy" ON member_notes
  FOR DELETE
  TO authenticated
  USING (true);

-- 4. 新增註解
COMMENT ON TABLE member_notes IS '會員備忘錄表：記錄會員的歷史事件';
COMMENT ON COLUMN member_notes.member_id IS '會員 ID';
COMMENT ON COLUMN member_notes.event_date IS '事件日期';
COMMENT ON COLUMN member_notes.event_type IS '事件類型：續約、購買、贈送、使用、入會、備註';
COMMENT ON COLUMN member_notes.description IS '事件說明';

-- 5. 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_member_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_member_notes_updated_at ON member_notes;
CREATE TRIGGER trigger_member_notes_updated_at
  BEFORE UPDATE ON member_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_member_notes_updated_at();


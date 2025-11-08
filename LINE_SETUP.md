# LINE 提醒功能设置指南

## 📋 概述

LINE 提醒功能让会员可以：
- 绑定 LINE 帐号到系统会员资料
- 自动接收明日预约提醒
- 通过 LINE 管理绑定状态

---

## 🚀 快速设置步骤

### Step 1: 设置 LINE Developers

1. 访问 https://developers.line.biz/console/
2. 登录并创建新的 **Messaging API Channel**
3. 填写基本信息：
   - Channel name: ES Wake 预约提醒
   - Channel description: 自动预约提醒系统
   - Category: 选择合适的分类

### Step 2: 获取 Access Token

1. 进入你创建的 Channel → **Messaging API** tab
2. 找到 **Channel access token**
3. 点击 **Issue** 生成 token
4. 复制这个 token（很长的字符串）

### Step 3: 设置 Webhook

1. 在同一个页面找到 **Webhook settings**
2. 设置 Webhook URL 为：
   ```
   https://eswake-booking-v2.vercel.app/api/line-webhook
   ```
3. 开启 **Use webhook**
4. 点击 **Verify** 确认连接成功
5. 关闭 **Auto-reply messages**

### Step 4: 在 Vercel 设置环境变量

1. 登录 Vercel Dashboard
2. 进入你的项目 → **Settings** → **Environment Variables**
3. 添加以下变量：

   | 变量名 | 值 | 说明 |
   |--------|----|----|
   | `VITE_SUPABASE_URL` | https://xxx.supabase.co | Supabase 项目 URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | eyJxxx... | Supabase service_role key |
   | `LINE_CHANNEL_ACCESS_TOKEN` | xxx... | 刚才复制的 LINE token |

4. 所有变量都选择 **Production, Preview, Development**
5. 保存后 **Redeploy** 项目

### Step 5: 设置数据库

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 打开 `line_reminder_setup.sql` 文件
4. 复制所有内容到 SQL Editor
5. 点击 **Run** 执行

这会创建：
- `members.line_user_id` 列
- `system_settings` 表
- `line_bindings` 表（可选）

### Step 6: 在系统中启用

1. 登录你的预约系统
2. 进入 **宝堡** → **LINE 提醒设置**
3. 填入 Channel Access Token
4. 开启 **启用 LINE 提醒**
5. 设置提醒时间（默认 19:00）
6. 保存设置

### Step 7: 设置每日提醒 (Cron Job)

在 Supabase SQL Editor 运行：

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reminder at 7 PM (19:00 UTC+8 = 11:00 UTC)
SELECT cron.schedule(
  'line-daily-reminder',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eswake-booking-v2.vercel.app/api/line-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- 查看 cron job 是否创建成功
SELECT * FROM cron.job;
```

---

## 👥 会员如何使用

### 绑定步骤：

1. **获取 QR Code**
   - 在 LINE Developers Console → Messaging API tab
   - 找到你的 Channel 的 QR Code

2. **会员扫描 QR Code**
   - 加入官方帐号为好友

3. **发送绑定命令**
   - 在 LINE 发送：`綁定 0912345678`
   - 使用自己在系统中登记的电话号码

4. **确认绑定成功**
   - 收到确认消息：「✅ 綁定成功！」

### 其他命令：

- `说明` 或 `幫助` - 查看使用说明
- `取消綁定` - 解除绑定

---

## ✅ 测试

### 测试 Webhook：

访问：https://eswake-booking-v2.vercel.app/api/line-webhook

应该返回：`{"error":"Method not allowed"}`（这是正常的）

### 测试绑定：

1. 用 LINE 扫描 QR Code
2. 发送「说明」→ 应该收到使用说明
3. 发送「綁定 你的电话」→ 应该收到绑定确认

### 测试提醒：

1. 为明天创建一个测试预约
2. 手动触发：https://eswake-booking-v2.vercel.app/api/line-reminder
3. 检查绑定的会员是否收到提醒

---

## 📊 监控

### 查看绑定统计：

系统中 → LINE 提醒设置页面会显示：
- 总会员数
- 已绑定人数
- 绑定比例

### 查看 Vercel Logs：

Vercel Dashboard → Deployments → Functions
可以看到 API 调用记录和错误

### 查看 LINE 用量：

LINE Developers Console → Statistics
可以看到消息发送量（免费版每月 500 条）

---

## 🔧 常见问题

**Q: Webhook 验证失败？**
- 确认 Vercel 部署成功
- 确认环境变量设置正确
- 检查 Webhook URL 没有多余空格

**Q: 绑定失败？**
- 确认电话号码在系统中存在
- 确认会员状态是 'active'
- 检查 Vercel Function logs

**Q: 没有收到提醒？**
- 确认系统设置中已启用
- 确认会员已绑定 LINE
- 确认明天有预约
- 检查 Cron job 是否运行

---

## 🎉 完成！

现在 LINE 提醒功能已经完全设置好了！

会员绑定后，每天会在设定的时间自动收到明日预约提醒。


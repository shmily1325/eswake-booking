# 🔄 ESWake 自动备份到 WD MY BOOK

这个脚本可以自动将完整数据库备份保存到 WD MY BOOK 硬盘。

## 📋 前置要求

1. **Node.js**：需要安装 Node.js（建议 v14 或更高版本）
   - 下载：https://nodejs.org/
   - 验证：在命令行运行 `node --version`

2. **WD MY BOOK 硬盘**：确保硬盘已连接并可以访问

## 🚀 快速开始

### 步骤 1：配置参数

编辑 `scripts/auto-backup-to-wd.js`，修改以下配置：

```javascript
// 1. API 端点（你的 Vercel 部署地址）
const API_URL = 'https://your-app.vercel.app/api/backup-full-database';

// 2. WD MY BOOK 硬盘路径
const WD_MY_BOOK_PATH = 'E:\\ESWake-Backups';  // 修改为你的硬盘路径

// 3. 备份保留天数
const KEEP_DAYS = 90;  // 保留 90 天的备份
```

### 步骤 2：测试运行

在命令行中运行：

```bash
node scripts/auto-backup-to-wd.js
```

如果成功，你应该看到：
- ✅ 备份文件下载到 WD MY BOOK
- ✅ 备份文件保存在 `E:\ESWake-Backups\Full-Database-Backups\` 目录

### 步骤 3：设置自动备份（Windows 任务计划程序）

#### 方法 A：使用批处理文件（推荐）

1. **创建任务计划程序任务**
   - 打开「任务计划程序」（Task Scheduler）
   - 点击「创建基本任务」

2. **配置任务**
   - 名称：`ESWake 自动备份`
   - 触发器：选择「每天」或「每周」
   - 时间：建议设置为凌晨 2:00（系统空闲时）

3. **操作设置**
   - 操作：启动程序
   - 程序或脚本：`C:\path\to\your\project\scripts\auto-backup-to-wd.bat`
   - 起始于：`C:\path\to\your\project`

4. **条件设置**
   - ✅ 只有在计算机使用交流电源时才启动（如果是笔记本电脑）
   - ✅ 唤醒计算机运行此任务

5. **设置**
   - ✅ 允许按需运行任务
   - ✅ 如果任务失败，重新启动任务（最多 3 次）

#### 方法 B：使用 PowerShell 脚本

创建一个 PowerShell 脚本 `auto-backup-scheduled.ps1`：

```powershell
# 切换到项目目录
Set-Location "C:\path\to\your\project"

# 运行备份脚本
node scripts/auto-backup-to-wd.js
```

然后在任务计划程序中运行这个 PowerShell 脚本。

---

## 📁 备份文件结构

备份文件会保存在以下目录结构：

```
E:\ESWake-Backups\
├── Full-Database-Backups\
│   ├── eswake_backup_2025-01-15_02-00-00.sql
│   ├── eswake_backup_2025-01-16_02-00-00.sql
│   └── ...
└── backup-log.txt  (备份日志)
```

---

## ⚙️ 环境变量配置（可选）

你可以通过环境变量覆盖脚本中的配置：

```bash
# Windows (CMD)
set ESWAKE_API_URL=https://your-app.vercel.app/api/backup-full-database
set WD_MY_BOOK_PATH=E:\ESWake-Backups
set BACKUP_KEEP_DAYS=90
set VERBOSE=true

# Windows (PowerShell)
$env:ESWAKE_API_URL="https://your-app.vercel.app/api/backup-full-database"
$env:WD_MY_BOOK_PATH="E:\ESWake-Backups"
$env:BACKUP_KEEP_DAYS="90"
$env:VERBOSE="true"
```

---

## 🔍 故障排除

### 问题 1：找不到 Node.js

**错误**：`'node' 不是内部或外部命令`

**解决**：
1. 确认 Node.js 已安装
2. 将 Node.js 添加到系统 PATH
3. 或在批处理文件中指定完整路径：`set NODE_PATH=C:\Program Files\nodejs\node.exe`

### 问题 2：WD MY BOOK 路径不存在

**错误**：`WD MY BOOK 路径不存在`

**解决**：
1. 确认硬盘已连接
2. 检查硬盘盘符（可能是 E:、F:、G: 等）
3. 修改脚本中的 `WD_MY_BOOK_PATH` 配置

### 问题 3：API 请求失败

**错误**：`下载失败: HTTP 404` 或 `下载失败: HTTP 500`

**解决**：
1. 检查 API_URL 是否正确
2. 确认 Vercel 部署正常
3. 检查网络连接
4. 查看 Vercel 函数日志

### 问题 4：备份文件为空

**错误**：`下载的文件为空`

**解决**：
1. 检查 API 端点是否正常工作
2. 手动访问 API URL 测试
3. 查看 Vercel 函数日志

---

## 📊 监控和日志

### 备份日志

每次备份都会在 `WD_MY_BOOK_PATH/backup-log.txt` 中记录日志：

```
[2025-01-15 02:00:00] ℹ️ ESWake 自动备份开始
[2025-01-15 02:00:01] ℹ️ 开始下载备份文件
[2025-01-15 02:00:05] ✅ 下载完成: 15.23 MB
[2025-01-15 02:00:05] ✅ 备份成功保存
[2025-01-15 02:00:05] ✅ 备份完成！当前共有 5 个备份文件
```

### 查看备份统计

运行脚本时会显示：
- 当前备份文件数量
- 总备份大小
- 清理的旧备份数量

---

## 🔐 安全建议

1. **保护 API 端点**：
   - 考虑添加身份验证
   - 使用环境变量存储敏感信息

2. **备份文件加密**（可选）：
   - 可以使用加密工具加密备份文件
   - 例如：使用 7-Zip 加密压缩

3. **多地点备份**：
   - 本地（WD MY BOOK）
   - 云端（Google Drive、OneDrive）
   - 异地（另一个硬盘）

---

## 📅 备份频率建议

| 频率 | 适用场景 | 保留时间 |
|------|---------|---------|
| 每天 | 生产环境 | 30-90 天 |
| 每周 | 小型业务 | 90-180 天 |
| 每月 | 归档备份 | 永久 |

---

## 🆘 需要帮助？

如果遇到问题：
1. 查看 `backup-log.txt` 日志文件
2. 检查 Windows 任务计划程序的任务历史
3. 手动运行脚本测试：`node scripts/auto-backup-to-wd.js`


# 🤖 自动备份到 WD MY BOOK 设置指南

## 🚀 快速开始（3 步完成）

### 步骤 1：运行设置脚本

在 PowerShell 中（以管理员身份运行）：

```powershell
cd C:\path\to\your\project
.\scripts\setup-auto-backup.ps1
```

### 步骤 2：按照向导配置

脚本会引导你完成：
1. ✅ 输入 Vercel 部署地址
2. ✅ 选择 WD MY BOOK 硬盘盘符
3. ✅ 设置备份保留天数（默认 90 天）
4. ✅ 测试备份
5. ✅ 创建 Windows 任务计划程序任务

### 步骤 3：完成！

系统将自动：
- ✅ 每天凌晨 2:00 自动备份
- ✅ 保存到 WD MY BOOK 硬盘
- ✅ 自动清理超过保留期的旧备份
- ✅ 记录备份日志

---

## 📋 详细设置步骤

### 方法一：使用设置脚本（推荐）

1. **打开 PowerShell（管理员权限）**
   ```powershell
   # 右键点击 PowerShell，选择"以管理员身份运行"
   ```

2. **运行设置脚本**
   ```powershell
   cd "C:\Users\PEI JU PAN\Documents\8_Projects\eswake-booking"
   .\scripts\setup-auto-backup.ps1
   ```

3. **按照提示完成配置**

### 方法二：手动配置

#### 1. 编辑脚本配置

打开 `scripts/auto-backup-to-wd.js`，修改以下配置：

```javascript
// 1. API 端点（你的 Vercel 部署地址）
const API_URL = 'https://your-app.vercel.app/api/backup-full-database';

// 2. WD MY BOOK 硬盘路径
const WD_MY_BOOK_PATH = 'E:\\ESWake-Backups';  // 修改为你的硬盘路径

// 3. 备份保留天数
const KEEP_DAYS = 90;  // 保留 90 天的备份
```

#### 2. 测试运行

```bash
node scripts/auto-backup-to-wd.js
```

#### 3. 创建 Windows 任务计划程序任务

1. 打开「任务计划程序」（Task Scheduler）
2. 点击「创建基本任务」
3. 配置：
   - **名称**：`ESWake 自动备份`
   - **触发器**：每天
   - **时间**：02:00
   - **操作**：启动程序
   - **程序**：`C:\path\to\your\project\scripts\auto-backup-to-wd.bat`
   - **起始于**：`C:\path\to\your\project`

---

## 📁 备份文件位置

备份文件会保存在：

```
E:\ESWake-Backups\
├── Full-Database-Backups\
│   ├── eswake_backup_2025-01-15_02-00-00.sql
│   ├── eswake_backup_2025-01-16_02-00-00.sql
│   └── ...
└── backup-log.txt  (备份日志)
```

---

## ⚙️ 配置选项

### 环境变量（可选）

你可以通过环境变量覆盖脚本配置：

**Windows (CMD)**
```cmd
set ESWAKE_API_URL=https://your-app.vercel.app/api/backup-full-database
set WD_MY_BOOK_PATH=E:\ESWake-Backups
set BACKUP_KEEP_DAYS=90
set VERBOSE=true
```

**Windows (PowerShell)**
```powershell
$env:ESWAKE_API_URL="https://your-app.vercel.app/api/backup-full-database"
$env:WD_MY_BOOK_PATH="E:\ESWake-Backups"
$env:BACKUP_KEEP_DAYS="90"
$env:VERBOSE="true"
```

---

## 🔍 监控和日志

### 查看备份日志

备份日志保存在：`E:\ESWake-Backups\backup-log.txt`

```log
[2025-01-15 02:00:00] ℹ️ ESWake 自动备份开始
[2025-01-15 02:00:01] ℹ️ 开始下载备份文件
[2025-01-15 02:00:05] ✅ 下载完成: 15.23 MB
[2025-01-15 02:00:05] ✅ 备份成功保存
[2025-01-15 02:00:05] ✅ 备份完成！当前共有 5 个备份文件
```

### 查看任务计划程序历史

1. 打开「任务计划程序」
2. 找到「ESWake 自动备份」任务
3. 点击「历史记录」查看运行记录

---

## 🔧 故障排除

### 问题 1：找不到 Node.js

**错误**：`'node' 不是内部或外部命令`

**解决**：
1. 确认 Node.js 已安装：`node --version`
2. 将 Node.js 添加到系统 PATH
3. 或在批处理文件中指定完整路径

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

### 问题 4：任务计划程序任务不运行

**解决**：
1. 检查任务是否已启用
2. 检查任务运行条件（电源、网络等）
3. 手动运行任务测试
4. 查看任务历史记录中的错误信息

---

## 📊 备份统计

运行脚本时会显示：
- ✅ 当前备份文件数量
- ✅ 总备份大小
- ✅ 清理的旧备份数量

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
4. 查看详细文档：`scripts/README_AUTO_BACKUP.md`


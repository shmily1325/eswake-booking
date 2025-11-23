#!/usr/bin/env node

/**
 * ESWake 自动备份脚本
 * 功能：定期将完整数据库备份保存到 WD MY BOOK 硬盘
 * 
 * 使用方法：
 * 1. 安装依赖：npm install node-fetch
 * 2. 配置下面的参数
 * 3. 运行：node scripts/auto-backup-to-wd.js
 * 4. 设置 Windows 任务计划程序自动运行（可选）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================
// 配置参数（请根据实际情况修改）
// ============================================

// 1. API 端点（你的 Vercel 部署地址）
const API_URL = process.env.ESWAKE_API_URL || 'https://your-app.vercel.app/api/backup-full-database';

// 2. WD MY BOOK 硬盘路径（Windows）
// 例如：'E:\\' 或 'D:\\Backups\\ESWake'
const WD_MY_BOOK_PATH = process.env.WD_MY_BOOK_PATH || 'E:\\ESWake-Backups';

// 3. 备份保留天数（超过此天数的备份将被删除）
const KEEP_DAYS = parseInt(process.env.BACKUP_KEEP_DAYS || '90', 10);

// 4. 是否启用详细日志
const VERBOSE = process.env.VERBOSE === 'true';

// ============================================
// 工具函数
// ============================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || 'ℹ️';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
  
  // 同时写入日志文件
  const logFile = path.join(WD_MY_BOOK_PATH, 'backup-log.txt');
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${prefix} ${message}\n`, 'utf8');
  } catch (err) {
    // 如果无法写入日志文件，忽略错误
  }
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`创建目录: ${dirPath}`, 'info');
  }
}

function getBackupFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `eswake_backup_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.sql`;
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    
    log(`开始下载备份文件: ${url}`, 'info');
    
    const file = fs.createWriteStream(outputPath);
    
    // 使用 GET 请求（API 已支持 GET）
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'ESWake-AutoBackup/1.0'
      }
    };
    
    const req = protocol.request(options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // 处理重定向
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (VERBOSE && totalSize > 0) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r下载进度: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
        }
      });
      
      response.on('end', () => {
        if (VERBOSE) console.log('');
        file.close();
        log(`下载完成: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`, 'success');
        resolve(downloadedSize);
      });
      
      response.pipe(file);
    });
    
    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(err);
    });
    
    req.end();
  });
}

function cleanupOldBackups(backupDir, keepDays) {
  try {
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const maxAge = keepDays * 24 * 60 * 60 * 1000; // 转换为毫秒
    
    let deletedCount = 0;
    let freedSpace = 0;
    
    files.forEach(file => {
      if (!file.endsWith('.sql')) return;
      
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > maxAge) {
        const size = stats.size;
        fs.unlinkSync(filePath);
        deletedCount++;
        freedSpace += size;
        log(`删除旧备份: ${file} (${(age / 1000 / 60 / 60 / 24).toFixed(1)} 天前)`, 'warning');
      }
    });
    
    if (deletedCount > 0) {
      log(`清理完成: 删除 ${deletedCount} 个旧备份，释放 ${(freedSpace / 1024 / 1024).toFixed(2)} MB`, 'success');
    }
  } catch (err) {
    log(`清理旧备份时出错: ${err.message}`, 'error');
  }
}

function getBackupStats(backupDir) {
  try {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
    let totalSize = 0;
    let oldestDate = null;
    let newestDate = null;
    
    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      
      const mtime = stats.mtime;
      if (!oldestDate || mtime < oldestDate) oldestDate = mtime;
      if (!newestDate || mtime > newestDate) newestDate = mtime;
    });
    
    return {
      count: files.length,
      totalSize,
      oldestDate,
      newestDate
    };
  } catch (err) {
    return { count: 0, totalSize: 0, oldestDate: null, newestDate: null };
  }
}

// ============================================
// 主函数
// ============================================

async function main() {
  log('='.repeat(60), 'info');
  log('ESWake 自动备份开始', 'info');
  log('='.repeat(60), 'info');
  
  // 检查 WD MY BOOK 路径
  if (!fs.existsSync(WD_MY_BOOK_PATH)) {
    log(`WD MY BOOK 路径不存在: ${WD_MY_BOOK_PATH}`, 'error');
    log('请检查硬盘是否已连接，或修改脚本中的 WD_MY_BOOK_PATH 配置', 'error');
    process.exit(1);
  }
  
  // 确保备份目录存在
  const backupDir = path.join(WD_MY_BOOK_PATH, 'Full-Database-Backups');
  ensureDirectory(backupDir);
  
  // 显示当前备份统计
  const stats = getBackupStats(backupDir);
  if (stats.count > 0) {
    log(`当前备份统计: ${stats.count} 个文件, 总计 ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`, 'info');
  }
  
  // 生成备份文件名
  const fileName = getBackupFileName();
  const filePath = path.join(backupDir, fileName);
  
  try {
    // 下载备份文件
    await downloadFile(API_URL, filePath);
    
    // 验证文件
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('下载的文件为空');
    }
    
    log(`备份成功保存: ${filePath}`, 'success');
    log(`文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'success');
    
    // 清理旧备份
    log(`清理超过 ${KEEP_DAYS} 天的旧备份...`, 'info');
    cleanupOldBackups(backupDir, KEEP_DAYS);
    
    // 显示最终统计
    const finalStats = getBackupStats(backupDir);
    log(`备份完成！当前共有 ${finalStats.count} 个备份文件`, 'success');
    
  } catch (error) {
    log(`备份失败: ${error.message}`, 'error');
    if (error.stack && VERBOSE) {
      log(error.stack, 'error');
    }
    process.exit(1);
  }
  
  log('='.repeat(60), 'info');
  log('ESWake 自动备份完成', 'success');
  log('='.repeat(60), 'info');
}

// 运行主函数
if (require.main === module) {
  main().catch(err => {
    log(`未处理的错误: ${err.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { main };


#!/usr/bin/env node

/**
 * ESWake 自動備份腳本
 * 功能：定期將完整資料庫備份保存到 WD MY BOOK 硬碟
 * 
 * 使用方法：
 * 1. 安裝依賴：npm install node-fetch
 * 2. 配置下面的參數
 * 3. 執行：node scripts/auto-backup-to-wd.cjs
 * 4. 設定 Windows 工作排程器自動執行（可選）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================
// 配置參數（請根據實際情況修改）
// ============================================

// 1. API 端點（你的 Vercel 部署地址）
const API_URL = process.env.ESWAKE_API_URL || 'https://eswake-booking.vercel.app/api/backup-full-database';

// 2. WD MY BOOK 硬碟路徑（Windows）
// 例如：'E:\\' 或 'D:\\Backups\\ESWake'
const WD_MY_BOOK_PATH = process.env.WD_MY_BOOK_PATH || 'D:\\0_eswake_bookingSystem_backup';

// 3. 備份保留天數（超過此天數的備份將被刪除）
const KEEP_DAYS = parseInt(process.env.BACKUP_KEEP_DAYS || '90', 10);

// 4. 是否啟用詳細日誌
const VERBOSE = process.env.VERBOSE === 'true';

// ============================================
// 工具函數
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
  
  // 同時寫入日誌檔案
  const logFile = path.join(WD_MY_BOOK_PATH, 'backup-log.txt');
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${prefix} ${message}\n`, 'utf8');
  } catch (err) {
    // 如果無法寫入日誌檔案，忽略錯誤
  }
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`建立目錄: ${dirPath}`, 'info');
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
    
    log(`開始下載備份檔案: ${url}`, 'info');
    
    const file = fs.createWriteStream(outputPath);
    
    // 使用 GET 請求（API 已支援 GET）
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
        // 處理重定向
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error(`下載失敗: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (VERBOSE && totalSize > 0) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r下載進度: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
        }
      });
      
      response.on('end', () => {
        if (VERBOSE) console.log('');
        file.close();
        log(`下載完成: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`, 'success');
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
    const maxAge = keepDays * 24 * 60 * 60 * 1000; // 轉換為毫秒
    
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
        log(`刪除舊備份: ${file} (${(age / 1000 / 60 / 60 / 24).toFixed(1)} 天前)`, 'warning');
      }
    });
    
    if (deletedCount > 0) {
      log(`清理完成: 刪除 ${deletedCount} 個舊備份，釋放 ${(freedSpace / 1024 / 1024).toFixed(2)} MB`, 'success');
    }
  } catch (err) {
    log(`清理舊備份時出錯: ${err.message}`, 'error');
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
// 主函數
// ============================================

async function main() {
  log('='.repeat(60), 'info');
  log('ESWake 自動備份開始', 'info');
  log('='.repeat(60), 'info');
  
  // 檢查 WD MY BOOK 路徑
  if (!fs.existsSync(WD_MY_BOOK_PATH)) {
    log(`WD MY BOOK 路徑不存在: ${WD_MY_BOOK_PATH}`, 'error');
    log('請檢查硬碟是否已連接，或修改腳本中的 WD_MY_BOOK_PATH 配置', 'error');
    process.exit(1);
  }
  
  // 確保備份目錄存在
  const backupDir = path.join(WD_MY_BOOK_PATH, 'Full-Database-Backups');
  ensureDirectory(backupDir);
  
  // 顯示目前備份統計
  const stats = getBackupStats(backupDir);
  if (stats.count > 0) {
    log(`目前備份統計: ${stats.count} 個檔案, 總計 ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`, 'info');
  }
  
  // 產生備份檔案名稱
  const fileName = getBackupFileName();
  const filePath = path.join(backupDir, fileName);
  
  try {
    // 下載備份檔案
    await downloadFile(API_URL, filePath);
    
    // 驗證檔案
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('下載的檔案為空');
    }
    
    log(`備份成功保存: ${filePath}`, 'success');
    log(`檔案大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'success');
    
    // 清理舊備份
    log(`清理超過 ${KEEP_DAYS} 天的舊備份...`, 'info');
    cleanupOldBackups(backupDir, KEEP_DAYS);
    
    // 顯示最終統計
    const finalStats = getBackupStats(backupDir);
    log(`備份完成！目前共有 ${finalStats.count} 個備份檔案`, 'success');
    
  } catch (error) {
    log(`備份失敗: ${error.message}`, 'error');
    if (error.stack && VERBOSE) {
      log(error.stack, 'error');
    }
    process.exit(1);
  }
  
  log('='.repeat(60), 'info');
  log('ESWake 自動備份完成', 'success');
  log('='.repeat(60), 'info');
}

// 執行主函數
if (require.main === module) {
  main().catch(err => {
    log(`未處理的錯誤: ${err.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { main };


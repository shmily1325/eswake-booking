import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useToast, ToastContainer } from '../../components/ui'
import { useResponsive } from '../../hooks/useResponsive'
import { isAdmin } from '../../utils/auth'
import {
  designSystem,
  getButtonStyle,
  getCardStyle,
  getPageContentShellStyle,
  PAGE_MAX_WIDTHS,
} from '../../styles/designSystem'

interface BackupLog {
  id: number
  backup_type: string
  status: string
  records_count: number | null
  file_name: string | null
  file_size: string | null
  file_url: string | null
  error_message: string | null
  execution_time: number | null
  created_at: string | null
}

type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown'

function getBackupHealth(logs: BackupLog[]): {
  status: HealthStatus
  message: string
  color: string
  light: string
} {
  if (logs.length === 0) {
    return {
      status: 'unknown',
      message: '尚無備份記錄',
      color: designSystem.colors.text.secondary,
      light: designSystem.colors.border.main,
    }
  }

  const latestBackup = logs[0]
  if (!latestBackup.created_at) {
    return {
      status: 'unknown',
      message: '備份時間未知',
      color: designSystem.colors.text.secondary,
      light: designSystem.colors.border.main,
    }
  }

  const hoursSinceLastBackup =
    (Date.now() - new Date(latestBackup.created_at).getTime()) / (1000 * 60 * 60)

  if (latestBackup.status === 'failed') {
    return {
      status: 'error',
      message: '最近一次備份失敗',
      color: designSystem.colors.danger[700],
      light: designSystem.colors.danger[500],
    }
  }

  if (hoursSinceLastBackup > 48) {
    return {
      status: 'warning',
      message: `超過 ${Math.floor(hoursSinceLastBackup)} 小時未備份`,
      color: designSystem.colors.warning[700],
      light: designSystem.colors.warning[500],
    }
  }

  if (hoursSinceLastBackup > 24) {
    return {
      status: 'warning',
      message: `${Math.floor(hoursSinceLastBackup)} 小時前備份`,
      color: designSystem.colors.warning[700],
      light: designSystem.colors.warning[500],
    }
  }

  return {
    status: 'ok',
    message: '備份正常',
    color: designSystem.colors.success[700],
    light: designSystem.colors.success[500],
  }
}

function formatLogTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function getBackupRequestHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('請先登入')

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export function BackupPage() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [fullBackupLoading, setFullBackupLoading] = useState(false)
  const [cloudBackupLoading, setCloudBackupLoading] = useState(false)
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([])
  const [backupLogsLoading, setBackupLogsLoading] = useState(true)

  useEffect(() => {
    if (user && !isAdmin(user)) {
      toast.error('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [user, navigate, toast])

  const fetchBackupLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('載入備份記錄失敗:', error)
        return
      }

      setBackupLogs(data || [])
    } catch (err) {
      console.error('載入備份記錄失敗:', err)
    } finally {
      setBackupLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBackupLogs()
  }, [fetchBackupLogs])

  const backupHealth = getBackupHealth(backupLogs)
  const isAnyLoading = fullBackupLoading || cloudBackupLoading
  const lastSuccess = backupLogs.find((log) => log.status === 'success')

  const backupFullDatabase = async () => {
    setFullBackupLoading(true)
    try {
      const headers = await getBackupRequestHeaders()
      const response = await fetch('/api/backup-full-database', {
        method: 'POST',
        headers,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '備份失敗')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
      link.download = `eswake_backup_${timestamp}.sql`
      link.click()
      URL.revokeObjectURL(url)

      toast.success('完整資料庫備份成功！檔案已下載。')
    } catch (error) {
      console.error('Full backup error:', error)
      toast.error(`備份失敗：${(error as Error).message}`)
    } finally {
      setFullBackupLoading(false)
    }
  }

  const backupToCloudDrive = async () => {
    setCloudBackupLoading(true)
    try {
      const headers = await getBackupRequestHeaders()
      const response = await fetch('/api/backup-to-cloud-drive', {
        method: 'POST',
        headers,
      })

      if (!response.ok) {
        const error = await response.json()

        if (error.errorCode === 'INVALID_GRANT' && error.solution) {
          const solutionText = error.solution.steps.join('\n') + '\n\n' + error.solution.documentation
          toast.error(`${error.error}\n\n${error.message}\n\n${solutionText}`, 10000)
          if (confirm('是否要開啟取得新刷新令牌的頁面？')) {
            window.open('/api/oauth2-auth-url', '_blank')
          }
          return
        }

        throw new Error(error.message || error.error || '備份失敗')
      }

      const result = await response.json()

      if (result.fileUrl) {
        toast.success(
          `${result.message}\n\n` +
            `檔案名稱: ${result.fileName}\n` +
            `檔案大小: ${result.fileSize ? `${(parseInt(result.fileSize) / 1024).toFixed(2)} KB` : '未知'}\n` +
            `總記錄數: ${result.totalRecords} 筆\n\n` +
            `點擊確定後將在新視窗開啟 Google Drive`,
        )
        window.open(result.fileUrl, '_blank')
      } else {
        toast.success(result.message)
      }

      await fetchBackupLogs()
    } catch (error) {
      console.error('Cloud backup error:', error)
      toast.error(`備份失敗：${(error as Error).message}`, 5000)
    } finally {
      setCloudBackupLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: designSystem.colors.background.main,
        padding: isMobile ? '12px 16px' : 20,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={getPageContentShellStyle(isMobile, PAGE_MAX_WIDTHS.focused)}>
        <PageHeader title="備份" user={user} showBaoLink={isAdmin(user)} />

        <section style={{ marginBottom: isMobile ? 28 : 36 }}>
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: designSystem.colors.text.secondary,
            }}
          >
            狀態
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              aria-hidden
              title={
                backupHealth.status === 'ok'
                  ? '綠燈'
                  : backupHealth.status === 'warning'
                    ? '黃燈'
                    : backupHealth.status === 'error'
                      ? '紅燈'
                      : '無資料'
              }
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: backupHealth.light,
                flexShrink: 0,
                boxShadow:
                  backupHealth.status === 'unknown'
                    ? 'none'
                    : `0 0 0 3px ${backupHealth.light}33`,
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? 22 : 28,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: backupHealth.color,
                lineHeight: 1.25,
              }}
            >
              {backupHealth.message}
            </h2>
          </div>
          {lastSuccess?.created_at && (
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: 14,
                color: designSystem.colors.text.secondary,
                lineHeight: 1.5,
              }}
            >
              最近成功 {new Date(lastSuccess.created_at).toLocaleString('zh-TW')}
              {lastSuccess.records_count != null
                ? ` · ${lastSuccess.records_count.toLocaleString()} 筆`
                : ''}
            </p>
          )}
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: 13,
              color: designSystem.colors.text.secondary,
              lineHeight: 1.5,
            }}
          >
            系統每天自動備份（台灣時間 02:00）
          </p>
            {(backupHealth.status === 'error' || backupHealth.status === 'warning') && (
              <p
                style={{
                  margin: '12px 0 0 0',
                  fontSize: 14,
                  fontWeight: 500,
                  color: backupHealth.color,
                  lineHeight: 1.5,
                }}
              >
                {backupHealth.status === 'error' ? '請通知工程師' : '請手動備份'}
              </p>
            )}
        </section>

        <section style={getCardStyle(isMobile)}>
          <h3
            style={{
              margin: '0 0 4px 0',
              fontSize: 16,
              fontWeight: 600,
              color: designSystem.colors.text.primary,
            }}
          >
            最近記錄
          </h3>
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: 13,
              color: designSystem.colors.text.secondary,
            }}
          >
            最近幾次自動或手動備份結果
          </p>

          {backupLogsLoading ? (
            <p style={{ margin: 0, fontSize: 14, color: designSystem.colors.text.secondary }}>
              載入中…
            </p>
          ) : backupLogs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: designSystem.colors.text.secondary }}>
              尚無備份記錄。可先執行一次雲端備份。
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {backupLogs.slice(0, 7).map((log, index, list) => {
                const ok = log.status === 'success'
                return (
                  <li
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      padding: '12px 0',
                      borderBottom:
                        index < list.length - 1
                          ? `1px solid ${designSystem.colors.border.light}`
                          : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: designSystem.colors.text.primary,
                        }}
                      >
                        {formatLogTime(log.created_at)}
                      </div>
                      {!ok && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: designSystem.colors.danger[700],
                            lineHeight: 1.4,
                          }}
                        >
                          {log.error_message?.substring(0, 80) || '未知錯誤'}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        color: ok
                          ? designSystem.colors.text.secondary
                          : designSystem.colors.danger[700],
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: ok
                            ? designSystem.colors.success[500]
                            : designSystem.colors.danger[500],
                        }}
                      />
                      {ok
                        ? [
                            log.records_count != null
                              ? `${log.records_count.toLocaleString()} 筆`
                              : '成功',
                            log.execution_time != null
                              ? `${(log.execution_time / 1000).toFixed(1)}s`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : '失敗'}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section style={{ marginTop: isMobile ? 8 : 4, marginBottom: isMobile ? 24 : 32 }}>
          <h3
            style={{
              margin: '0 0 6px 0',
              fontSize: 16,
              fontWeight: 600,
              color: designSystem.colors.text.primary,
            }}
          >
            手動備份
          </h3>
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: 13,
              color: designSystem.colors.text.secondary,
              lineHeight: 1.5,
            }}
          >
            雲端備份會上傳到 Google Drive；下載則保存完整 SQL 到本機，可載入離線查詢工具。
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 10,
            }}
          >
            <button
              type="button"
              data-track="backup_cloud_drive"
              onClick={backupToCloudDrive}
              disabled={isAnyLoading}
              style={{
                ...getButtonStyle('primary', 'large', isMobile),
                flex: isMobile ? undefined : 1,
                width: isMobile ? '100%' : undefined,
                opacity: isAnyLoading ? 0.6 : 1,
                cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {cloudBackupLoading ? '上傳中…' : '備份到 Google Drive'}
            </button>
            <button
              type="button"
              data-track="backup_full_download"
              onClick={backupFullDatabase}
              disabled={isAnyLoading}
              style={{
                ...getButtonStyle('secondary', 'large', isMobile),
                flex: isMobile ? undefined : 1,
                width: isMobile ? '100%' : undefined,
                opacity: isAnyLoading ? 0.6 : 1,
                cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {fullBackupLoading ? '備份中…' : '下載完整資料庫 (SQL)'}
            </button>
            <button
              type="button"
              onClick={() => window.open('/offline', '_blank', 'noopener,noreferrer')}
              style={{
                ...getButtonStyle('secondary', 'large', isMobile),
                flex: isMobile ? undefined : 1,
                width: isMobile ? '100%' : undefined,
              }}
            >
              開啟離線查詢
            </button>
          </div>
        </section>

        <Footer />
      </div>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

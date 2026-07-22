import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useToast, ToastContainer } from '../../components/ui'
import { useResponsive } from '../../hooks/useResponsive'
import { isAdmin } from '../../utils/auth'
import { getBackupHealth } from '../../utils/backupHealth'
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
  destination: string | null
  status: string
  records_count: number | null
  file_name: string | null
  file_size: string | null
  file_size_bytes: number | null
  checksum: string | null
  format_version: number | null
  file_url: string | null
  error_message: string | null
  execution_time: number | null
  created_at: string | null
}

interface StorageBackupResponse {
  complete?: boolean
  busy?: boolean
  phase?: string
  scanned?: number
  processed?: number
  remaining?: number
  message?: string
  error?: string
  manifest?: {
    fileCount?: number
  }
}

type BackupDestination =
  | 'google_drive'
  | 'wd_local'
  | 'google_drive_storage'
  | 'wd_local_storage'
  | 'manual_download'
  | 'other'

function getLogDestination(log: BackupLog): BackupDestination {
  if (log.destination === 'google_drive_storage') return 'google_drive_storage'
  if (log.destination === 'wd_local_storage') return 'wd_local_storage'
  if (log.destination === 'google_drive' || log.backup_type === 'cloud_drive') return 'google_drive'
  if (log.destination === 'wd_local') return 'wd_local'
  if (log.destination === 'manual_download' || log.backup_type === 'full_database')
    return 'manual_download'
  return 'other'
}

function destinationLabel(log: BackupLog): string {
  const destination = getLogDestination(log)
  if (destination === 'google_drive') return 'Google Drive'
  if (destination === 'wd_local') return '桌機備份'
  if (destination === 'google_drive_storage') return 'Google Drive 商品圖片'
  if (destination === 'wd_local_storage') return '桌機商品圖片'
  if (destination === 'manual_download') return '手動下載'
  return log.backup_type
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

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
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

function storagePhaseLabel(phase: string): string {
  if (phase === 'inventory') return '建立商品圖片清單'
  if (phase === 'sync') return '同步商品圖片'
  if (phase === 'reconcile') return '整理已刪除圖片'
  if (phase === 'manifest') return '產生完整性清單'
  if (phase === 'cleanup') return '完成 Google Drive 清單切換'
  return '處理商品圖片備份'
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export function BackupPage() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [fullBackupLoading, setFullBackupLoading] = useState(false)
  const [cloudBackupLoading, setCloudBackupLoading] = useState(false)
  const [storageBackupLoading, setStorageBackupLoading] = useState(false)
  const [storageBackupProgress, setStorageBackupProgress] = useState<string | null>(null)
  const storageBackupCancelRef = useRef(false)
  const storageRequestControllerRef = useRef<AbortController | null>(null)
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
      const healthDestinations = [
        'google_drive',
        'google_drive_storage',
        'wd_local',
        'wd_local_storage',
      ]
      const results = await Promise.all([
        supabase
          .from('backup_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30),
        ...healthDestinations.map((destination) =>
          supabase
            .from('backup_logs')
            .select('*')
            .eq('destination', destination)
            .order('created_at', { ascending: false })
            .limit(30),
        ),
      ])
      const failedResult = results.find((result) => result.error)
      if (failedResult?.error) {
        console.error('載入備份記錄失敗:', failedResult.error)
        return
      }
      const uniqueLogs = new Map<number, BackupLog>()
      results.forEach((result) => {
        const logs = result.data || []
        logs.forEach((log) => uniqueLogs.set(log.id, log as BackupLog))
      })
      setBackupLogs(
        Array.from(uniqueLogs.values()).sort(
          (left, right) =>
            new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime(),
        ),
      )
    } catch (err) {
      console.error('載入備份記錄失敗:', err)
    } finally {
      setBackupLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBackupLogs()
  }, [fetchBackupLogs])

  const cloudLogs = backupLogs.filter((log) => getLogDestination(log) === 'google_drive')
  const wdLogs = backupLogs.filter((log) => getLogDestination(log) === 'wd_local')
  const cloudStorageLogs = backupLogs.filter(
    (log) => getLogDestination(log) === 'google_drive_storage',
  )
  const wdStorageLogs = backupLogs.filter((log) => getLogDestination(log) === 'wd_local_storage')
  const isAnyLoading = fullBackupLoading || cloudBackupLoading || storageBackupLoading
  const backupDestinations = [
    {
      label: 'Google Drive',
      schedule: '資料庫每天 02:00 · 商品圖片每天 02:30',
      items: [
        { label: '資料庫', logs: cloudLogs },
        { label: '商品圖片', logs: cloudStorageLogs },
      ],
    },
    {
      label: '桌機備份',
      schedule: '每天 10:00，未登入則略過',
      items: [
        { label: '資料庫', logs: wdLogs },
        { label: '商品圖片', logs: wdStorageLogs },
      ],
    },
  ].map((destination) => ({
    ...destination,
    items: destination.items.map((item) => {
      const health = getBackupHealth(item.logs)
      const unconfigured = destination.label === '桌機備份' && item.logs.length === 0
      return {
        ...item,
        unconfigured,
        health: unconfigured ? { ...health, message: '未設定' } : health,
        lastSuccess: item.logs.find((log) => log.status === 'success'),
      }
    }),
  }))

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
      const expectedChecksum = response.headers.get('X-Backup-SHA256')?.toLowerCase()
      if (!expectedChecksum?.match(/^[a-f0-9]{64}$/)) {
        throw new Error('伺服器未提供有效的備份校驗碼')
      }
      const actualChecksum = await sha256Hex(blob)
      if (actualChecksum !== expectedChecksum) {
        throw new Error('下載檔案校驗失敗，已取消保存')
      }

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
          const solutionText =
            error.solution.steps.join('\n') + '\n\n' + error.solution.documentation
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

  const backupStorageToCloudDrive = async () => {
    storageBackupCancelRef.current = false
    setStorageBackupLoading(true)
    setStorageBackupProgress('準備商品圖片同步…')
    try {
      const maximumRounds = 100
      let timeoutRetries = 0
      let busyWaits = 0
      let round = 0
      let complete = false

      while (round < maximumRounds && !storageBackupCancelRef.current) {
        const headers = await getBackupRequestHeaders()
        const controller = new AbortController()
        storageRequestControllerRef.current = controller
        const requestTimeout = window.setTimeout(() => controller.abort(), 310_000)
        let response: Response
        try {
          response = await fetch('/api/backup-storage?mode=cloud', {
            method: 'POST',
            headers,
            signal: controller.signal,
          })
        } catch (error) {
          if (storageBackupCancelRef.current) break
          if (timeoutRetries < 3) {
            timeoutRetries += 1
            setStorageBackupProgress(`網路中斷，自動重試 ${timeoutRetries}/3…`)
            await wait(1500)
            continue
          }
          throw error
        } finally {
          window.clearTimeout(requestTimeout)
          storageRequestControllerRef.current = null
        }

        const responseText = await response.text()
        let result: StorageBackupResponse
        try {
          result = JSON.parse(responseText) as StorageBackupResponse
        } catch {
          result = { error: responseText || `HTTP ${response.status}` }
        }
        if (!response.ok) {
          const message = result.message || result.error || '商品圖片備份失敗'
          if (/timeout|aborted/i.test(message) && timeoutRetries < 3) {
            timeoutRetries += 1
            setStorageBackupProgress(`單張圖片逾時，自動重試 ${timeoutRetries}/3…`)
            await wait(1500)
            continue
          }
          throw new Error(message)
        }

        timeoutRetries = 0
        if (result.complete) {
          complete = true
          toast.success(`商品圖片已同步到 Google Drive，共 ${result.manifest?.fileCount ?? 0} 個檔案。`)
          break
        }
        if (result.busy) {
          busyWaits += 1
          if (busyWaits > 180) throw new Error('等待其他同步工作超過 6 分鐘')
          setStorageBackupProgress('已有同步工作執行中，正在等待…')
          await wait(2000)
          continue
        }

        busyWaits = 0
        round += 1
        const phaseLabel = storagePhaseLabel(result.phase || '')
        const progress =
          result.phase === 'inventory'
            ? `本次新增清點 ${result.scanned ?? 0} 個，目前共 ${result.manifest?.fileCount ?? 0} 個`
            : result.phase === 'sync'
              ? `本次處理 ${result.processed ?? 0} 個，尚有 ${result.remaining ?? 0} 個`
              : '本階段已完成'
        setStorageBackupProgress(`${phaseLabel}：${progress}（第 ${round} 批）`)
        if (round % 5 === 0) await fetchBackupLogs()
        await wait(750)
      }

      if (storageBackupCancelRef.current) {
        toast.info('已停止自動續跑；目前進度已保存。', 5000)
      } else if (!complete) {
        toast.info('自動同步已達 100 批，進度已保存；可再按一次繼續。', 7000)
      }
      await fetchBackupLogs()
    } catch (error) {
      console.error('Storage backup error:', error)
      toast.error(`商品圖片備份失敗：${(error as Error).message}`, 5000)
    } finally {
      storageRequestControllerRef.current = null
      setStorageBackupProgress(null)
      setStorageBackupLoading(false)
    }
  }

  const cancelStorageBackup = () => {
    storageBackupCancelRef.current = true
    storageRequestControllerRef.current?.abort()
    setStorageBackupProgress('正在停止自動續跑…')
  }

  const downloadOfflineTool = async () => {
    try {
      const response = await fetch('/offline.html', { cache: 'no-store' })
      if (!response.ok) throw new Error('無法取得離線工具')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'eswake-offline.html'
      link.click()
      URL.revokeObjectURL(url)
      toast.success('離線工具已下載，請與最新 SQL 備份一起保存。')
    } catch (error) {
      toast.error(`下載失敗：${(error as Error).message}`)
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
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            {backupDestinations.map(({ label, items, schedule }) => (
              <div
                key={label}
                style={{
                  padding: isMobile ? 16 : 18,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  borderRadius: 12,
                  background: designSystem.colors.background.card,
                }}
              >
                <h2
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: 16,
                    fontWeight: 600,
                    color: designSystem.colors.text.primary,
                  }}
                >
                  {label}
                </h2>
                {items.map(({ label: itemLabel, health, lastSuccess, unconfigured }) => (
                  <div
                    key={itemLabel}
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: `1px solid ${designSystem.colors.border.light}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                        }}
                      >
                        <span
                          aria-hidden
                          title={
                            health.status === 'ok'
                              ? '綠燈'
                              : health.status === 'warning'
                                ? '黃燈'
                                : health.status === 'error'
                                  ? '紅燈'
                                  : '無資料'
                          }
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: health.light,
                            flexShrink: 0,
                            boxShadow:
                              health.status === 'unknown' ? 'none' : `0 0 0 3px ${health.light}33`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: designSystem.colors.text.primary,
                          }}
                        >
                          {itemLabel}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: health.color,
                          textAlign: 'right',
                        }}
                      >
                        {health.message}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '7px 0 0 18px',
                        fontSize: 13,
                        color: designSystem.colors.text.secondary,
                        lineHeight: 1.5,
                      }}
                    >
                      {lastSuccess?.created_at
                        ? `最近成功 ${new Date(lastSuccess.created_at).toLocaleString('zh-TW')}${
                            lastSuccess.records_count != null
                              ? ` · ${lastSuccess.records_count.toLocaleString()} 筆`
                              : ''
                          }`
                        : unconfigured
                          ? '桌機安裝完成後才會開始記錄'
                          : '尚無成功記錄'}
                    </p>
                    {(health.status === 'error' || health.status === 'warning') && (
                      <p
                        style={{
                          margin: '5px 0 0 18px',
                          fontSize: 13,
                          fontWeight: 500,
                          color: health.color,
                          lineHeight: 1.5,
                        }}
                      >
                        {health.status === 'error' ? '請通知工程師' : '請檢查該備份項目'}
                      </p>
                    )}
                  </div>
                ))}
                <p
                  style={{
                    margin: '14px 0 0 0',
                    fontSize: 13,
                    color: designSystem.colors.text.secondary,
                    lineHeight: 1.5,
                  }}
                >
                  {schedule}
                </p>
              </div>
            ))}
          </div>
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
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: designSystem.colors.text.secondary,
              }}
            >
              載入中…
            </p>
          ) : backupLogs.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: designSystem.colors.text.secondary,
              }}
            >
              尚無備份記錄。可先執行一次雲端備份。
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {backupLogs.slice(0, 7).map((log, index, list) => {
                const ok = log.status === 'success'
                const running = log.status === 'running'
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
                        {destinationLabel(log)} · {formatLogTime(log.created_at)}
                        {log.checksum ? ` · ${log.checksum.slice(0, 10)}…` : ''}
                      </div>
                      {!ok && !running && (
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
                          : running
                            ? designSystem.colors.warning[700]
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
                            : running
                              ? designSystem.colors.warning[500]
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
                        : running
                          ? '同步中'
                          : '失敗'}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section
          style={{
            marginTop: isMobile ? 8 : 4,
            marginBottom: isMobile ? 24 : 32,
          }}
        >
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
            雲端資料庫與商品圖片可分別立即執行；下載則保存完整 SQL 到本機。
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
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
              {cloudBackupLoading ? '資料庫上傳中…' : '備份資料庫到 Google Drive'}
            </button>
            <button
              type="button"
              data-track="backup_cloud_storage"
              onClick={storageBackupLoading ? cancelStorageBackup : backupStorageToCloudDrive}
              disabled={fullBackupLoading || cloudBackupLoading}
              title={storageBackupProgress || undefined}
              style={{
                ...getButtonStyle(storageBackupLoading ? 'danger' : 'primary', 'large', isMobile),
                width: '100%',
                opacity: fullBackupLoading || cloudBackupLoading ? 0.6 : 1,
                cursor: fullBackupLoading || cloudBackupLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {storageBackupLoading
                ? '停止圖片同步（進度會保留）'
                : '同步商品圖片到 Google Drive'}
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
              onClick={downloadOfflineTool}
              style={{
                ...getButtonStyle('secondary', 'large', isMobile),
                flex: isMobile ? undefined : 1,
                width: isMobile ? '100%' : undefined,
              }}
            >
              下載離線工具
            </button>
          </div>
          {storageBackupLoading && storageBackupProgress && (
            <p
              aria-live="polite"
              style={{
                margin: '10px 0 0',
                fontSize: 13,
                color: designSystem.colors.text.secondary,
                lineHeight: 1.5,
              }}
            >
              {storageBackupProgress}
            </p>
          )}
          <p
            style={{
              margin: '14px 0 0',
              fontSize: 13,
              color: designSystem.colors.text.secondary,
              lineHeight: 1.5,
            }}
          >
            桌機安裝後如需手動備份，請在 Windows 工作排程器執行「ESWake 自動備份」；
            資料庫與商品圖片會一起備份。
          </p>
        </section>

        <Footer />
      </div>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { createHash, randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import {
  authorizeBackupRequest,
  setBackupResponseHeaders,
} from '../src/server/backup-auth.js'
import {
  STORAGE_BACKUP_BUCKET,
  STORAGE_BACKUP_FORMAT_VERSION,
  storageEntryChanged,
  type StorageBackupEntry,
  type StorageBackupManifest,
} from '../src/server/backup-storage.js'

const TIME_BUDGET_MS = 240_000
const STATE_PAGE_SIZE = 1000
const INVENTORY_PAGE_SIZE = 500
const SYNC_PAGE_SIZE = 50
const DEFAULT_KEEP_DAYS = 90
const GOOGLE_METADATA_TIMEOUT_MS = 5_000
const GOOGLE_UPLOAD_TIMEOUT_MS = 20_000
const SOURCE_DOWNLOAD_TIMEOUT_MS = 20_000
const MAX_OBJECT_OPERATION_MS = 45_000
const MIN_OBJECT_OPERATION_RESERVE_MS = 10_000
const SERVER_HARD_STOP_MS = 285_000

type StorageBackupPhase =
  | 'inventory'
  | 'sync'
  | 'reconcile'
  | 'manifest'
  | 'cleanup'
  | 'complete'
  | 'failed'

interface StorageBackupRun {
  run_id: string
  phase: StorageBackupPhase
  inventory_cursor: string | null
  sync_cursor: string | null
  object_count: number | string
  total_bytes: number | string
  synced_count: number | string
  manifest_checksum: string | null
  manifest_payload: StorageBackupManifest | null
  drive_folder_id: string | null
  manifest_file_id: string | null
  previous_manifest_file_ids: string[]
  started_at: string
  completed_at: string | null
}

interface StorageInventoryEntry {
  object_path: string
  source_updated_at: string | null
  source_size: number | string
  content_type: string | null
  checksum: string | null
}

class StorageSourceChangedError extends Error {}

interface StorageBackupState {
  object_path: string
  source_updated_at: string | null
  source_size: number | string | null
  drive_file_id: string | null
  checksum: string | null
  status: string
  last_backed_up_at: string | null
  source_deleted_at: string | null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code = Number((error as { code?: unknown }).code)
  return Number.isFinite(code) ? code : undefined
}

function requestMode(req: VercelRequest): 'manifest' | 'cloud' {
  const mode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode
  return mode === 'cloud' ? 'cloud' : 'manifest'
}

function queryInteger(
  req: VercelRequest,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const raw = Array.isArray(req.query[name]) ? req.query[name][0] : req.query[name]
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : fallback
}

function queryString(req: VercelRequest, name: string): string | null {
  const raw = Array.isArray(req.query[name]) ? req.query[name][0] : req.query[name]
  return typeof raw === 'string' && raw ? raw : null
}

function driveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function getKeepDays(): number {
  const value = Number(process.env.GOOGLE_DRIVE_KEEP_DAYS || DEFAULT_KEEP_DAYS)
  return Number.isInteger(value) && value >= 1 && value <= 3650
    ? value
    : DEFAULT_KEEP_DAYS
}

function getGoogleAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (clientId && clientSecret && refreshToken) {
    const client = new google.auth.OAuth2(clientId, clientSecret)
    client.setCredentials({ refresh_token: refreshToken })
    return client
  }

  const email = process.env.GOOGLE_CLIENT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (email && key) {
    return new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
  }

  throw new Error('Google Drive credentials are missing')
}

async function ensureDriveFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string,
): Promise<string> {
  const response = await drive.files.list({
    q: `'${driveQueryValue(parentId)}' in parents and name = '${driveQueryValue(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }, {
    timeout: GOOGLE_METADATA_TIMEOUT_MS,
  })
  const existing = response.data.files?.find((file) => file.id)
  if (existing?.id) return existing.id

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  }, {
    timeout: GOOGLE_METADATA_TIMEOUT_MS,
  })
  if (!created.data.id) throw new Error(`無法建立 Google Drive 資料夾：${name}`)
  return created.data.id
}

async function deleteDriveFile(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
): Promise<void> {
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  }, {
    timeout: GOOGLE_METADATA_TIMEOUT_MS,
  })
}

function driveObjectName(path: string): string {
  return createHash('sha256').update(path, 'utf8').digest('hex')
}

function contentTypeFromPath(objectPath: string): string {
  const extension = extname(objectPath).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

async function writeDriveObject(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  entry: StorageBackupEntry,
): Promise<{ fileId: string; checksum: string }> {
  const response = await fetch(entry.publicUrl, {
    headers: { 'User-Agent': 'ESWake-Storage-Backup/1.0' },
    signal: AbortSignal.timeout(SOURCE_DOWNLOAD_TIMEOUT_MS),
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new StorageSourceChangedError(`${entry.path} 在掃描後已被刪除`)
    }
    throw new Error(`下載 ${entry.path} 失敗：HTTP ${response.status}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (entry.size > 0 && bytes.length !== entry.size) {
    throw new StorageSourceChangedError(`${entry.path} 在掃描後已變更大小`)
  }
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const md5Checksum = createHash('md5').update(bytes).digest('hex')
  const requestBody = {
    name: driveObjectName(entry.path),
    appProperties: {
      eswakeBucket: STORAGE_BACKUP_BUCKET,
      eswakePathHash: createHash('sha256').update(entry.path, 'utf8').digest('hex'),
      eswakeUpdatedAt: entry.updatedAt || '',
      eswakeSha256: checksum,
    },
  }
  const media = {
    mimeType: entry.contentType || 'application/octet-stream',
    body: Readable.from(bytes),
  }

  const uploaded = await drive.files.create({
    requestBody: { ...requestBody, parents: [folderId] },
    media,
    fields: 'id, size, md5Checksum',
    supportsAllDrives: true,
  }, {
    timeout: GOOGLE_UPLOAD_TIMEOUT_MS,
  })

  if (!uploaded.data.id) throw new Error(`${entry.path} 上傳後缺少 Drive file id`)
  if (Number(uploaded.data.size) !== bytes.length || uploaded.data.md5Checksum !== md5Checksum) {
    await deleteDriveFile(drive, uploaded.data.id).catch(() => undefined)
    throw new Error(`${entry.path} Google Drive 完整性驗證失敗`)
  }
  return { fileId: uploaded.data.id, checksum }
}

async function upsertManifestFile(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  runId: string,
  manifest: StorageBackupManifest,
): Promise<{ fileId: string; previousFileIds: string[] }> {
  const name = 'manifest.json'
  const list = await drive.files.list({
    q: `'${driveQueryValue(folderId)}' in parents and name = '${name}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }, {
    timeout: GOOGLE_METADATA_TIMEOUT_MS,
  })
  const staleCandidates = await drive.files.list({
    q: `'${driveQueryValue(folderId)}' in parents and appProperties has { key='eswakeRunId' and value='${driveQueryValue(runId)}' } and trashed = false`,
    fields: 'files(id)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }, {
    timeout: GOOGLE_METADATA_TIMEOUT_MS,
  })
  await Promise.all((staleCandidates.data.files || []).map(async (file) => {
    if (!file.id) return
    await deleteDriveFile(drive, file.id).catch((error: unknown) => {
      if (errorCode(error) !== 404) throw error
    })
  }))
  const body = JSON.stringify(manifest, null, 2)
  const bytes = Buffer.from(body, 'utf8')
  const md5Checksum = createHash('md5').update(bytes).digest('hex')
  const media = { mimeType: 'application/json', body }
  const result = await drive.files.create({
    requestBody: {
      name: `manifest-${randomUUID()}.candidate.json`,
      parents: [folderId],
      appProperties: {
        eswakeBackup: 'storage-manifest-candidate',
        eswakeRunId: runId,
      },
    },
    media,
    fields: 'id, size, md5Checksum',
    supportsAllDrives: true,
  }, {
    timeout: GOOGLE_UPLOAD_TIMEOUT_MS,
  })
  if (!result.data.id) throw new Error('Storage manifest 上傳失敗')
  if (Number(result.data.size) !== bytes.length || result.data.md5Checksum !== md5Checksum) {
    await deleteDriveFile(drive, result.data.id)
    throw new Error('Storage manifest 完整性驗證失敗')
  }
  return {
    fileId: result.data.id,
    previousFileIds: (list.data.files || [])
      .flatMap((oldFile) => oldFile.id && oldFile.id !== result.data.id ? [oldFile.id] : []),
  }
}

async function publishManifestFile(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
): Promise<void> {
  await drive.files.update({
    fileId,
    requestBody: {
      name: 'manifest.json',
      appProperties: { eswakeBackup: 'storage-manifest' },
    },
    fields: 'id, name',
    supportsAllDrives: true,
  }, {
    timeout: GOOGLE_METADATA_TIMEOUT_MS,
  })
}

async function fetchAllStates(supabase: SupabaseClient): Promise<StorageBackupState[]> {
  const rows: StorageBackupState[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('storage_backup_objects')
      .select('*')
      .eq('bucket_id', STORAGE_BACKUP_BUCKET)
      .order('object_path')
      .range(offset, offset + STATE_PAGE_SIZE - 1)
    if (error) throw new Error(`讀取 Storage 備份進度失敗：${error.message}`)
    rows.push(...((data || []) as StorageBackupState[]))
    if ((data || []).length < STATE_PAGE_SIZE) break
    offset += STATE_PAGE_SIZE
  }
  return rows
}

async function logBackup(
  supabase: SupabaseClient,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('backup_logs').insert(values)
  if (error) throw new Error(`寫入備份紀錄失敗：${error.message}`)
}

async function clearTransientStorageLogs(
  supabase: SupabaseClient,
  runStartedAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('backup_logs')
    .delete()
    .eq('destination', 'google_drive_storage')
    .in('status', ['running', 'failed'])
    .gte('created_at', runStartedAt)
  if (error) throw new Error(`清理重複 Storage 備份紀錄失敗：${error.message}`)
}

async function fetchRunEntries(
  supabase: SupabaseClient,
  runId: string,
): Promise<StorageInventoryEntry[]> {
  const rows: StorageInventoryEntry[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('storage_backup_inventory_entries')
      .select('object_path, source_updated_at, source_size, content_type, checksum')
      .eq('run_id', runId)
      .order('object_path')
      .range(offset, offset + STATE_PAGE_SIZE - 1)
    if (error) throw new Error(`讀取 Storage inventory 失敗：${error.message}`)
    rows.push(...((data || []) as StorageInventoryEntry[]))
    if ((data || []).length < STATE_PAGE_SIZE) break
    offset += STATE_PAGE_SIZE
  }
  return rows
}

function toStorageEntry(
  supabase: SupabaseClient,
  row: StorageInventoryEntry,
): StorageBackupEntry {
  const { data } = supabase.storage.from(STORAGE_BACKUP_BUCKET).getPublicUrl(row.object_path)
  return {
    path: row.object_path,
    size: Number(row.source_size || 0),
    updatedAt: row.source_updated_at,
    contentType: row.content_type,
    publicUrl: data.publicUrl,
    sha256: row.checksum,
  }
}

async function createRunManifest(
  supabase: SupabaseClient,
  run: StorageBackupRun,
): Promise<StorageBackupManifest> {
  const entries = await fetchRunEntries(supabase, run.run_id)
  const files = entries.map((entry) => toStorageEntry(supabase, entry))
  const states = await fetchAllStates(supabase)
  const tombstones = states
    .filter((state) => state.source_deleted_at && state.drive_file_id)
    .map((state) => ({
      path: state.object_path,
      size: Number(state.source_size || 0),
      contentType: contentTypeFromPath(state.object_path),
      sha256: state.checksum,
      deletedAt: state.source_deleted_at!,
    }))
  const checksum = createHash('sha256')
    .update(JSON.stringify({ files, tombstones }), 'utf8')
    .digest('hex')
  return {
    formatVersion: STORAGE_BACKUP_FORMAT_VERSION,
    bucket: STORAGE_BACKUP_BUCKET,
    backupTime: run.started_at,
    files,
    fileCount: Number(run.object_count || files.length),
    totalBytes: Number(run.total_bytes || 0),
    checksum,
    tombstones,
  }
}

function rpcRun(value: unknown): StorageBackupRun {
  if (!value || typeof value !== 'object') throw new Error('Storage run 回應格式錯誤')
  return value as StorageBackupRun
}

async function releaseRun(
  supabase: SupabaseClient,
  runId: string,
  leaseToken: string,
  message?: string,
): Promise<void> {
  const { error } = await supabase.rpc('release_storage_backup_inventory_run', {
    p_run_id: runId,
    p_lease_token: leaseToken,
    p_error_message: message || null,
  })
  if (error) console.error('Storage run lease release failed', error)
}

async function processResumableStorageBackup(
  supabase: SupabaseClient,
  startedAt: number,
): Promise<{
  busy: boolean
  complete: boolean
  phase: StorageBackupPhase
  scanned: number
  processed: number
  remaining: number
  run: StorageBackupRun
  manifest?: StorageBackupManifest
}> {
  const leaseToken = randomUUID()
  const { data: acquiredData, error: acquireError } = await supabase.rpc(
    'acquire_storage_backup_inventory_run',
    { p_lease_token: leaseToken, p_lease_seconds: 120 },
  )
  if (acquireError) throw new Error(`取得 Storage 備份工作失敗：${acquireError.message}`)
  const acquire = acquiredData as { acquired: boolean; run: StorageBackupRun }
  let run = rpcRun(acquire.run)
  if (!acquire.acquired) {
    return {
      busy: true,
      complete: false,
      phase: run.phase,
      scanned: 0,
      processed: 0,
      remaining: Math.max(0, Number(run.object_count) - Number(run.synced_count)),
      run,
    }
  }

  let scanned = 0
  let processed = 0
  let observedObjectDurationMs = 0
  let completed = false
  let manifest: StorageBackupManifest | undefined
  let drive: ReturnType<typeof google.drive> | null = null
  let bucketFolderId: string | null = null
  const ensureDrive = async () => {
    if (drive && bucketFolderId) return { drive, bucketFolderId }
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID 必須設定')
    drive = google.drive({ version: 'v3', auth: getGoogleAuth() })
    if (run.drive_folder_id) {
      bucketFolderId = run.drive_folder_id
    } else {
      const storageFolderId = await ensureDriveFolder(drive, rootFolderId, 'Storage-Backups')
      bucketFolderId = await ensureDriveFolder(drive, storageFolderId, STORAGE_BACKUP_BUCKET)
      const { error } = await supabase
        .from('storage_backup_inventory_runs')
        .update({ drive_folder_id: bucketFolderId, updated_at: new Date().toISOString() })
        .eq('run_id', run.run_id)
      if (error) throw new Error(`保存 Drive folder checkpoint 失敗：${error.message}`)
      run = { ...run, drive_folder_id: bucketFolderId }
    }
    return { drive, bucketFolderId }
  }

  try {
    workLoop: while (Date.now() - startedAt < TIME_BUDGET_MS) {
      if (run.phase === 'inventory') {
        const { data, error } = await supabase.rpc('scan_storage_backup_inventory_page', {
          p_run_id: run.run_id,
          p_lease_token: leaseToken,
          p_limit: INVENTORY_PAGE_SIZE,
        })
        if (error) throw new Error(`Storage inventory 分頁失敗：${error.message}`)
        const page = data as { run: StorageBackupRun; page_count: number }
        run = rpcRun(page.run)
        scanned += Number(page.page_count || 0)
        continue
      }

      if (run.phase === 'sync') {
        const query = supabase
          .from('storage_backup_inventory_entries')
          .select('object_path, source_updated_at, source_size, content_type, checksum')
          .eq('run_id', run.run_id)
          .order('object_path')
          .limit(SYNC_PAGE_SIZE)
        const { data, error } = run.sync_cursor
          ? await query.gt('object_path', run.sync_cursor)
          : await query
        if (error) throw new Error(`讀取待同步圖片失敗：${error.message}`)
        const entries = (data || []) as StorageInventoryEntry[]
        if (entries.length === 0) {
          throw new Error('Storage sync cursor 沒有可處理項目')
        }

        for (const inventoryEntry of entries) {
          if (Date.now() - startedAt >= TIME_BUDGET_MS) break
          const entry = toStorageEntry(supabase, inventoryEntry)
          const { data: stateData, error: stateError } = await supabase
            .from('storage_backup_objects')
            .select('*')
            .eq('bucket_id', STORAGE_BACKUP_BUCKET)
            .eq('object_path', entry.path)
            .maybeSingle()
          if (stateError) throw new Error(`讀取圖片 checkpoint 失敗：${stateError.message}`)
          const state = stateData as StorageBackupState | null
          let checksum = state?.checksum || null
          let checkpointSaved = false
          let objectStartedAt: number | null = null

          try {
            if (storageEntryChanged(entry, state || undefined)) {
              const target = await ensureDrive()
              const reserveMs = observedObjectDurationMs > 0
                ? Math.min(
                    MAX_OBJECT_OPERATION_MS,
                    Math.max(
                      MIN_OBJECT_OPERATION_RESERVE_MS,
                      observedObjectDurationMs * 2 + GOOGLE_METADATA_TIMEOUT_MS,
                    ),
                  )
                : MAX_OBJECT_OPERATION_MS
              if (Date.now() - startedAt + reserveMs >= SERVER_HARD_STOP_MS) break workLoop
              objectStartedAt = Date.now()
              const uploaded = await writeDriveObject(target.drive, target.bucketFolderId, entry)
              checksum = uploaded.checksum
              const { error: upsertError } = await supabase.from('storage_backup_objects').upsert({
                bucket_id: STORAGE_BACKUP_BUCKET,
                object_path: entry.path,
                source_updated_at: entry.updatedAt,
                source_size: entry.size,
                drive_file_id: uploaded.fileId,
                checksum,
                status: 'success',
                last_backed_up_at: new Date().toISOString(),
                last_seen_run_id: run.run_id,
                source_deleted_at: null,
                error_message: null,
                updated_at: new Date().toISOString(),
              })
              if (upsertError) {
                await deleteDriveFile(target.drive, uploaded.fileId).catch(() => undefined)
                throw upsertError
              }
              checkpointSaved = true
              if (state?.drive_file_id && state.drive_file_id !== uploaded.fileId) {
                await deleteDriveFile(target.drive, state.drive_file_id)
                  .catch((deleteError: unknown) => {
                  if (errorCode(deleteError) !== 404) {
                    console.error(`舊 Storage 備份檔刪除失敗：${entry.path}`, deleteError)
                  }
                })
              }
            } else {
              const { error: seenError } = await supabase
                .from('storage_backup_objects')
                .update({
                  last_seen_run_id: run.run_id,
                  source_deleted_at: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('bucket_id', STORAGE_BACKUP_BUCKET)
                .eq('object_path', entry.path)
              if (seenError) throw seenError
              checkpointSaved = true
            }

            if (!checksum?.match(/^[a-f0-9]{64}$/)) {
              throw new Error(`${entry.path} 缺少有效 checksum`)
            }
            const { error: entryError } = await supabase
              .from('storage_backup_inventory_entries')
              .update({ checksum, updated_at: new Date().toISOString() })
              .eq('run_id', run.run_id)
              .eq('object_path', entry.path)
            if (entryError) throw entryError

            const { data: ackData, error: ackError } = await supabase.rpc(
              'ack_storage_backup_inventory_entry',
              {
                p_run_id: run.run_id,
                p_lease_token: leaseToken,
                p_object_path: entry.path,
              },
            )
            if (ackError?.message.includes('source object changed during backup')) {
              throw new StorageSourceChangedError(`${entry.path} 在同步期間已變更`)
            }
            if (ackError) throw new Error(`推進 Storage sync cursor 失敗：${ackError.message}`)
            run = rpcRun(ackData)
            processed += 1
            if (objectStartedAt !== null) {
              observedObjectDurationMs = Math.max(
                observedObjectDurationMs,
                Date.now() - objectStartedAt,
              )
            }
          } catch (error: unknown) {
            if (!checkpointSaved) {
              await supabase.from('storage_backup_objects').upsert({
                bucket_id: STORAGE_BACKUP_BUCKET,
                object_path: entry.path,
                source_updated_at: entry.updatedAt,
                source_size: entry.size,
                drive_file_id: state?.drive_file_id || null,
                checksum: state?.checksum || null,
                status: 'failed',
                error_message: errorMessage(error).slice(0, 1000),
                updated_at: new Date().toISOString(),
              })
            }
            throw error
          }
        }
        continue
      }

      if (run.phase === 'reconcile') {
        const { data, error } = await supabase.rpc('reconcile_storage_backup_inventory_run', {
          p_run_id: run.run_id,
          p_lease_token: leaseToken,
        })
        if (error?.message.includes('source inventory changed during reconciliation')) {
          throw new StorageSourceChangedError('商品圖片在備份期間有變更，將重新建立清單')
        }
        if (error) throw new Error(`整理 Storage 刪除項目失敗：${error.message}`)
        run = rpcRun(data)

        const cutoff = new Date(Date.now() - getKeepDays() * 24 * 60 * 60 * 1000).toISOString()
        const { data: expired } = await supabase
          .from('storage_backup_objects')
          .select('object_path, drive_file_id')
          .eq('bucket_id', STORAGE_BACKUP_BUCKET)
          .lt('source_deleted_at', cutoff)
          .limit(10)
        if ((expired || []).length > 0 && Date.now() - startedAt < 12_000) {
          const target = await ensureDrive()
          await Promise.all((expired || []).map(async (state) => {
            if (state.drive_file_id) {
              await deleteDriveFile(target.drive, state.drive_file_id)
                .catch((error: unknown) => {
                if (errorCode(error) !== 404) throw error
              })
            }
            await supabase
              .from('storage_backup_objects')
              .delete()
              .eq('bucket_id', STORAGE_BACKUP_BUCKET)
              .eq('object_path', state.object_path)
          }))
        }
        continue
      }

      if (run.phase === 'manifest') {
        manifest = run.manifest_payload || await createRunManifest(supabase, run)
        if (!run.manifest_payload) {
          const { error: payloadError } = await supabase
            .from('storage_backup_inventory_runs')
            .update({ manifest_payload: manifest, updated_at: new Date().toISOString() })
            .eq('run_id', run.run_id)
          if (payloadError) throw new Error(`保存 Storage manifest 失敗：${payloadError.message}`)
          run = { ...run, manifest_payload: manifest }
        }
        if (Date.now() - startedAt >= 3_000) break
        const target = await ensureDrive()
        const candidate = await upsertManifestFile(
          target.drive,
          target.bucketFolderId,
          run.run_id,
          manifest,
        )
        const { data, error } = await supabase.rpc('commit_storage_backup_manifest', {
          p_run_id: run.run_id,
          p_lease_token: leaseToken,
          p_manifest_checksum: manifest.checksum,
          p_manifest_file_id: candidate.fileId,
          p_previous_manifest_file_ids: candidate.previousFileIds,
        })
        if (error) {
          const { data: committedRun, error: committedRunError } = await supabase
            .from('storage_backup_inventory_runs')
            .select('*')
            .eq('run_id', run.run_id)
            .maybeSingle()
          if (
            committedRun?.phase === 'cleanup'
            && committedRun.manifest_file_id === candidate.fileId
          ) {
            run = committedRun as StorageBackupRun
            continue
          }
          if (committedRunError) {
            throw new Error(`確認 Storage manifest 提交結果失敗：${committedRunError.message}`)
          }
          await deleteDriveFile(target.drive, candidate.fileId).catch(() => undefined)
          if (error.message.includes('source inventory changed before completion')) {
            throw new StorageSourceChangedError('商品圖片在完成備份前有變更，將重新建立清單')
          }
          throw new Error(`提交 Storage manifest 失敗：${error.message}`)
        }
        run = rpcRun(data)
        continue
      }

      if (run.phase === 'cleanup') {
        const target = await ensureDrive()
        if (!run.manifest_file_id) throw new Error('Storage cleanup 缺少 manifest file id')
        await publishManifestFile(target.drive, run.manifest_file_id)
        await Promise.all((run.previous_manifest_file_ids || []).map((fileId) =>
          deleteDriveFile(target.drive, fileId).catch((deleteError: unknown) => {
            if (errorCode(deleteError) !== 404) throw deleteError
          }),
        ))
        const { data, error } = await supabase.rpc('complete_storage_backup_inventory_run', {
          p_run_id: run.run_id,
          p_lease_token: leaseToken,
        })
        if (error) throw new Error(`完成 Storage 備份工作失敗：${error.message}`)
        run = rpcRun(data)
        completed = true
        break
      }

      if (run.phase === 'complete') {
        completed = true
        break
      }
      throw new Error(`不支援的 Storage backup phase：${run.phase}`)
    }
  } catch (error: unknown) {
    if (error instanceof StorageSourceChangedError) {
      const { error: failError } = await supabase.rpc('fail_storage_backup_inventory_run', {
        p_run_id: run.run_id,
        p_lease_token: leaseToken,
        p_error_message: error.message,
      })
      if (failError) console.error('Storage run reset failed', failError)
      completed = true
    } else {
      await releaseRun(supabase, run.run_id, leaseToken, errorMessage(error))
      completed = true
    }
    throw error
  } finally {
    if (!completed) await releaseRun(supabase, run.run_id, leaseToken)
  }

  return {
    busy: false,
    complete: run.phase === 'complete',
    phase: run.phase,
    scanned,
    processed,
    remaining: Math.max(0, Number(run.object_count) - Number(run.synced_count)),
    run,
    manifest,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now()
  setBackupResponseHeaders(res)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authorization = await authorizeBackupRequest(req)
  if (authorization.ok === false) {
    return res.status(authorization.status).json({ error: authorization.error })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server 設定錯誤' })
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    if (requestMode(req) === 'manifest') {
      const requestedSnapshot = queryString(req, 'snapshot')
      let snapshotToken = requestedSnapshot
      let snapshot: {
        runId: string
        backupTime: string
        fileCount: number
        totalBytes: number
        checksum: string
      }
      if (requestedSnapshot) {
        if (!/^[0-9a-f-]{36}$/i.test(requestedSnapshot)) {
          return res.status(400).json({ error: 'Storage snapshot token 格式錯誤' })
        }
        const { data, error } = await supabase
          .from('storage_backup_manifest_snapshots')
          .select('manifest, expires_at')
          .eq('token', requestedSnapshot)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
        if (error || !data) {
          return res.status(410).json({ error: 'Storage snapshot 已過期，請重新開始' })
        }
        snapshot = data.manifest as unknown as typeof snapshot
      } else {
        const { data: latestRun, error: runError } = await supabase
          .from('storage_backup_inventory_runs')
          .select('*')
          .eq('bucket_id', STORAGE_BACKUP_BUCKET)
          .eq('phase', 'complete')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (runError) throw new Error(`讀取最新 Storage inventory 失敗：${runError.message}`)
        if (!latestRun?.manifest_checksum) {
          return res.status(409).json({
            error: '尚無完成的商品圖片備份',
            message: '請先在備份頁執行商品圖片雲端同步，直到顯示成功。',
          })
        }
        const run = latestRun as StorageBackupRun
        snapshot = {
          runId: run.run_id,
          backupTime: run.completed_at || run.started_at,
          fileCount: Number(run.object_count),
          totalBytes: Number(run.total_bytes),
          checksum: run.manifest_checksum!,
        }
        snapshotToken = randomUUID()
        const { error } = await supabase.from('storage_backup_manifest_snapshots').insert({
          token: snapshotToken,
          manifest: snapshot,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        if (error) throw new Error(`建立 Storage snapshot 失敗：${error.message}`)
        await supabase
          .from('storage_backup_manifest_snapshots')
          .delete()
          .lt('expires_at', new Date().toISOString())
      }

      const offset = queryInteger(req, 'offset', 0, Number.MAX_SAFE_INTEGER)
      const limit = Math.max(1, queryInteger(req, 'limit', 250, 500))
      const { data: entryData, error: entryError } = await supabase
        .from('storage_backup_inventory_entries')
        .select('object_path, source_updated_at, source_size, content_type, checksum')
        .eq('run_id', snapshot.runId)
        .order('object_path')
        .range(offset, offset + limit - 1)
      if (entryError) throw new Error(`讀取 Storage manifest 分頁失敗：${entryError.message}`)
      const files = ((entryData || []) as StorageInventoryEntry[])
        .map((entry) => toStorageEntry(supabase, entry))
      const nextOffset = offset + files.length < snapshot.fileCount
        ? offset + files.length
        : null
      return res.status(200).json({
        formatVersion: STORAGE_BACKUP_FORMAT_VERSION,
        bucket: STORAGE_BACKUP_BUCKET,
        backupTime: snapshot.backupTime,
        fileCount: snapshot.fileCount,
        totalBytes: snapshot.totalBytes,
        checksum: snapshot.checksum,
        files,
        page: {
          offset,
          limit,
          nextOffset,
          total: snapshot.fileCount,
          snapshotToken,
        },
      })
    }

    const result = await processResumableStorageBackup(supabase, startedAt)
    const executionTime = Date.now() - startedAt
    if (result.busy) {
      return res.status(202).json({
        success: false,
        status: 'running',
        busy: true,
        phase: result.phase,
        scanned: 0,
        processed: 0,
        remaining: result.remaining,
        message: '已有商品圖片備份正在執行',
        executionTime,
      })
    }

    const checksum = result.manifest?.checksum || result.run.manifest_checksum
    await clearTransientStorageLogs(supabase, result.run.started_at)
    await logBackup(supabase, {
      backup_type: 'storage',
      destination: 'google_drive_storage',
      status: result.complete ? 'success' : 'running',
      records_count: Number(result.run.object_count),
      file_name: `${STORAGE_BACKUP_BUCKET}/manifest.json`,
      file_size: String(result.run.total_bytes),
      file_size_bytes: Number(result.run.total_bytes),
      checksum,
      format_version: STORAGE_BACKUP_FORMAT_VERSION,
      execution_time: executionTime,
      error_message: result.complete
        ? null
        : `phase=${result.phase}; 尚有 ${result.remaining} 個檔案等待同步`,
    })

    return res.status(result.complete ? 200 : 202).json({
      success: result.complete,
      status: result.complete ? 'success' : 'running',
      busy: false,
      phase: result.phase,
      scanned: result.scanned,
      processed: result.processed,
      remaining: result.remaining,
      manifest: {
        formatVersion: STORAGE_BACKUP_FORMAT_VERSION,
        bucket: STORAGE_BACKUP_BUCKET,
        backupTime: result.manifest?.backupTime || result.run.started_at,
        fileCount: Number(result.run.object_count),
        totalBytes: Number(result.run.total_bytes),
        checksum,
      },
      executionTime,
    })
  } catch (error: unknown) {
    const message = errorMessage(error)
    try {
      const { data: latestRun } = await supabase
        .from('storage_backup_inventory_runs')
        .select('started_at')
        .eq('bucket_id', STORAGE_BACKUP_BUCKET)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latestRun?.started_at) {
        await clearTransientStorageLogs(supabase, latestRun.started_at)
      }
      await logBackup(supabase, {
        backup_type: 'storage',
        destination: 'google_drive_storage',
        status: 'failed',
        error_message: message.slice(0, 1000),
        execution_time: Date.now() - startedAt,
      })
    } catch (logError) {
      console.error('Storage backup failure could not be logged', logError)
    }
    return res.status(500).json({ error: 'Storage 備份失敗', message })
  }
}

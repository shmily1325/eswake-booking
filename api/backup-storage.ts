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
  createStorageBackupManifest,
  STORAGE_BACKUP_BUCKET,
  storageEntryChanged,
  type StorageBackupEntry,
  type StorageBackupManifest,
} from '../src/server/backup-storage.js'

const TIME_BUDGET_MS = 30_000
const STATE_PAGE_SIZE = 1000
const DEFAULT_KEEP_DAYS = 90

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
  })
  if (!created.data.id) throw new Error(`無法建立 Google Drive 資料夾：${name}`)
  return created.data.id
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
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`下載 ${entry.path} 失敗：HTTP ${response.status}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (entry.size > 0 && bytes.length !== entry.size) {
    throw new Error(`${entry.path} 下載大小不一致`)
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
  })

  if (!uploaded.data.id) throw new Error(`${entry.path} 上傳後缺少 Drive file id`)
  if (Number(uploaded.data.size) !== bytes.length || uploaded.data.md5Checksum !== md5Checksum) {
    await drive.files.delete({
      fileId: uploaded.data.id,
      supportsAllDrives: true,
    }).catch(() => undefined)
    throw new Error(`${entry.path} Google Drive 完整性驗證失敗`)
  }
  return { fileId: uploaded.data.id, checksum }
}

async function upsertManifestFile(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  manifest: StorageBackupManifest,
): Promise<string> {
  const name = 'manifest.json'
  const list = await drive.files.list({
    q: `'${driveQueryValue(folderId)}' in parents and name = '${name}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const body = JSON.stringify(manifest, null, 2)
  const bytes = Buffer.from(body, 'utf8')
  const md5Checksum = createHash('md5').update(bytes).digest('hex')
  const media = { mimeType: 'application/json', body }
  const result = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      appProperties: { eswakeBackup: 'storage-manifest' },
    },
    media,
    fields: 'id, size, md5Checksum',
    supportsAllDrives: true,
  })
  if (!result.data.id) throw new Error('Storage manifest 上傳失敗')
  if (Number(result.data.size) !== bytes.length || result.data.md5Checksum !== md5Checksum) {
    await drive.files.delete({
      fileId: result.data.id,
      supportsAllDrives: true,
    })
    throw new Error('Storage manifest 完整性驗證失敗')
  }
  for (const oldFile of list.data.files || []) {
    if (!oldFile.id || oldFile.id === result.data.id) continue
    await drive.files.delete({
      fileId: oldFile.id,
      supportsAllDrives: true,
    }).catch((error: unknown) => {
      if (errorCode(error) !== 404) throw error
    })
  }
  return result.data.id
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

async function syncStorageToDrive(
  supabase: SupabaseClient,
  manifest: StorageBackupManifest,
  startedAt: number,
): Promise<{
  complete: boolean
  processed: number
  remaining: number
  manifestChecksum: string
}> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID 必須設定')

  const drive = google.drive({ version: 'v3', auth: getGoogleAuth() })
  const storageFolderId = await ensureDriveFolder(drive, rootFolderId, 'Storage-Backups')
  const bucketFolderId = await ensureDriveFolder(drive, storageFolderId, STORAGE_BACKUP_BUCKET)
  const states = await fetchAllStates(supabase)
  const stateByPath = new Map(states.map((state) => [state.object_path, state]))
  const pending = manifest.files.filter((entry) => storageEntryChanged(entry, stateByPath.get(entry.path)))
  let processed = 0

  for (const entry of pending) {
    if (Date.now() - startedAt >= TIME_BUDGET_MS) break
    const state = stateByPath.get(entry.path)
    try {
      const uploaded = await writeDriveObject(
        drive,
        bucketFolderId,
        entry,
      )
      const { error } = await supabase.from('storage_backup_objects').upsert({
        bucket_id: STORAGE_BACKUP_BUCKET,
        object_path: entry.path,
        source_updated_at: entry.updatedAt,
        source_size: entry.size,
        drive_file_id: uploaded.fileId,
        checksum: uploaded.checksum,
        status: 'success',
        last_backed_up_at: new Date().toISOString(),
        source_deleted_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      if (error) {
        await drive.files.delete({
          fileId: uploaded.fileId,
          supportsAllDrives: true,
        }).catch(() => undefined)
        throw error
      }
      if (state?.drive_file_id && state.drive_file_id !== uploaded.fileId) {
        await drive.files.delete({
          fileId: state.drive_file_id,
          supportsAllDrives: true,
        }).catch((deleteError: unknown) => {
          if (errorCode(deleteError) !== 404) {
            console.error(`舊 Storage 備份檔刪除失敗：${entry.path}`, deleteError)
          }
        })
      }
      processed += 1
    } catch (error: unknown) {
      await supabase.from('storage_backup_objects').upsert({
        bucket_id: STORAGE_BACKUP_BUCKET,
        object_path: entry.path,
        source_updated_at: entry.updatedAt,
        source_size: entry.size,
        drive_file_id: state?.drive_file_id || null,
        status: 'failed',
        error_message: errorMessage(error).slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      throw error
    }
  }

  const currentPaths = new Set(manifest.files.map((entry) => entry.path))
  const nowIso = new Date().toISOString()
  for (const state of states) {
    if (currentPaths.has(state.object_path) && state.source_deleted_at) {
      await supabase
        .from('storage_backup_objects')
        .update({ source_deleted_at: null, updated_at: nowIso })
        .eq('bucket_id', STORAGE_BACKUP_BUCKET)
        .eq('object_path', state.object_path)
    } else if (!currentPaths.has(state.object_path) && !state.source_deleted_at) {
      await supabase
        .from('storage_backup_objects')
        .update({ source_deleted_at: nowIso, updated_at: nowIso })
        .eq('bucket_id', STORAGE_BACKUP_BUCKET)
        .eq('object_path', state.object_path)
    }
  }

  const cutoff = new Date(Date.now() - getKeepDays() * 24 * 60 * 60 * 1000).toISOString()
  const { data: expired } = await supabase
    .from('storage_backup_objects')
    .select('object_path, drive_file_id')
    .eq('bucket_id', STORAGE_BACKUP_BUCKET)
    .lt('source_deleted_at', cutoff)
    .limit(25)
  for (const state of expired || []) {
    if (Date.now() - startedAt >= TIME_BUDGET_MS) break
    if (currentPaths.has(state.object_path)) continue
    if (state.drive_file_id) {
      await drive.files.delete({
        fileId: state.drive_file_id,
        supportsAllDrives: true,
      }).catch((error: unknown) => {
        if (errorCode(error) !== 404) throw error
      })
    }
    await supabase
      .from('storage_backup_objects')
      .delete()
      .eq('bucket_id', STORAGE_BACKUP_BUCKET)
      .eq('object_path', state.object_path)
  }

  const remaining = pending.length - processed
  const complete = remaining === 0
  let manifestChecksum = manifest.checksum
  if (complete) {
    const completedStates = await fetchAllStates(supabase)
    const completedByPath = new Map(completedStates.map((state) => [state.object_path, state]))
    const filesWithChecksums = manifest.files.map((entry) => ({
      ...entry,
      sha256: completedByPath.get(entry.path)?.checksum || null,
    }))
    const tombstones = completedStates
      .filter((state) => state.source_deleted_at && state.drive_file_id)
      .map((state) => ({
        path: state.object_path,
        size: Number(state.source_size || 0),
        contentType: contentTypeFromPath(state.object_path),
        sha256: state.checksum,
        deletedAt: state.source_deleted_at!,
      }))
    manifestChecksum = createHash('sha256')
      .update(JSON.stringify({ files: filesWithChecksums, tombstones }), 'utf8')
      .digest('hex')
    await upsertManifestFile(drive, bucketFolderId, {
      ...manifest,
      files: filesWithChecksums,
      tombstones,
      checksum: manifestChecksum,
    })
  }
  return { complete, processed, remaining, manifestChecksum }
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
      let manifest: StorageBackupManifest
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
        manifest = data.manifest as unknown as StorageBackupManifest
      } else {
        manifest = await createStorageBackupManifest(
          supabase,
          new Date(),
          startedAt + 45_000,
        )
        snapshotToken = randomUUID()
        const { error } = await supabase.from('storage_backup_manifest_snapshots').insert({
          token: snapshotToken,
          manifest,
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
      const files = manifest.files.slice(offset, offset + limit)
      const nextOffset = offset + files.length < manifest.fileCount
        ? offset + files.length
        : null
      return res.status(200).json({
        ...manifest,
        files,
        page: {
          offset,
          limit,
          nextOffset,
          total: manifest.fileCount,
          snapshotToken,
        },
      })
    }

    const manifest = await createStorageBackupManifest(
      supabase,
      new Date(),
      startedAt + 20_000,
    )
    const result = await syncStorageToDrive(supabase, manifest, startedAt)
    const executionTime = Date.now() - startedAt
    await logBackup(supabase, {
      backup_type: 'storage',
      destination: 'google_drive_storage',
      status: result.complete ? 'success' : 'running',
      records_count: manifest.fileCount,
      file_name: `${STORAGE_BACKUP_BUCKET}/manifest.json`,
      file_size: String(manifest.totalBytes),
      file_size_bytes: manifest.totalBytes,
      checksum: result.manifestChecksum,
      format_version: manifest.formatVersion,
      execution_time: executionTime,
      error_message: result.complete ? null : `尚有 ${result.remaining} 個檔案等待同步`,
    })

    return res.status(result.complete ? 200 : 202).json({
      success: result.complete,
      status: result.complete ? 'success' : 'running',
      ...result,
      manifest: {
        formatVersion: manifest.formatVersion,
        bucket: manifest.bucket,
        backupTime: manifest.backupTime,
        fileCount: manifest.fileCount,
        totalBytes: manifest.totalBytes,
        checksum: result.manifestChecksum,
      },
      executionTime,
    })
  } catch (error: unknown) {
    const message = errorMessage(error)
    try {
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

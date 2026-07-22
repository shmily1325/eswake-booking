import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  authorizeAutomationRequest,
  setBackupResponseHeaders,
} from '../src/server/backup-auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBackupResponseHeaders(res)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = authorizeAutomationRequest(req)
  if (auth.ok === false) {
    return res.status(auth.status).json({ error: auth.error })
  }

  const status = req.body?.status === 'success' ? 'success' : 'failed'
  const backupType = req.body?.backupType === 'storage' ? 'storage' : 'full_database'
  const destination = backupType === 'storage' ? 'wd_local_storage' : 'wd_local'
  const checksum = typeof req.body?.checksum === 'string' && /^[a-f0-9]{64}$/i.test(req.body.checksum)
    ? req.body.checksum.toLowerCase()
    : null
  const fileName = typeof req.body?.fileName === 'string'
    ? req.body.fileName.replace(/[^\w.-]/g, '').slice(0, 255)
    : null
  const fileSizeBytes = Number.isSafeInteger(req.body?.fileSizeBytes) && req.body.fileSizeBytes >= 0
    ? req.body.fileSizeBytes
    : null
  const errorMessage = status === 'failed' && typeof req.body?.errorMessage === 'string'
    ? req.body.errorMessage.slice(0, 1000)
    : null

  if (status === 'success' && (!checksum || !fileName || fileSizeBytes == null)) {
    return res.status(400).json({ error: '備份成功回報缺少完整性資料' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server 設定錯誤' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('backup_logs').insert({
    backup_type: backupType,
    destination,
    status,
    file_name: fileName,
    file_size: fileSizeBytes == null ? null : String(fileSizeBytes),
    file_size_bytes: fileSizeBytes,
    checksum,
    format_version: Number.isInteger(req.body?.formatVersion) ? req.body.formatVersion : null,
    records_count: Number.isInteger(req.body?.recordsCount) ? req.body.recordsCount : null,
    error_message: errorMessage,
    execution_time: Number.isInteger(req.body?.executionTime) ? req.body.executionTime : null,
  })

  if (error) {
    return res.status(500).json({ error: '無法寫入備份紀錄' })
  }

  return res.status(200).json({ success: true })
}

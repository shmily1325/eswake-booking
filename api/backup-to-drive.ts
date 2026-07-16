import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  authorizeBackupRequest,
  setBackupResponseHeaders,
} from '../src/server/backup-auth.js'

/**
 * Deprecated Google Sheets backup endpoint.
 * Kept as an authenticated tombstone so old bookmarks/jobs fail safely.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBackupResponseHeaders(res)

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await authorizeBackupRequest(req)
  if (auth.ok === false) {
    return res.status(auth.status).json({ error: auth.error })
  }

  return res.status(410).json({
    error: '此舊版 Google Sheets 備份已停用，請使用 Google Drive 完整 SQL 備份。',
  })
}

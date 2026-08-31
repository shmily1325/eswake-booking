import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type Action =
  | 'bootstrap'
  | 'profile'
  | 'bind'
  | 'orders'
  | 'transactions'
  | 'birthday'

type LineProfile = {
  userId?: string
}

type LineTokenVerification = {
  client_id?: string
  expires_in?: number
  scope?: string
}

type VerifiedLineIdentity = {
  userId: string
  channelId: string
  canPush: boolean
}

function bodyValue(req: VercelRequest, key: string): unknown {
  if (!req.body || typeof req.body !== 'object') return undefined
  return (req.body as Record<string, unknown>)[key]
}

function splitEnvList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function channelIdFromLiffId(value: string | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  const separator = normalized.indexOf('-')
  return separator > 0 ? normalized.slice(0, separator) : normalized
}

function configuredLiffChannelIds(): Set<string> {
  const ids = new Set(splitEnvList(process.env.LINE_LIFF_ALLOWED_CHANNEL_IDS))
  for (const liffId of [
    process.env.VITE_LIFF_ID,
    process.env.VITE_LIFF_BOOK_ID,
    process.env.VITE_LIFF_MIGRATION_ID,
  ]) {
    const channelId = channelIdFromLiffId(liffId)
    if (channelId) ids.add(channelId)
  }
  return ids
}

function pushCapableLiffChannelIds(): Set<string> {
  return new Set(splitEnvList(process.env.LINE_PUSH_LIFF_CHANNEL_IDS))
}

async function verifyLineUser(req: VercelRequest): Promise<VerifiedLineIdentity | null> {
  const header = req.headers.authorization
  const token = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : ''
  if (!token) return null

  const verifyUrl = new URL('https://api.line.me/oauth2/v2.1/verify')
  verifyUrl.searchParams.set('access_token', token)
  const verificationResponse = await fetch(verifyUrl)
  if (!verificationResponse.ok) return null

  const verification = await verificationResponse.json() as LineTokenVerification
  const channelId = typeof verification.client_id === 'string'
    ? verification.client_id
    : ''
  const allowedChannelIds = configuredLiffChannelIds()
  if (!channelId || !allowedChannelIds.has(channelId)) {
    console.warn('Rejected LIFF token from an unconfigured channel')
    return null
  }

  const response = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null

  const profile = await response.json() as LineProfile
  if (typeof profile.userId !== 'string' || !profile.userId) return null

  return {
    userId: profile.userId,
    channelId,
    canPush: pushCapableLiffChannelIds().has(channelId),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const lineIdentity = await verifyLineUser(req)
    if (!lineIdentity) {
      return res.status(401).json({ success: false, error: 'LINE 登入驗證失敗' })
    }
    const lineUserId = lineIdentity.userId

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('LIFF member API is missing Supabase server credentials')
      return res.status(500).json({ success: false, error: '服務暫時無法使用' })
    }

    const action = bodyValue(req, 'action') as Action | undefined
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let rpc:
      | Awaited<ReturnType<typeof supabase.rpc>>
      | undefined

    switch (action) {
      case 'bootstrap': {
        const profileRpc = await supabase.rpc('get_liff_member_profile', {
          p_line_user_id: lineUserId,
          p_record_login: true,
        })
        if (profileRpc.error) {
          console.error('LIFF bootstrap profile failed:', profileRpc.error.message)
          return res.status(500).json({ success: false, error: '服務暫時無法使用' })
        }

        const profile = profileRpc.data as {
          success?: boolean
          error?: string
          member?: unknown
        } | null
        if (!profile?.success) {
          return res.status(200).json({ success: false, error: '會員資料載入失敗' })
        }
        if (!profile.member) {
          return res.status(200).json({
            success: true,
            member: null,
            orders: [],
            orders_available: true,
          })
        }

        const ordersRpc = await supabase.rpc('get_liff_shop_orders', {
          p_line_user_id: lineUserId,
        })
        if (ordersRpc.error) {
          console.error('LIFF bootstrap orders failed:', ordersRpc.error.message)
          return res.status(200).json({
            success: true,
            member: profile.member,
            orders: [],
            orders_available: false,
          })
        }

        const orders = ordersRpc.data as {
          success?: boolean
          orders?: unknown[]
        } | null
        if (!orders?.success) {
          return res.status(200).json({
            success: true,
            member: profile.member,
            orders: [],
            orders_available: false,
          })
        }
        return res.status(200).json({
          success: true,
          member: profile.member,
          orders: Array.isArray(orders.orders) ? orders.orders : [],
          orders_available: true,
        })
      }
      case 'profile':
        rpc = await supabase.rpc('get_liff_member_profile', {
          p_line_user_id: lineUserId,
          p_record_login: bodyValue(req, 'recordLogin') === true,
        })
        break
      case 'bind': {
        const phone = bodyValue(req, 'phone')
        const birthday = bodyValue(req, 'birthday')
        if (typeof phone !== 'string' || typeof birthday !== 'string') {
          return res.status(400).json({ success: false, error: '手機與生日不可空白' })
        }
        rpc = await supabase.rpc('bind_liff_member', {
          p_line_user_id: lineUserId,
          p_phone: phone,
          p_birthday: birthday,
          p_source_channel_id: lineIdentity.channelId,
          p_can_push: lineIdentity.canPush,
        })
        break
      }
      case 'orders':
        rpc = await supabase.rpc('get_liff_shop_orders', {
          p_line_user_id: lineUserId,
        })
        break
      case 'transactions': {
        const category = bodyValue(req, 'category')
        const sinceDate = bodyValue(req, 'sinceDate')
        if (typeof category !== 'string') {
          return res.status(400).json({ success: false, error: '缺少交易類別' })
        }
        rpc = await supabase.rpc('get_liff_member_transactions', {
          p_line_user_id: lineUserId,
          p_category: category,
          p_since_date: typeof sinceDate === 'string' ? sinceDate : null,
        })
        break
      }
      case 'birthday': {
        const birthday = bodyValue(req, 'birthday')
        if (typeof birthday !== 'string') {
          return res.status(400).json({ success: false, error: '生日日期無效' })
        }
        rpc = await supabase.rpc('update_liff_member_birthday', {
          p_line_user_id: lineUserId,
          p_birthday: birthday,
        })
        break
      }
      default:
        return res.status(400).json({ success: false, error: '不支援的操作' })
    }

    if (rpc.error) {
      console.error('LIFF member RPC failed:', rpc.error.message)
      return res.status(500).json({ success: false, error: '服務暫時無法使用' })
    }
    const result = rpc.data as { success?: boolean } | null
    if (result?.success === false && action === 'transactions') {
      return res.status(200).json({ success: false, error: '交易記錄載入失敗' })
    }
    if (result?.success === false && action === 'birthday') {
      return res.status(200).json({ success: false, error: '生日更新失敗' })
    }
    return res.status(200).json(rpc.data)
  } catch (error) {
    console.error(
      'LIFF member API failed:',
      error instanceof Error ? error.message : String(error),
    )
    return res.status(500).json({ success: false, error: '服務暫時無法使用' })
  }
}

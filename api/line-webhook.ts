import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  readRawRequestBody,
  verifyLineWebhookSignature,
} from '../src/server/line-webhook-verify.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

type LineEvent = {
  type?: string
  timestamp?: number
  webhookEventId?: string
  source?: {
    type?: string
    userId?: string
  }
}

type LineWebhookBody = {
  events?: LineEvent[]
}

type LineProfile = {
  displayName?: string
  pictureUrl?: string
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

async function fetchLineProfile(
  lineUserId: string,
  accessToken: string,
): Promise<{ profile: LineProfile | null; complete: boolean }> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!response.ok) return { profile: null, complete: false }
    const profile = await response.json() as LineProfile
    return {
      profile,
      complete: typeof profile.displayName === 'string' && profile.displayName.trim() !== '',
    }
  } catch (error) {
    console.error(
      'LINE webhook profile lookup failed:',
      error instanceof Error ? error.message : String(error),
    )
    return { profile: null, complete: false }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!channelSecret || !accessToken || !supabaseUrl || !serviceRoleKey) {
    console.error('LINE webhook is missing server configuration')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const rawBody = await readRawRequestBody(req)
  const signature = headerValue(req.headers['x-line-signature'])
  if (!signature || !verifyLineWebhookSignature(rawBody, signature, channelSecret)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload: LineWebhookBody
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as LineWebhookBody
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const event of payload.events ?? []) {
    const lineUserId = event.source?.type === 'user' ? event.source.userId : undefined
    const eventType = event.type
    const webhookEventId = event.webhookEventId
    if (!lineUserId || !eventType || !webhookEventId) continue
    if (!['follow', 'unfollow', 'message', 'postback'].includes(eventType)) continue

    const profileResult = eventType === 'unfollow'
      ? { profile: null, complete: false }
      : await fetchLineProfile(lineUserId, accessToken)
    const friendStatus = eventType === 'unfollow'
      ? 'blocked'
      : eventType === 'follow' || profileResult.complete
        ? 'friend'
        : 'unknown'

    const occurredAt = Number.isFinite(event.timestamp)
      ? new Date(event.timestamp as number).toISOString()
      : new Date().toISOString()
    const { error } = await supabase.rpc('record_line_webhook_contact_event', {
      p_webhook_event_id: webhookEventId,
      p_line_user_id: lineUserId,
      p_event_type: eventType,
      p_action_key: eventType,
      p_occurred_at: occurredAt,
      p_display_name: profileResult.profile?.displayName ?? 'LINE 使用者',
      p_picture_url: profileResult.profile?.pictureUrl ?? null,
      p_profile_complete: profileResult.complete,
      p_friend_status: friendStatus,
    })
    if (error) {
      console.error('LINE webhook event persistence failed:', error.message)
      return res.status(500).json({ error: 'Unable to store webhook event' })
    }
  }

  return res.status(200).json({ ok: true })
}

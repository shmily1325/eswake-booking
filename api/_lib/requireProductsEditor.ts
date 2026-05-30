import { createClient } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

const SUPER_ADMINS = [
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
]

type AuthOk = { ok: true; email: string }
type AuthFail = { ok: false; error: string; status: number }

/** 驗證 Bearer token，且使用者具 can_products（或超級管理員） */
export async function requireProductsEditor(req: VercelRequest): Promise<AuthOk | AuthFail> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return { ok: false, error: '未登入', status: 401 }
    }

    const token = authHeader.slice(7)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return { ok: false, error: 'Server 設定錯誤', status: 500 }
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user?.email) {
      return { ok: false, error: '登入已失效，請重新登入', status: 401 }
    }

    const emailLower = user.email.toLowerCase()
    if (SUPER_ADMINS.some((a) => a.toLowerCase() === emailLower)) {
      return { ok: true, email: user.email }
    }

    const { data: row, error: rowErr } = await supabase
      .from('editor_users')
      .select('can_products')
      .eq('email', emailLower)
      .maybeSingle()

    if (rowErr) {
      console.error('[requireProductsEditor] editor_users query failed', rowErr)
      return { ok: false, error: '權限查詢失敗', status: 500 }
    }

    if (!row?.can_products) {
      return { ok: false, error: '沒有商品編輯權限', status: 403 }
    }

    return { ok: true, email: user.email }
  } catch (e) {
    console.error('[requireProductsEditor] unexpected', e)
    return { ok: false, error: '驗證失敗', status: 500 }
  }
}

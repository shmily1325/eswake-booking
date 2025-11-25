import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 自動刷新 token
    autoRefreshToken: true,
    // 持久化 session（使用 localStorage）
    persistSession: true,
    // 檢測 session 變化
    detectSessionInUrl: true,
    // Storage key（避免與其他應用衝突）
    storageKey: 'eswake-booking-auth',
    // 使用 PKCE flow（更安全且更穩定）
    flowType: 'pkce'
  }
})



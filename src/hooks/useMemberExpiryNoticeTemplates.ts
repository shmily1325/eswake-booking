import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalTimestamp } from '../utils/date'
import {
  DEFAULT_MEMBER_EXPIRY_NOTICE_TEMPLATES,
  type MemberExpiryNoticeTemplates,
} from '../utils/memberExpiryNotice'

const SETTING_KEYS = {
  membership: 'member_expiry_notice_membership_template',
  board: 'member_expiry_notice_board_template',
  combined: 'member_expiry_notice_combined_template',
} as const

export type MemberExpiryTemplateSaveStatus = 'loading' | 'saving' | 'saved' | 'error'

export function useMemberExpiryNoticeTemplates(userId?: string) {
  const [templates, setTemplates] = useState<MemberExpiryNoticeTemplates>(
    DEFAULT_MEMBER_EXPIRY_NOTICE_TEMPLATES,
  )
  const [saveStatus, setSaveStatus] = useState<MemberExpiryTemplateSaveStatus>('loading')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', Object.values(SETTING_KEYS))

      if (cancelled) return
      if (error) {
        console.error('載入到期通知範本失敗:', error)
        setSaveStatus('error')
        return
      }

      const settings = new Map(
        (data ?? []).map((item) => [item.setting_key, item.setting_value ?? '']),
      )
      const nextTemplates = {
        membership:
          settings.get(SETTING_KEYS.membership) ||
          DEFAULT_MEMBER_EXPIRY_NOTICE_TEMPLATES.membership,
        board:
          settings.get(SETTING_KEYS.board) ||
          DEFAULT_MEMBER_EXPIRY_NOTICE_TEMPLATES.board,
        combined:
          settings.get(SETTING_KEYS.combined) ||
          DEFAULT_MEMBER_EXPIRY_NOTICE_TEMPLATES.combined,
      }
      setTemplates(nextTemplates)
      setSaveStatus('saved')
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const saveTemplates = async (nextTemplates: MemberExpiryNoticeTemplates): Promise<boolean> => {
    setSaveStatus('saving')
    const now = getLocalTimestamp()
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        (Object.keys(SETTING_KEYS) as Array<keyof MemberExpiryNoticeTemplates>).map((key) => ({
          setting_key: SETTING_KEYS[key],
          setting_value: nextTemplates[key],
          description: `會員管理到期通知範本（${key}）`,
          updated_at: now,
          updated_by: userId ?? null,
        })),
        { onConflict: 'setting_key' },
      )

    if (error) {
      console.error('儲存到期通知範本失敗:', error)
      setSaveStatus('error')
      return false
    }
    setTemplates(nextTemplates)
    setSaveStatus('saved')
    return true
  }

  return { templates, saveTemplates, saveStatus }
}

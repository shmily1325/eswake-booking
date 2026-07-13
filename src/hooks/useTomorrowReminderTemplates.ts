import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalTimestamp } from '../utils/date'

const SETTING_KEYS = {
  includeWeatherWarning: 'tomorrow_reminder_include_weather_warning',
  weatherWarning: 'tomorrow_reminder_weather_warning',
  footerText: 'tomorrow_reminder_footer_text',
} as const

const DEFAULT_WEATHER_WARNING = `由於近期天氣變化較大，請務必在『啟程前』
透過官方訊息與我們確認最新天氣狀況
別忘了在出發前查收最新訊息哦！`

const DEFAULT_FOOTER_TEXT = `再麻煩幫我們準時抵達哦！謝謝！
明天見哦😊
抵達時 再麻煩幫我按開門鍵提醒教練們幫你開啟停車場鐵閘門 
進來後再麻煩幫我停黃色停車格 
白色的不能停 煩請配合🙏`

export type TemplateSaveStatus = 'loading' | 'saving' | 'saved' | 'error'

export function useTomorrowReminderTemplates(userId?: string) {
  const [includeWeatherWarning, setIncludeWeatherWarning] = useState(true)
  const [weatherWarning, setWeatherWarning] = useState(DEFAULT_WEATHER_WARNING)
  const [footerText, setFooterText] = useState(DEFAULT_FOOTER_TEXT)
  const [saveStatus, setSaveStatus] = useState<TemplateSaveStatus>('loading')
  const loaded = useRef(false)
  const lastSaved = useRef('')

  useEffect(() => {
    let cancelled = false

    const loadTemplates = async () => {
      loaded.current = false
      setSaveStatus('loading')

      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', Object.values(SETTING_KEYS))

      if (cancelled) return
      if (error) {
        console.error('載入明日提醒文字模板失敗:', error)
        setSaveStatus('error')
        return
      }

      const settings = new Map(
        (data ?? []).map(item => [item.setting_key, item.setting_value ?? '']),
      )
      const nextIncludeWeatherWarning =
        settings.get(SETTING_KEYS.includeWeatherWarning) !== 'false'
      const nextWeatherWarning =
        settings.get(SETTING_KEYS.weatherWarning) || DEFAULT_WEATHER_WARNING
      const nextFooterText =
        settings.get(SETTING_KEYS.footerText) || DEFAULT_FOOTER_TEXT

      lastSaved.current = JSON.stringify([
        nextIncludeWeatherWarning,
        nextWeatherWarning,
        nextFooterText,
      ])
      setIncludeWeatherWarning(nextIncludeWeatherWarning)
      setWeatherWarning(nextWeatherWarning)
      setFooterText(nextFooterText)
      loaded.current = true
      setSaveStatus('saved')
    }

    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded.current) return

    const serialized = JSON.stringify([
      includeWeatherWarning,
      weatherWarning,
      footerText,
    ])
    if (serialized === lastSaved.current) return

    setSaveStatus('saving')
    const timeoutId = window.setTimeout(async () => {
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          [
            {
              setting_key: SETTING_KEYS.includeWeatherWarning,
              setting_value: String(includeWeatherWarning),
              description: '明日提醒是否包含天氣警告',
              updated_at: getLocalTimestamp(),
              updated_by: userId ?? null,
            },
            {
              setting_key: SETTING_KEYS.weatherWarning,
              setting_value: weatherWarning,
              description: '明日提醒天氣警告文字',
              updated_at: getLocalTimestamp(),
              updated_by: userId ?? null,
            },
            {
              setting_key: SETTING_KEYS.footerText,
              setting_value: footerText,
              description: '明日提醒結尾文字',
              updated_at: getLocalTimestamp(),
              updated_by: userId ?? null,
            },
          ],
          { onConflict: 'setting_key' },
        )

      if (error) {
        console.error('儲存明日提醒文字模板失敗:', error)
        setSaveStatus('error')
        return
      }

      lastSaved.current = serialized
      setSaveStatus('saved')
    }, 600)

    return () => window.clearTimeout(timeoutId)
  }, [footerText, includeWeatherWarning, userId, weatherWarning])

  return {
    includeWeatherWarning,
    setIncludeWeatherWarning,
    weatherWarning,
    setWeatherWarning,
    footerText,
    setFooterText,
    saveStatus,
  }
}

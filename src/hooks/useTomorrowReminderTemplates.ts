import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalTimestamp } from '../utils/date'

const SETTING_KEYS = {
  includeWeatherWarning: 'tomorrow_reminder_include_weather_warning',
  weatherWarning: 'tomorrow_reminder_weather_warning',
  footerText: 'tomorrow_reminder_footer_text',
  englishFooterText: 'tomorrow_reminder_english_footer_text',
  englishWeatherWarning: 'tomorrow_reminder_english_weather_warning',
} as const

const DEFAULT_WEATHER_WARNING = '近期天氣變化較大，請在出發前透過官方 LINE 與我們確認最新天氣，並留意最新訊息哦！'

const DEFAULT_FOOTER_TEXT = `抵達時請按官方 LINE 下方的「芝麻開門」，通知教練協助開啟停車場鐵閘門。
入場後請停黃色停車格，白色停車格請勿停放，謝謝配合🙏

再麻煩準時抵達，明天見哦😊`

const DEFAULT_ENGLISH_FOOTER_TEXT = `When you arrive, tap "OPEN SESAME" at the bottom of our official LINE account to notify the coaches to open the parking gate.
Please park in a yellow space. Do not park in the white spaces. Thank you for your cooperation. 🙏

Please arrive on time. See you tomorrow! 😊`

const DEFAULT_ENGLISH_WEATHER_WARNING = 'Weather conditions have been changing recently. Before you leave, please check the latest weather with us through our official LINE account and watch for updates.'

export type TemplateSaveStatus = 'loading' | 'saving' | 'saved' | 'error'

export function useTomorrowReminderTemplates(userId?: string) {
  const [includeWeatherWarning, setIncludeWeatherWarning] = useState(true)
  const [weatherWarning, setWeatherWarning] = useState(DEFAULT_WEATHER_WARNING)
  const [footerText, setFooterText] = useState(DEFAULT_FOOTER_TEXT)
  const [englishFooterText, setEnglishFooterText] = useState(DEFAULT_ENGLISH_FOOTER_TEXT)
  const [englishWeatherWarning, setEnglishWeatherWarning] = useState(DEFAULT_ENGLISH_WEATHER_WARNING)
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
      const nextEnglishFooterText =
        settings.get(SETTING_KEYS.englishFooterText) || DEFAULT_ENGLISH_FOOTER_TEXT
      const nextEnglishWeatherWarning =
        settings.get(SETTING_KEYS.englishWeatherWarning) || DEFAULT_ENGLISH_WEATHER_WARNING

      lastSaved.current = JSON.stringify([
        nextIncludeWeatherWarning,
        nextWeatherWarning,
        nextFooterText,
        nextEnglishFooterText,
        nextEnglishWeatherWarning,
      ])
      setIncludeWeatherWarning(nextIncludeWeatherWarning)
      setWeatherWarning(nextWeatherWarning)
      setFooterText(nextFooterText)
      setEnglishFooterText(nextEnglishFooterText)
      setEnglishWeatherWarning(nextEnglishWeatherWarning)
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
      englishFooterText,
      englishWeatherWarning,
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
            {
              setting_key: SETTING_KEYS.englishFooterText,
              setting_value: englishFooterText,
              description: '明日提醒英文結尾文字',
              updated_at: getLocalTimestamp(),
              updated_by: userId ?? null,
            },
            {
              setting_key: SETTING_KEYS.englishWeatherWarning,
              setting_value: englishWeatherWarning,
              description: '明日提醒英文天氣警告文字',
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
  }, [
    englishFooterText,
    englishWeatherWarning,
    footerText,
    includeWeatherWarning,
    userId,
    weatherWarning,
  ])

  return {
    includeWeatherWarning,
    setIncludeWeatherWarning,
    weatherWarning,
    setWeatherWarning,
    footerText,
    setFooterText,
    englishFooterText,
    setEnglishFooterText,
    englishWeatherWarning,
    setEnglishWeatherWarning,
    saveStatus,
  }
}

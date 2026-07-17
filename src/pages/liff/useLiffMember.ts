import { useState, useEffect, useCallback } from 'react'
import liff from '@line/liff'
import { supabase } from '../../lib/supabase'
import { getLocalTimestamp } from '../../utils/date'
import { triggerHaptic } from '../../utils/haptic'
import type { Member } from './types'
import {
  initLiffSdk,
  ensureLiffLoggedIn,
  isFirstDocumentLoadThisNavigation,
  unknownErrorMessage,
  enrichMemberForLiff,
  liteMemberFromRow,
  LIFF_MEMBER_SELECT,
  LIFF_INIT_FAST_RETRY_DELAYS_MS,
  updateLiffMemberBirthday,
} from './liffMemberShared'
import { liffTrackFlushQueueNow } from './track'

export interface UseLiffMemberOptions {
  /** 未綁定時是否強制顯示綁定表單（預設 true，預約頁設 false） */
  requireBinding?: boolean
  /** LIFF 初始化成功後的追蹤 icon_id */
  trackIconId?: string
  /** 覆寫 LIFF App ID（預約頁用 VITE_LIFF_BOOK_ID） */
  liffId?: string
  /** 先顯示頁面，背景查綁定（預約頁用） */
  nonBlockingBinding?: boolean
  /** 預約頁：liff.init 成功後先出表單，profile 背景載入 */
  readyBeforeProfile?: boolean
  /** 綁定查詢略過置板／雙人會籍（預約頁用） */
  lightMember?: boolean
}

export function useLiffMember(options: UseLiffMemberOptions = {}) {
  const {
    requireBinding = true,
    trackIconId = 'liff_open',
    liffId: liffIdOverride,
    nonBlockingBinding = false,
    readyBeforeProfile = false,
    lightMember = false,
  } = options

  const [loading, setLoading] = useState(true)
  const [bootPhase, setBootPhase] = useState<'init' | 'login'>('init')
  const [bindingLoading, setBindingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [lineDisplayName, setLineDisplayName] = useState<string | null>(null)
  const [showBindingForm, setShowBindingForm] = useState(false)
  const [skippedBinding, setSkippedBinding] = useState(false)

  const [phone, setPhone] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [binding, setBinding] = useState(false)
  const [bindingError, setBindingError] = useState<string | null>(null)

  const resolveMember = useCallback(
    async (memberData: Record<string, unknown>): Promise<Member> => {
      if (lightMember) return liteMemberFromRow(memberData)
      return enrichMemberForLiff(memberData)
    },
    [lightMember],
  )

  const checkBinding = useCallback(async (userId: string, displayName: string | null) => {
    if (nonBlockingBinding) setBindingLoading(true)
    try {
      const { data: binding } = await supabase
        .from('line_bindings')
        .select(`member_id, members(${LIFF_MEMBER_SELECT})`)
        .eq('line_user_id', userId)
        .eq('status', 'active')
        .single()

      if (binding?.members) {
        const memberData = binding.members as Record<string, unknown>
        const resolved = await resolveMember(memberData)
        setMember(resolved)
        setShowBindingForm(false)
        void liffTrackFlushQueueNow()
        void import('./track').then(({ liffTrack }) => {
          liffTrack({
            icon_id: trackIconId,
            line_user_id: userId,
            member_id: resolved.id,
            extras: { display_name: displayName ?? undefined },
          })
        })
      } else if (requireBinding) {
        setShowBindingForm(true)
        void import('./track').then(({ liffTrack }) => {
          liffTrack({
            icon_id: trackIconId,
            line_user_id: userId,
            extras: { display_name: displayName ?? undefined },
          })
        })
      } else {
        setShowBindingForm(false)
        void import('./track').then(({ liffTrack }) => {
          liffTrack({
            icon_id: trackIconId,
            line_user_id: userId,
            extras: { display_name: displayName ?? undefined },
          })
        })
      }
    } catch {
      if (requireBinding) setShowBindingForm(true)
    } finally {
      if (nonBlockingBinding) {
        setBindingLoading(false)
      } else {
        setLoading(false)
      }
    }
  }, [requireBinding, trackIconId, nonBlockingBinding, resolveMember])

  const initLiff = useCallback(async () => {
    setBootPhase('init')
    try {
      const liffId = liffIdOverride ?? import.meta.env.VITE_LIFF_ID
      if (!liffId) {
        setError('LIFF ID 未設置')
        setLoading(false)
        return
      }

      await initLiffSdk(liffId, readyBeforeProfile ? { retryDelaysMs: LIFF_INIT_FAST_RETRY_DELAYS_MS } : undefined)

      const loginResult = await ensureLiffLoggedIn()
      if (loginResult === 'login_redirect') {
        setBootPhase('login')
        return
      }
      if (loginResult === 'reload') return

      if (nonBlockingBinding && readyBeforeProfile) {
        setLoading(false)
        void (async () => {
          try {
            const profile = await liff.getProfile()
            setLineUserId(profile.userId)
            setLineDisplayName(profile.displayName ?? null)
            await checkBinding(profile.userId, profile.displayName ?? null)
          } catch (err: unknown) {
            console.error('LIFF profile 載入失敗:', err)
            setError(unknownErrorMessage(err, 'LIFF 初始化失敗'))
          }
        })()
        return
      }

      const profile = await liff.getProfile()
      setLineUserId(profile.userId)
      setLineDisplayName(profile.displayName ?? null)

      if (nonBlockingBinding) {
        setLoading(false)
        void checkBinding(profile.userId, profile.displayName ?? null)
      } else {
        await checkBinding(profile.userId, profile.displayName ?? null)
      }
    } catch (err: unknown) {
      console.error('LIFF 初始化失敗:', err)
      const msg = unknownErrorMessage(err, '')
      if (msg.includes('Unable to load client features') && isFirstDocumentLoadThisNavigation()) {
        window.location.reload()
        return
      }
      setError(unknownErrorMessage(err, 'LIFF 初始化失敗'))
      setLoading(false)
    }
  }, [checkBinding, liffIdOverride, nonBlockingBinding, readyBeforeProfile])

  useEffect(() => {
    void initLiff()
  }, [initLiff])

  const handleBinding = useCallback(async () => {
    if (!phone || !lineUserId) return

    triggerHaptic('medium')
    setBinding(true)
    setBindingError(null)
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      const { data: allMembers } = await supabase
        .from('members')
        .select('id, name, nickname, phone, status')

      if (!allMembers?.length) {
        setBindingError('無法查詢會員資料，請稍後再試')
        return
      }

      const memberData = allMembers.find(m => {
        const dbPhone = m.phone?.replace(/\D/g, '') || ''
        return dbPhone === cleanPhone && m.status === 'active'
      })

      if (!memberData) {
        triggerHaptic('error')
        setBindingError('找不到此手機號碼的會員資料')
        return
      }

      const { error: bindError } = await supabase
        .from('line_bindings')
        .upsert({
          line_user_id: lineUserId,
          member_id: memberData.id,
          phone: memberData.phone,
          status: 'active',
          completed_at: getLocalTimestamp(),
          created_at: getLocalTimestamp(),
        }, { onConflict: 'line_user_id' })

      if (bindError) {
        triggerHaptic('error')
        setBindingError('綁定失敗：' + bindError.message)
        return
      }

      if (birthYear && birthMonth && birthDay) {
        const birthday = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
        const birthdayError = await updateLiffMemberBirthday(lineUserId, birthday)
        if (birthdayError) {
          console.warn('LIFF 生日更新失敗:', birthdayError)
        }
      }

      triggerHaptic('success')
      const { data: fullMemberData } = await supabase
        .from('members')
        .select(LIFF_MEMBER_SELECT)
        .eq('id', memberData.id)
        .single()

      const enriched = await resolveMember((fullMemberData ?? memberData) as Record<string, unknown>)
      setMember(enriched)
      setShowBindingForm(false)
      setSkippedBinding(false)
    } catch (err: unknown) {
      console.error('綁定失敗:', err)
      setBindingError('綁定失敗，請稍後再試')
    } finally {
      setBinding(false)
    }
  }, [phone, lineUserId, birthYear, birthMonth, birthDay, resolveMember])

  const skipBinding = useCallback(() => {
    triggerHaptic('light')
    setSkippedBinding(true)
    setShowBindingForm(false)
  }, [])

  const shouldShowBindingForm = showBindingForm && !skippedBinding

  return {
    loading,
    bootPhase,
    bindingLoading,
    error,
    member,
    lineUserId,
    lineDisplayName,
    shouldShowBindingForm,
    bindingFormProps: {
      phone,
      setPhone,
      birthYear,
      setBirthYear,
      birthMonth,
      setBirthMonth,
      birthDay,
      setBirthDay,
      binding,
      bindingError,
      setBindingError,
      onSubmit: handleBinding,
    },
    skipBinding,
    retryInit: initLiff,
  }
}

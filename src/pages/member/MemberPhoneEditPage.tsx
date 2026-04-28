import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { useToast, ToastContainer } from '../../components/ui'
import { isMemberPhoneOnlyEditor } from '../../utils/auth'
import { normalizeDate } from '../../utils/date'

interface MemberRow {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  birthday: string | null
  membership_type: string
  membership_partner_id: string | null
  partner?: { name: string; nickname: string | null } | null
  /** 來自 line_bindings（status=active） */
  is_line_bound: boolean
}

function membershipLabel(type: string): string {
  switch (type) {
    case 'general':
      return '一般會員'
    case 'dual':
      return '雙人會員'
    case 'guest':
      return '非會員'
    case 'es':
      return 'ES'
    default:
      return type || '—'
  }
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/** 貼上「0912 345 678」「+886 912 345 678」等可整理成 09 開頭 10 碼；無法辨識則回傳純數字讓驗證擋 */
function toStoredTaiwanMobile(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const d = digitsOnly(t)
  if (!d) return ''
  if (d.startsWith('886')) {
    const rest = d.slice(3)
    if (rest.length === 10 && rest.startsWith('09')) return rest
    if (rest.length === 9 && rest.startsWith('9')) return `0${rest}`
  }
  if (d.length === 10 && d.startsWith('09')) return d
  if (d.length === 9 && d.startsWith('9')) return `0${d}`
  return d
}

function isValidTwMobile10(d: string): boolean {
  return d === '' || /^09\d{8}$/.test(d)
}

export function MemberPhoneEditPage() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [lineBindingFilter, setLineBindingFilter] = useState<'all' | 'bound' | 'unbound'>('all')
  /** 正在編輯手機的會員 id（按「編輯」或點電話欄才會解鎖輸入） */
  const [editingMemberIds, setEditingMemberIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (user && !isMemberPhoneOnlyEditor(user)) {
      toast.error('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [user, navigate, toast])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const [membersRes, lineRes] = await Promise.all([
        supabase
          .from('members')
          .select(
            `
            id, name, nickname, phone, birthday,
            membership_type, membership_partner_id,
            status
          `
          )
          .eq('status', 'active')
          .order('nickname', { ascending: true, nullsFirst: false }),
        supabase.from('line_bindings').select('member_id, line_user_id').eq('status', 'active'),
      ])

      if (membersRes.error) throw membersRes.error
      if (lineRes.error) throw lineRes.error

      const lineBindingsData = (lineRes.data || []) as { member_id: string; line_user_id: string }[]
      const memberIdToLine: Record<string, string> = {}
      lineBindingsData.forEach((b) => {
        if (b.member_id) memberIdToLine[b.member_id] = b.line_user_id
      })

      const rows = (membersRes.data || []) as Omit<MemberRow, 'is_line_bound' | 'partner'>[]
      const partnerIds = [...new Set(rows.map((m) => m.membership_partner_id).filter(Boolean))] as string[]

      let partnersMap: Record<string, { name: string; nickname: string | null }> = {}
      if (partnerIds.length > 0) {
        const { data: partners } = await supabase
          .from('members')
          .select('id, name, nickname')
          .in('id', partnerIds)
        partnersMap = Object.fromEntries((partners || []).map((p: any) => [p.id, p]))
      }

      const withPartners: MemberRow[] = rows.map((m) => ({
        ...m,
        partner: m.membership_partner_id ? partnersMap[m.membership_partner_id] || null : null,
        is_line_bound: Boolean(memberIdToLine[m.id]),
      }))

      setMembers(withPartners)
      const drafts: Record<string, string> = {}
      for (const m of withPartners) {
        drafts[m.id] = m.phone || ''
      }
      setPhoneDrafts(drafts)
      setEditingMemberIds(new Set())
    } catch (e) {
      console.error(e)
      toast.error('載入會員失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && isMemberPhoneOnlyEditor(user)) {
      loadMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const searchFiltered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return members
    const qDigits = q.replace(/\D/g, '')
    return members.filter((m) => {
      const name = (m.name || '').toLowerCase()
      const nick = (m.nickname || '').toLowerCase()
      const phone = (m.phone || '').toLowerCase()
      const draft = (phoneDrafts[m.id] || '').toLowerCase()
      const phoneDigits = digitsOnly(m.phone || '')
      const draftDigits = digitsOnly(phoneDrafts[m.id] || '')
      return (
        name.includes(q) ||
        nick.includes(q) ||
        phone.includes(q) ||
        draft.includes(q) ||
        (qDigits.length >= 3 &&
          (phoneDigits.includes(qDigits) || draftDigits.includes(qDigits)))
      )
    })
  }, [members, searchTerm, phoneDrafts])

  const filtered = useMemo(() => {
    if (lineBindingFilter === 'all') return searchFiltered
    if (lineBindingFilter === 'bound') {
      return searchFiltered.filter((m) => m.is_line_bound)
    }
    return searchFiltered.filter((m) => !m.is_line_bound)
  }, [searchFiltered, lineBindingFilter])

  const savePhone = async (memberId: string) => {
    const normalized = toStoredTaiwanMobile(phoneDrafts[memberId] ?? '')
    if (!isValidTwMobile10(normalized)) {
      toast.warning('電話需為 09 開頭的 10 位數字，或留空（可貼 +886、含空格）')
      return
    }
    setSavingId(memberId)
    try {
      const toSave = normalized || null
      const { error } = await supabase.from('members').update({ phone: toSave }).eq('id', memberId)

      if (error) throw error

      setPhoneDrafts((prev) => ({ ...prev, [memberId]: normalized }))
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, phone: toSave } : m))
      )
      setEditingMemberIds((prev) => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
      toast.success('手機號碼已更新')
    } catch (e) {
      console.error(e)
      toast.error('更新失敗')
    } finally {
      setSavingId(null)
    }
  }

  if (!user || !isMemberPhoneOnlyEditor(user)) {
    return null
  }

  const lineBoundCount = members.filter((m) => m.is_line_bound).length
  const lineUnboundCount = members.length - lineBoundCount

  return (
    <div
      style={{
        padding: isMobile ? '12px 16px' : '20px',
        minHeight: '100dvh',
        background: '#f5f5f5',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      <PageHeader title="📱 會員電話" user={user} showBaoLink={false} />

      <p
        style={{
          fontSize: '14px',
          color: '#666',
          marginBottom: '14px',
          lineHeight: 1.5,
        }}
      >
        按「編輯」或點電話欄可改手機；可貼含空格或 +886，儲存會整理成 09 開頭。編輯中按 Enter 可儲存。
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '10px',
          marginBottom: '12px',
          alignItems: isMobile ? 'stretch' : 'center',
        }}
      >
        <input
          type="text"
          placeholder="🔍 搜尋（姓名、暱稱、手機）"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            padding: isMobile ? '12px 14px' : '12px 16px',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            fontSize: isMobile ? '16px' : '15px',
            outline: 'none',
            background: 'white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            boxSizing: 'border-box',
          }}
        />
        <div
          data-track="member_phone_line_filter"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))' : 'auto auto auto',
            gap: '8px',
            flexShrink: 0,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setLineBindingFilter('all')}
            style={{
              minHeight: 44,
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '13px',
              cursor: 'pointer',
              fontWeight: lineBindingFilter === 'all' ? 600 : 'normal',
              border: `1px solid ${lineBindingFilter === 'all' ? '#5a5a5a' : '#dee2e6'}`,
              background: lineBindingFilter === 'all' ? '#5a5a5a' : 'white',
              color: lineBindingFilter === 'all' ? 'white' : '#333',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            全部 ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setLineBindingFilter(lineBindingFilter === 'bound' ? 'all' : 'bound')}
            style={{
              minHeight: 44,
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '13px',
              cursor: 'pointer',
              fontWeight: lineBindingFilter === 'bound' ? 600 : 'normal',
              border: `1px solid ${lineBindingFilter === 'bound' ? '#06C755' : '#06C755'}`,
              background: lineBindingFilter === 'bound' ? '#06C755' : 'white',
              color: lineBindingFilter === 'bound' ? 'white' : '#06C755',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            已綁定 ({lineBoundCount})
          </button>
          <button
            type="button"
            onClick={() => setLineBindingFilter(lineBindingFilter === 'unbound' ? 'all' : 'unbound')}
            style={{
              minHeight: 44,
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '13px',
              cursor: 'pointer',
              fontWeight: lineBindingFilter === 'unbound' ? 600 : 'normal',
              border: `1px solid ${lineBindingFilter === 'unbound' ? '#888' : '#ddd'}`,
              background: lineBindingFilter === 'unbound' ? '#888' : 'white',
              color: lineBindingFilter === 'unbound' ? 'white' : '#666',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            未綁定 ({lineUnboundCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>載入中…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((m) => {
            const partnerLine =
              m.membership_type === 'dual' && m.partner
                ? `${(m.partner.nickname && m.partner.nickname.trim()) || m.partner.name}`
                : null
            const draftNorm = toStoredTaiwanMobile(phoneDrafts[m.id] ?? '')
            const storedNorm = toStoredTaiwanMobile(m.phone || '')
            const draftInvalid = draftNorm !== '' && !/^09\d{8}$/.test(draftNorm)
            const saveDisabled =
              savingId === m.id || draftInvalid || draftNorm === storedNorm
            const isEditing = editingMemberIds.has(m.id)
            return (
              <div
                key={m.id}
                style={{
                  background: 'white',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  border: '1px solid #e8e8e8',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: '8px 16px',
                    fontSize: '14px',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <span style={{ color: '#888' }}>姓名：</span>
                    {m.name}
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>暱稱：</span>
                    {m.nickname?.trim() || '—'}
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>生日：</span>
                    {normalizeDate(m.birthday) || '—'}
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>會員類型：</span>
                    {membershipLabel(m.membership_type)}
                    {partnerLine ? `（配對：${partnerLine}）` : ''}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    flexWrap: isMobile ? 'nowrap' : 'wrap',
                    gap: isMobile ? '10px' : '10px',
                    alignItems: isMobile ? 'stretch' : 'center',
                    borderTop: '1px solid #eee',
                    paddingTop: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        color: '#666',
                        fontSize: isMobile ? '15px' : '14px',
                        fontWeight: 600,
                      }}
                    >
                      手機
                    </span>
                    <span
                      title={m.is_line_bound ? 'LINE 已綁定' : 'LINE 未綁定'}
                      style={{
                        display: 'inline-block',
                        fontSize: '12px',
                        fontWeight: 600,
                        lineHeight: 1.2,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: m.is_line_bound ? '#e8f5e9' : '#f5f5f5',
                        color: m.is_line_bound ? '#2e7d32' : '#9e9e9e',
                        border: `1px solid ${m.is_line_bound ? '#a5d6a7' : '#e0e0e0'}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isMobile
                        ? m.is_line_bound
                          ? '已綁定'
                          : '未綁定'
                        : m.is_line_bound
                          ? '✅ LINE 已綁定'
                          : '❌ LINE 未綁定'}
                    </span>
                  </div>
                  {isMobile ? (
                    isEditing ? (
                      <>
                        <input
                          type="tel"
                          inputMode="tel"
                          enterKeyHint="done"
                          autoComplete="tel"
                          autoFocus
                          value={phoneDrafts[m.id] ?? ''}
                          onChange={(e) =>
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          onBlur={() => {
                            const raw = phoneDrafts[m.id] ?? ''
                            const n = toStoredTaiwanMobile(raw)
                            if (n === raw.trim() || !isValidTwMobile10(n)) return
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: n }))
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            if (!saveDisabled) void savePhone(m.id)
                          }}
                          placeholder="0912345678 或貼上 +886…"
                          style={{
                            width: '100%',
                            minHeight: 52,
                            padding: '14px 16px',
                            border: '1px solid #5a5a5a',
                            borderRadius: '8px',
                            fontSize: '16px',
                            boxSizing: 'border-box',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        />
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            width: '100%',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => savePhone(m.id)}
                            disabled={saveDisabled}
                            style={{
                              minHeight: 50,
                              padding: '12px 16px',
                              background: '#5a5a5a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '16px',
                              fontWeight: 600,
                              cursor: savingId === m.id ? 'wait' : 'pointer',
                              opacity: saveDisabled && savingId !== m.id ? 0.45 : 1,
                            }}
                          >
                            {savingId === m.id ? '儲存中…' : '儲存'}
                          </button>
                          <button
                            type="button"
                            disabled={savingId === m.id}
                            onClick={() => {
                              setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                              setEditingMemberIds((prev) => {
                                const next = new Set(prev)
                                next.delete(m.id)
                                return next
                              })
                            }}
                            style={{
                              minHeight: 50,
                              padding: '12px 16px',
                              background: 'white',
                              color: '#555',
                              border: '1px solid #ccc',
                              borderRadius: '8px',
                              fontSize: '16px',
                              fontWeight: 600,
                              cursor: savingId === m.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            取消
                          </button>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'stretch',
                          width: '100%',
                        }}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                            setEditingMemberIds((prev) => new Set(prev).add(m.id))
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                              setEditingMemberIds((prev) => new Set(prev).add(m.id))
                            }
                          }}
                          title="點一下可編輯手機"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 50,
                            padding: '14px 16px',
                            border: '1px solid #e8e8e8',
                            borderRadius: '8px',
                            fontSize: '16px',
                            boxSizing: 'border-box',
                            background: '#fafafa',
                            color: m.phone ? '#222' : '#999',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          {m.phone?.trim() || '未填寫'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                            setEditingMemberIds((prev) => new Set(prev).add(m.id))
                          }}
                          style={{
                            flexShrink: 0,
                            minWidth: 88,
                            minHeight: 50,
                            padding: '12px 16px',
                            background: 'white',
                            color: '#333',
                            border: '1px solid #888',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          編輯
                        </button>
                      </div>
                    )
                  ) : (
                    <>
                      {isEditing ? (
                        <input
                          type="tel"
                          inputMode="tel"
                          enterKeyHint="done"
                          autoComplete="tel"
                          autoFocus
                          value={phoneDrafts[m.id] ?? ''}
                          onChange={(e) =>
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          onBlur={() => {
                            const raw = phoneDrafts[m.id] ?? ''
                            const n = toStoredTaiwanMobile(raw)
                            if (n === raw.trim() || !isValidTwMobile10(n)) return
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: n }))
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            if (!saveDisabled) void savePhone(m.id)
                          }}
                          placeholder="0912345678 或貼上 +886…"
                          style={{
                            flex: '1 1 200px',
                            minWidth: '160px',
                            minHeight: 44,
                            padding: '12px 14px',
                            border: '1px solid #bbb',
                            borderRadius: '8px',
                            fontSize: '16px',
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                            setEditingMemberIds((prev) => new Set(prev).add(m.id))
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                              setEditingMemberIds((prev) => new Set(prev).add(m.id))
                            }
                          }}
                          title="點一下可編輯手機"
                          style={{
                            flex: '1 1 200px',
                            minWidth: '160px',
                            minHeight: 44,
                            padding: '12px 14px',
                            border: '1px solid #e8e8e8',
                            borderRadius: '8px',
                            fontSize: '16px',
                            boxSizing: 'border-box',
                            background: '#fafafa',
                            color: m.phone ? '#222' : '#999',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          {m.phone?.trim() || '未填寫'}
                        </span>
                      )}
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => savePhone(m.id)}
                            disabled={saveDisabled}
                            style={{
                              padding: '12px 22px',
                              minHeight: 44,
                              background: '#5a5a5a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '15px',
                              fontWeight: 600,
                              cursor: savingId === m.id ? 'wait' : 'pointer',
                              opacity: saveDisabled && savingId !== m.id ? 0.45 : 1,
                              flexShrink: 0,
                            }}
                          >
                            {savingId === m.id ? '儲存中…' : '儲存'}
                          </button>
                          <button
                            type="button"
                            disabled={savingId === m.id}
                            onClick={() => {
                              setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                              setEditingMemberIds((prev) => {
                                const next = new Set(prev)
                                next.delete(m.id)
                                return next
                              })
                            }}
                            style={{
                              padding: '12px 22px',
                              minHeight: 44,
                              background: 'white',
                              color: '#555',
                              border: '1px solid #ccc',
                              borderRadius: '8px',
                              fontSize: '15px',
                              fontWeight: 600,
                              cursor: savingId === m.id ? 'not-allowed' : 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneDrafts((prev) => ({ ...prev, [m.id]: m.phone || '' }))
                            setEditingMemberIds((prev) => new Set(prev).add(m.id))
                          }}
                          style={{
                            padding: '12px 22px',
                            minHeight: 44,
                            background: 'white',
                            color: '#333',
                            border: '1px solid #888',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          編輯
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>沒有符合的會員</div>
      )}

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

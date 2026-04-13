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
  /** 正在編輯手機的會員 id（須先按「編輯」才會解鎖輸入，避免誤觸） */
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
      const { data: membersData, error } = await supabase
        .from('members')
        .select(
          `
            id, name, nickname, phone, birthday,
            membership_type, membership_partner_id,
            status
          `
        )
        .eq('status', 'active')
        .order('nickname', { ascending: true, nullsFirst: false })

      if (error) throw error

      const rows = (membersData || []) as MemberRow[]
      const partnerIds = [...new Set(rows.map((m) => m.membership_partner_id).filter(Boolean))] as string[]

      let partnersMap: Record<string, { name: string; nickname: string | null }> = {}
      if (partnerIds.length > 0) {
        const { data: partners } = await supabase
          .from('members')
          .select('id, name, nickname')
          .in('id', partnerIds)
        partnersMap = Object.fromEntries((partners || []).map((p: any) => [p.id, p]))
      }

      const withPartners = rows.map((m) => ({
        ...m,
        partner: m.membership_partner_id ? partnersMap[m.membership_partner_id] || null : null,
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

  const filtered = useMemo(() => {
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
        先按「編輯」再改手機；可貼含空格或 +886，儲存會整理成 09 開頭。編輯中按 Enter 可儲存。
      </p>

      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="🔍 搜尋（姓名、暱稱、手機）"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: isMobile ? '12px 14px' : '12px 16px',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            fontSize: '15px',
            outline: 'none',
            background: 'white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            boxSizing: 'border-box',
          }}
        />
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
                  <span
                    style={{
                      color: '#666',
                      fontSize: isMobile ? '15px' : '14px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    手機
                  </span>
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
                        flex: isMobile ? 'none' : '1 1 200px',
                        width: isMobile ? '100%' : undefined,
                        minWidth: isMobile ? undefined : '160px',
                        minHeight: isMobile ? 48 : 44,
                        padding: isMobile ? '14px 14px' : '12px 14px',
                        border: '1px solid #bbb',
                        borderRadius: '10px',
                        fontSize: isMobile ? '16px' : '16px',
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: isMobile ? 'none' : '1 1 200px',
                        width: isMobile ? '100%' : undefined,
                        minHeight: isMobile ? 48 : 44,
                        padding: isMobile ? '14px 14px' : '12px 14px',
                        border: '1px solid #e8e8e8',
                        borderRadius: '10px',
                        fontSize: isMobile ? '16px' : '16px',
                        boxSizing: 'border-box',
                        background: '#fafafa',
                        color: m.phone ? '#222' : '#999',
                        display: 'flex',
                        alignItems: 'center',
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
                          padding: isMobile ? '14px 20px' : '12px 22px',
                          minHeight: isMobile ? 48 : 44,
                          background: '#5a5a5a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: isMobile ? '16px' : '15px',
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
                          padding: isMobile ? '14px 20px' : '12px 22px',
                          minHeight: isMobile ? 48 : 44,
                          background: 'white',
                          color: '#555',
                          border: '1px solid #ccc',
                          borderRadius: '10px',
                          fontSize: isMobile ? '16px' : '15px',
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
                        padding: isMobile ? '14px 20px' : '12px 22px',
                        minHeight: isMobile ? 48 : 44,
                        background: 'white',
                        color: '#333',
                        border: '1px solid #888',
                        borderRadius: '10px',
                        fontSize: isMobile ? '16px' : '15px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      編輯
                    </button>
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

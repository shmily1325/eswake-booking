import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { TransactionDialog } from '../../components/TransactionDialog'
import { useResponsive } from '../../hooks/useResponsive'
import type { Member } from '../../types/booking'
import { useToast } from '../../components/ui'
import { isAdmin } from '../../utils/auth'
import {
  designSystem,
  getBadgeStyle,
  getButtonStyle,
  getEmptyStateStyle,
  getFilterChipStyle,
  getFontSize,
  getInputStyle,
  getPageContentShellStyle,
} from '../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]
const cardShadowHover = designSystem.shadows.elevation[2]

// 擴展 Member 類型，加入最後交易日期、更新日期與 LINE 綁定（衍生欄位）
interface MemberWithLastTransaction extends Member {
  lastTransactionDate?: string | null
  lastTransactionCreatedAt?: string | null  // 最新交易的 created_at
  line_binding_user_id?: string | null
  is_line_bound?: boolean
}

export function MemberTransaction() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const userIsAdmin = isAdmin(user)
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [members, setMembers] = useState<MemberWithLastTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // 新增的 state
  /** 手機：篩選下拉預設收合，避免佔滿螢幕又與 sticky 疊加難以瀏覽列表 */
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false)
  /** 手機：總覽數字預設收合 */
  const [mobileOverviewExpanded, setMobileOverviewExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<'nickname' | 'balance' | 'vip' | 'g23' | 'g21' | 'lastTransaction' | 'updatedAt'>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<string>('all') // 會員種類篩選
  const [lineBindingFilter, setLineBindingFilter] = useState<'all' | 'bound' | 'unbound'>('all')

  const handleUnbindLine = async (memberId: string, memberDisplayName: string) => {
    try {
      const confirmed = window.confirm(`確定要移除「${memberDisplayName}」的 LINE 綁定嗎？`)
      if (!confirmed) return

      const { error } = await supabase
        .from('line_bindings')
        .update({ status: 'revoked' })
        .eq('member_id', memberId)
        .eq('status', 'active')

      if (error) throw error

      toast.success('已移除 LINE 綁定')
      await loadMembers()
    } catch (err) {
      console.error('移除 LINE 綁定失敗:', err)
      toast.error('移除 LINE 綁定失敗')
    }
  }

  // 載入會員列表（含最後交易日期與 LINE 綁定）
  const loadMembers = async () => {
    setLoading(true)
    try {
      const [membersResult, transactionsResult, lineBindingsResult] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('transactions')
          .select('member_id, transaction_date, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('line_bindings')
          .select('member_id, line_user_id')
          .eq('status', 'active')
      ])

      if (membersResult.error) throw membersResult.error
      if (lineBindingsResult.error) {
        console.error('載入 LINE 綁定失敗:', lineBindingsResult.error)
      }

      // 整理每個會員的最後交易日期和 created_at
      const lastTransactionMap: Record<string, { date: string; createdAt: string }> = {}
      if (transactionsResult.data) {
        for (const t of transactionsResult.data) {
          if (t.member_id && !lastTransactionMap[t.member_id]) {
            lastTransactionMap[t.member_id] = {
              date: t.transaction_date,
              createdAt: t.created_at || t.transaction_date
            }
          }
        }
      }

      const lineBindingsData = lineBindingsResult.data || []
      const memberIdToLineBinding: Record<string, string> = {}
      lineBindingsData.forEach((b) => {
        if (b.member_id) {
          memberIdToLineBinding[b.member_id] = b.line_user_id
        }
      })

      // 合併資料
      const membersWithLastTransaction = (membersResult.data || []).map(m => ({
        ...m,
        lastTransactionDate: lastTransactionMap[m.id]?.date || null,
        lastTransactionCreatedAt: lastTransactionMap[m.id]?.createdAt || null,
        line_binding_user_id: memberIdToLineBinding[m.id] || null,
        is_line_bound: Boolean(memberIdToLineBinding[m.id])
      }))

      setMembers(membersWithLastTransaction)
    } catch (error) {
      console.error('載入會員失敗:', error)
      toast.error('載入會員列表失敗')
    } finally {
      setLoading(false)
    }
  }

  /** 會員儲值僅限超級管理員（與會員管理、BAO 一致） */
  useEffect(() => {
    if (!user) return
    if (!userIsAdmin) {
      setLoading(false)
      toast.error('會員儲值僅限管理員使用')
      navigate('/')
    }
  }, [user, userIsAdmin, navigate, toast])

  useEffect(() => {
    if (!userIsAdmin) return
    void loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsAdmin])

  // 使用 useMemo 計算過濾和排序後的會員列表
  const filteredMembers = useMemo(() => {
    let result = members

    // 會員種類篩選
    if (membershipTypeFilter !== 'all') {
      result = result.filter(member => {
        if (membershipTypeFilter === 'member') {
          return member.membership_type === 'general' || member.membership_type === 'dual'
        }
        return member.membership_type === membershipTypeFilter
      })
    }

    if (lineBindingFilter === 'bound') {
      result = result.filter(m => m.is_line_bound)
    } else if (lineBindingFilter === 'unbound') {
      result = result.filter(m => !m.is_line_bound)
    }

    // 搜尋過濾
    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(m =>
        (m.name || '').toLowerCase().includes(lowerSearch) ||
        m.nickname?.toLowerCase().includes(lowerSearch) ||
        m.phone?.includes(searchTerm)
      )
    }

    // 排序
    result = [...result].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'balance':
          comparison = (a.balance || 0) - (b.balance || 0)
          break
        case 'vip':
          comparison = (a.vip_voucher_amount || 0) - (b.vip_voucher_amount || 0)
          break
        case 'g23':
          comparison = (a.boat_voucher_g23_minutes || 0) - (b.boat_voucher_g23_minutes || 0)
          break
        case 'g21':
          comparison = (a.boat_voucher_g21_panther_minutes || 0) - (b.boat_voucher_g21_panther_minutes || 0)
          break
        case 'lastTransaction':
          // 空值排最後
          if (!a.lastTransactionDate && !b.lastTransactionDate) return 0
          if (!a.lastTransactionDate) return 1
          if (!b.lastTransactionDate) return -1
          comparison = a.lastTransactionDate.localeCompare(b.lastTransactionDate)
          break
        case 'updatedAt':
          // 用最新交易的 created_at 排序，空值排最後
          if (!a.lastTransactionCreatedAt && !b.lastTransactionCreatedAt) return 0
          if (!a.lastTransactionCreatedAt) return 1
          if (!b.lastTransactionCreatedAt) return -1
          comparison = a.lastTransactionCreatedAt.localeCompare(b.lastTransactionCreatedAt)
          break
        case 'nickname':
        default:
          const nameA = (a.nickname || a.name || '').toLowerCase()
          const nameB = (b.nickname || b.name || '').toLowerCase()
          comparison = nameA.localeCompare(nameB, 'zh-TW')
          break
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return result
  }, [members, searchTerm, sortBy, sortOrder, membershipTypeFilter, lineBindingFilter])

  // 計算統計數據（根據篩選結果動態計算）
  const stats = useMemo(() => {
    return {
      totalBalance: filteredMembers.reduce((sum, m) => sum + (m.balance || 0), 0),
      totalVipVoucher: filteredMembers.reduce((sum, m) => sum + (m.vip_voucher_amount || 0), 0),
      totalDesignatedLesson: filteredMembers.reduce((sum, m) => sum + (m.designated_lesson_minutes || 0), 0),
      totalG23: filteredMembers.reduce((sum, m) => sum + (m.boat_voucher_g23_minutes || 0), 0),
      totalG21: filteredMembers.reduce((sum, m) => sum + (m.boat_voucher_g21_panther_minutes || 0), 0),
      totalGiftBoat: filteredMembers.reduce((sum, m) => sum + (m.gift_boat_hours || 0), 0),
      memberCount: filteredMembers.length
    }
  }, [filteredMembers])

  const handleMemberClick = (member: Member) => {
    setSelectedMember(member)
    setShowTransactionDialog(true)
  }

  const handleTransactionSuccess = () => {
    loadMembers()
  }

  if (!userIsAdmin) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: designSystem.colors.text.secondary, background: pageBg }}>
        載入中…
      </div>
    )
  }

  return (
    <div style={{
      padding: isMobile ? '12px 16px' : '20px',
      minHeight: '100dvh',
      background: pageBg,
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
    }}>
      <div style={getPageContentShellStyle(isMobile)}>
      {/* 桌面：整段 sticky；手機：僅搜尋列 sticky */}
      <div style={{
        position: isMobile ? 'static' : 'sticky',
        top: 0,
        zIndex: isMobile ? undefined : 100,
        background: pageBg,
        marginLeft: isMobile ? '-16px' : 0,
        marginRight: isMobile ? '-16px' : 0,
        marginTop: isMobile ? '-12px' : '-20px',
        paddingLeft: isMobile ? '16px' : 0,
        paddingRight: isMobile ? '16px' : 0,
        paddingTop: isMobile ? '12px' : '20px',
        paddingBottom: '12px',
        borderBottom: isMobile ? undefined : `1px solid ${designSystem.colors.border.light}`,
      }}>
        <PageHeader 
          title="儲值" 
          user={user} 
          showBaoLink={isAdmin(user)}
          extraLinks={
            isAdmin(user)
              ? [{ label: '會員', link: '/members' }]
              : undefined
          }
        />
        {/* 搜尋欄（手機：sticky 固定在頂部；桌面：隨 header 一起 sticky） */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '12px',
          alignItems: 'center',
          ...(isMobile ? {
            position: 'sticky',
            top: 'env(safe-area-inset-top, 0px)',
            zIndex: 90,
            paddingTop: '6px',
            paddingBottom: '10px',
            background: pageBg,
            boxShadow: designSystem.shadows.xs,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
          } : {}),
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="搜尋會員（姓名、暱稱）"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                if (e.target.value && membershipTypeFilter !== 'all') {
                  setMembershipTypeFilter('all')
                }
              }}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                paddingRight: searchTerm ? '40px' : undefined,
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: designSystem.colors.text.secondary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  fontSize: getFontSize('body', isMobile),
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileOverviewExpanded((v) => !v)}
            style={{
              width: '100%',
              marginBottom: '10px',
              padding: '10px 12px',
              border: cardBorder,
              borderRadius: designSystem.borderRadius.lg,
              fontSize: getFontSize('body', isMobile),
              background: designSystem.colors.background.card,
              color: designSystem.colors.text.primary,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: designSystem.shadows.xs,
            }}
          >
            {mobileOverviewExpanded
              ? '收合總覽'
              : '總覽（數字）'}
          </button>
        )}

        {(!isMobile || mobileOverviewExpanded) && (
        <>
        {/* 數據總覽 */}
        <div style={{
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.lg,
          padding: isMobile ? '16px' : '20px',
          marginBottom: '16px',
          border: cardBorder,
          boxShadow: cardShadow,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '12px' : '16px',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>總儲值</div>
              <div style={{ fontSize: isMobile ? getFontSize('h3', isMobile) : getFontSize('h2', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                ${stats.totalBalance.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>總VIP票券</div>
              <div style={{ fontSize: isMobile ? getFontSize('h3', isMobile) : getFontSize('h2', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                ${stats.totalVipVoucher.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>總G23船券</div>
              <div style={{ fontSize: isMobile ? getFontSize('h3', isMobile) : getFontSize('h2', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                {stats.totalG23.toLocaleString()}分
              </div>
            </div>
            <div>
              <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>總G21/黑豹</div>
              <div style={{ fontSize: isMobile ? getFontSize('h3', isMobile) : getFontSize('h2', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                {stats.totalG21.toLocaleString()}分
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        {/* 篩選列 - 手機版用下拉選單，桌面版用按鈕 */}
        {isMobile ? (
          /* 手機版：篩選預設收合，展開後才顯示下拉選單 */
          <>
            {(() => {
              const filtersActive = membershipTypeFilter !== 'all' || lineBindingFilter !== 'all'
              return (
            <button
              type="button"
              onClick={() => setMobileFiltersExpanded((v) => !v)}
              style={{
                width: '100%',
                marginBottom: '10px',
                padding: '10px 12px',
                border: cardBorder,
                borderRadius: designSystem.borderRadius.lg,
                fontSize: getFontSize('body', isMobile),
                background: mobileFiltersExpanded
                  ? designSystem.colors.background.card
                  : (filtersActive ? designSystem.colors.warning[50] : designSystem.colors.background.card),
                color: designSystem.colors.text.primary,
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: designSystem.shadows.xs,
              }}
            >
              {mobileFiltersExpanded
                ? '收合篩選與排序'
                : `篩選與排序（類型、LINE、排序）${filtersActive ? ' · 已套用' : ''}`}
            </button>
              )
            })()}
            {mobileFiltersExpanded && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'stretch',
            }}>
              {/* 會員類型下拉選單 */}
              <div style={{ width: '100%' }}>
                <select
                  value={membershipTypeFilter}
                  onChange={(e) => setMembershipTypeFilter(e.target.value)}
                  style={{
                    ...getInputStyle(isMobile),
                    width: '100%',
                    paddingRight: '32px',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    fontWeight: (membershipTypeFilter !== 'all' || lineBindingFilter !== 'all') ? '500' : 'normal',
                  }}
                >
                  <option value="all">全部 ({members.length})</option>
                  <option value="member">會員 ({members.filter(m => m.membership_type === 'general' || m.membership_type === 'dual').length})</option>
                  <option value="general">一般 ({members.filter(m => m.membership_type === 'general').length})</option>
                  <option value="dual">雙人 ({members.filter(m => m.membership_type === 'dual').length})</option>
                  <option value="guest">非會員 ({members.filter(m => m.membership_type === 'guest').length})</option>
                  <option value="es">ES ({members.filter(m => m.membership_type === 'es').length})</option>
                </select>
              </div>

              {/* LINE 綁定狀態 */}
              <div style={{ width: '100%' }}>
                <select
                  value={lineBindingFilter}
                  onChange={(e) => setLineBindingFilter(e.target.value as 'all' | 'bound' | 'unbound')}
                  style={{
                    ...getInputStyle(isMobile),
                    width: '100%',
                    paddingRight: '32px',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    fontWeight: lineBindingFilter !== 'all' ? '500' : 'normal',
                  }}
                >
                  <option value="all">LINE 全部 ({members.length})</option>
                  <option value="bound">LINE 已綁定 ({members.filter(m => m.is_line_bound).length})</option>
                  <option value="unbound">LINE 未綁定 ({members.filter(m => !m.is_line_bound).length})</option>
                </select>
              </div>

              {/* 排序下拉選單 + 方向按鈕 */}
              <div style={{ width: '100%', display: 'flex', gap: '6px' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  style={{
                    ...getInputStyle(isMobile),
                    flex: 1,
                    minWidth: 0,
                    paddingRight: '32px',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                  }}
                >
                  <option value="nickname">暱稱</option>
                  <option value="balance">儲值</option>
                  <option value="vip">VIP</option>
                  <option value="g23">G23</option>
                  <option value="g21">黑豹/G21</option>
                  <option value="lastTransaction">交易日期</option>
                  <option value="updatedAt">更新日期</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  style={{
                    ...getButtonStyle('outline', 'medium', isMobile),
                    minWidth: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={sortOrder === 'asc' ? '升序（點擊切換）' : '降序（點擊切換）'}
                >
                  {sortOrder === 'asc' ? '▲' : '▼'}
                </button>
              </div>
            </div>
            )}

            {/* 手機版結果數量 */}
            {(searchTerm || membershipTypeFilter !== 'all' || lineBindingFilter !== 'all') && (
              <div style={{
                fontSize: getFontSize('button', isMobile),
                color: designSystem.colors.text.secondary,
                marginTop: '8px',
                textAlign: 'center',
              }}>
                {searchTerm ? `「${searchTerm}」` : ''} 找到 <strong>{filteredMembers.length}</strong> 位會員
              </div>
            )}
          </>
        ) : (
          /* 桌面版：類型一列、LINE／排序一列 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              {[
                { value: 'all', label: '全部', count: members.length },
                { value: 'member', label: '會員', count: members.filter(m => m.membership_type === 'general' || m.membership_type === 'dual').length },
                { value: 'general', label: '一般', count: members.filter(m => m.membership_type === 'general').length },
                { value: 'dual', label: '雙人', count: members.filter(m => m.membership_type === 'dual').length },
                { value: 'guest', label: '非會員', count: members.filter(m => m.membership_type === 'guest').length },
                { value: 'es', label: 'ES', count: members.filter(m => m.membership_type === 'es').length }
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setMembershipTypeFilter(type.value)}
                  style={{
                    ...getButtonStyle('outline', 'small', false),
                    ...getFilterChipStyle(membershipTypeFilter === type.value, 'info'),
                  }}
                >
                  {type.label} ({type.count})
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <button
                type="button"
                data-track="member_filter_line_bound"
                onClick={() => setLineBindingFilter(lineBindingFilter === 'bound' ? 'all' : 'bound')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getFilterChipStyle(lineBindingFilter === 'bound', 'info'),
                }}
              >
                LINE 已綁定 ({members.filter(m => m.is_line_bound).length})
              </button>

              <button
                type="button"
                data-track="member_filter_line_unbound"
                onClick={() => setLineBindingFilter(lineBindingFilter === 'unbound' ? 'all' : 'unbound')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getFilterChipStyle(lineBindingFilter === 'unbound', 'info'),
                }}
              >
                LINE 未綁定 ({members.filter(m => !m.is_line_bound).length})
              </button>

              <div style={{ width: '1px', height: '22px', background: designSystem.colors.border.light, margin: '0 2px' }} />

              <select
                value={sortBy}
                onChange={(e) => {
                  const key = e.target.value as typeof sortBy
                  setSortBy(key)
                  setSortOrder(key === 'nickname' ? 'asc' : 'desc')
                }}
                aria-label="排序欄位"
                style={{
                  ...getInputStyle(false),
                  width: 'auto',
                  minWidth: '120px',
                  padding: '7px 28px 7px 12px',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  cursor: 'pointer',
                  fontSize: getFontSize('button', false),
                }}
              >
                <option value="nickname">暱稱</option>
                <option value="balance">儲值</option>
                <option value="vip">VIP</option>
                <option value="g23">G23</option>
                <option value="g21">黑豹/G21</option>
                <option value="lastTransaction">交易日期</option>
                <option value="updatedAt">更新日期</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  minWidth: '40px',
                }}
                title={sortOrder === 'asc' ? '升序（點擊切換）' : '降序（點擊切換）'}
              >
                {sortOrder === 'asc' ? '▲' : '▼'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 桌面結果筆數（與手機同句式，較安靜） */}
      {!isMobile && (searchTerm || membershipTypeFilter !== 'all' || lineBindingFilter !== 'all') && (
        <div style={{
          fontSize: getFontSize('button', false),
          color: designSystem.colors.text.secondary,
          marginBottom: '12px',
          textAlign: 'center',
        }}>
          {searchTerm ? `「${searchTerm}」` : ''} 找到 <strong>{filteredMembers.length}</strong> 位會員
        </div>
      )}

      {/* 會員列表 */}
      <div style={{ 
        display: 'grid',
        gap: '20px'
      }}>
        {loading ? (
          // 骨架屏
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: designSystem.colors.background.card,
                  borderRadius: designSystem.borderRadius.lg,
                  padding: isMobile ? '14px 16px' : '18px 20px',
                  border: cardBorder,
                  boxShadow: cardShadow,
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ width: '100px', height: '20px', background: designSystem.colors.border.light, borderRadius: '4px' }} />
                  <div style={{ width: '48px', height: '18px', background: designSystem.colors.border.light, borderRadius: '10px' }} />
                  <div style={{ width: '60px', height: '18px', background: designSystem.colors.border.light, borderRadius: '10px' }} />
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                  gap: '10px',
                }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} style={{ textAlign: 'center' }}>
                      <div style={{ width: '60px', height: '12px', background: designSystem.colors.border.light, borderRadius: '4px', margin: '0 auto 6px' }} />
                      <div style={{ width: '50px', height: '18px', background: designSystem.colors.border.light, borderRadius: '4px', margin: '0 auto' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : filteredMembers.length === 0 ? (
          <div style={{ ...getEmptyStateStyle(isMobile), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div>
              {(searchTerm || membershipTypeFilter !== 'all' || lineBindingFilter !== 'all')
                ? '找不到符合的會員'
                : '尚無會員資料'}
            </div>
            {(searchTerm || membershipTypeFilter !== 'all' || lineBindingFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setMembershipTypeFilter('all')
                  setLineBindingFilter('all')
                }}
                style={getButtonStyle('outline', 'small', isMobile)}
              >
                清除篩選
              </button>
            )}
          </div>
        ) : (
          filteredMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                style={{
                  background: designSystem.colors.background.card,
                  borderRadius: designSystem.borderRadius.lg,
                  padding: isMobile ? '16px 16px' : '20px 22px',
                  boxShadow: cardShadow,
                  cursor: 'pointer',
                  transition: designSystem.transitions.normal,
                  border: cardBorder,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = designSystem.colors.text.secondary
                  e.currentTarget.style.boxShadow = cardShadowHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = designSystem.colors.border.light
                  e.currentTarget.style.boxShadow = cardShadow
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.background = designSystem.colors.background.main
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.background = designSystem.colors.background.card
                }}
                onTouchCancel={(e) => {
                  e.currentTarget.style.background = designSystem.colors.background.card
                }}
              >
                {/* 會員基本資訊 */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '8px',
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: getFontSize('h3', isMobile),
                      fontWeight: 750,
                      color: designSystem.colors.text.primary,
                      letterSpacing: '-0.025em',
                    }}>
                      {member.nickname || member.name}
                    </h3>
                    {member.nickname && (
                      <span style={{
                        fontSize: getFontSize('bodySmall', isMobile),
                        color: designSystem.colors.text.disabled
                      }}>
                        ({member.name})
                      </span>
                    )}
                    {/* 會員類型標籤 */}
                    {member.membership_type !== 'es' && (
                      <span style={getBadgeStyle(member.membership_type === 'guest' ? 'warning' : 'info', 'small')}>
                        {member.membership_type === 'guest' ? '非會員' : '會員'}
                      </span>
                    )}
                    {member.membership_type === 'dual' && (
                      <span style={getBadgeStyle('info', 'small')}>
                        雙人會籍
                      </span>
                    )}
                    {member.membership_type === 'es' && (
                      <span style={getBadgeStyle('default', 'small')}>
                        ES
                      </span>
                    )}
                    {/* 本月壽星標記 */}
                    {member.birthday && (() => {
                      const today = new Date()
                      const birthMonth = new Date(member.birthday).getMonth()
                      return birthMonth === today.getMonth()
                    })() && (
                      <span style={{ ...getBadgeStyle('warning', 'small'), fontWeight: 500 }}>
                        本月壽星
                      </span>
                    )}
                    {member.phone && (
                      <span style={{
                        fontSize: getFontSize('bodySmall', isMobile),
                        color: designSystem.colors.text.disabled,
                      }}>
                        {member.phone}
                      </span>
                    )}
                  </div>
                  {/* LINE 綁定狀態（資訊區塊） */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      title={member.is_line_bound ? '已綁定 LINE' : '未綁定 LINE'}
                      style={getBadgeStyle(member.is_line_bound ? 'success' : 'default', 'small')}
                    >
                      {member.is_line_bound ? 'LINE 已綁定' : 'LINE 未綁定'}
                    </span>
                    {member.is_line_bound && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnbindLine(member.id, member.nickname || member.name)
                        }}
                        style={{
                          ...getButtonStyle('outline', 'small', isMobile),
                          background: designSystem.colors.danger[50],
                          color: designSystem.colors.danger[700],
                          borderColor: `${designSystem.colors.danger[500]}66`,
                          fontSize: getFontSize('bodySmall', isMobile),
                          fontWeight: 600,
                          padding: '4px 10px',
                        }}
                        title="移除 LINE 綁定"
                      >
                        移除綁定
                      </button>
                    )}
                  </div>
                  {/* 最後交易日期和更新日期 */}
                  {(member.lastTransactionDate || member.lastTransactionCreatedAt) && (
                    <div style={{
                      fontSize: getFontSize('bodySmall', isMobile),
                      color: designSystem.colors.text.disabled,
                      marginTop: '6px',
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      {member.lastTransactionDate && (
                        <span>交易：{member.lastTransactionDate}</span>
                      )}
                      {member.lastTransactionCreatedAt && (
                        <span>更新：{member.lastTransactionCreatedAt.split('T')[0]}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* 儲值數據區 */}
                <div style={{
                  paddingTop: '12px',
                  borderTop: `1px solid ${designSystem.colors.border.light}`,
                }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                  gap: isMobile ? '8px' : '10px',
                  textAlign: 'center'
                }}>
                    <div>
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>儲值餘額</div>
                      <div style={{ fontSize: getFontSize('bodyLarge', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                        ${(member.balance || 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>VIP票券</div>
                      <div style={{ fontSize: getFontSize('bodyLarge', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                        ${(member.vip_voucher_amount || 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>指定課</div>
                      <div style={{ fontSize: getFontSize('bodyLarge', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                        {(member.designated_lesson_minutes || 0).toLocaleString()}分
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>G23船券</div>
                      <div style={{ fontSize: getFontSize('bodyLarge', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                        {(member.boat_voucher_g23_minutes || 0).toLocaleString()}分
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>黑豹/G21</div>
                      <div style={{ fontSize: getFontSize('bodyLarge', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                        {(member.boat_voucher_g21_panther_minutes || 0).toLocaleString()}分
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>贈送大船</div>
                      <div style={{ fontSize: getFontSize('bodyLarge', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                        {(member.gift_boat_hours || 0).toLocaleString()}分
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      <Footer />
      </div>

      {/* 交易對話框 */}
      {selectedMember && (
        <TransactionDialog
          open={showTransactionDialog}
          member={selectedMember}
          onClose={() => {
            setShowTransactionDialog(false)
            setSelectedMember(null)
          }}
          onSuccess={handleTransactionSuccess}
        />
      )}

    </div>
  )
}

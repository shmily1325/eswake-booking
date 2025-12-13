import { useState, useEffect, useMemo } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { TransactionDialog } from '../../components/TransactionDialog'
import { useResponsive } from '../../hooks/useResponsive'
import type { Member } from '../../types/booking'
import { handleError } from '../../utils/errorHandler'
import { useToast } from '../../components/ui'

// 擴展 Member 類型，加入最後交易日期
interface MemberWithLastTransaction extends Member {
  lastTransactionDate?: string | null
}

export function MemberTransaction() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [members, setMembers] = useState<MemberWithLastTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exporting, setExporting] = useState(false)
  const [showFinanceImport, setShowFinanceImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  
  // 新增的 state
  const [showHelp, setShowHelp] = useState(false) // 使用說明預設收合
  const [sortBy, setSortBy] = useState<'nickname' | 'balance' | 'vip' | 'g23' | 'g21' | 'lastTransaction'>('nickname')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<string>('all') // 會員種類篩選

  // 載入會員列表（含最後交易日期）
  const loadMembers = async () => {
    setLoading(true)
    try {
      // 並行載入會員和最後交易日期
      const [membersResult, transactionsResult] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('transactions')
          .select('member_id, transaction_date')
          .order('transaction_date', { ascending: false })
      ])

      if (membersResult.error) throw membersResult.error

      // 整理每個會員的最後交易日期
      const lastTransactionMap: Record<string, string> = {}
      if (transactionsResult.data) {
        for (const t of transactionsResult.data) {
          if (t.member_id && !lastTransactionMap[t.member_id]) {
            lastTransactionMap[t.member_id] = t.transaction_date
          }
        }
      }

      // 合併資料
      const membersWithLastTransaction = (membersResult.data || []).map(m => ({
        ...m,
        lastTransactionDate: lastTransactionMap[m.id] || null
      }))

      setMembers(membersWithLastTransaction)
    } catch (error) {
      console.error('載入會員失敗:', error)
      toast.error('載入會員列表失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

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
  }, [members, searchTerm, sortBy, sortOrder, membershipTypeFilter])

  // 計算統計數據
  const stats = useMemo(() => {
    return {
      totalBalance: members.reduce((sum, m) => sum + (m.balance || 0), 0),
      totalVipVoucher: members.reduce((sum, m) => sum + (m.vip_voucher_amount || 0), 0),
      totalDesignatedLesson: members.reduce((sum, m) => sum + (m.designated_lesson_minutes || 0), 0),
      totalG23: members.reduce((sum, m) => sum + (m.boat_voucher_g23_minutes || 0), 0),
      totalG21: members.reduce((sum, m) => sum + (m.boat_voucher_g21_panther_minutes || 0), 0),
      totalGiftBoat: members.reduce((sum, m) => sum + (m.gift_boat_hours || 0), 0),
      memberCount: members.length
    }
  }, [members])

  const handleMemberClick = (member: Member) => {
    setSelectedMember(member)
    setShowTransactionDialog(true)
  }

  const handleTransactionSuccess = () => {
    loadMembers()
  }

  // 匯出會員財務信息
  const handleExportFinance = async () => {
    try {
      const { data: allMembers, error } = await supabase
        .from('members')
        .select('id, name, nickname, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours, status')
        .order('name')

      if (error) throw error
      if (!allMembers || allMembers.length === 0) {
        toast.warning('沒有會員財務資料可以導出')
        return
      }

      const headers = [
        '姓名', '暱稱', '儲值', 'VIP票券', '指定課時數', 'G23船券', 'G21/黑豹船券', '贈送大船時數'
      ]

      const rows = allMembers.map((member: any) => {
        return [
          member.name || '',
          member.nickname || '',
          member.balance || 0,
          member.vip_voucher_amount || 0,
          member.designated_lesson_minutes || 0,
          member.boat_voucher_g23_minutes || 0,
          member.boat_voucher_g21_panther_minutes || 0,
          member.gift_boat_hours || 0
        ]
      })

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        }).join(','))
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)

      const today = new Date()
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      link.setAttribute('download', `會員儲值資料_${dateStr}.csv`)

      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(`成功導出 ${allMembers.length} 位會員的儲值資料`)
    } catch (err: any) {
      console.error('導出失敗:', err)
      toast.error('導出失敗: ' + err.message)
    }
  }

  // 匯入會員財務信息
  const handleImportFinance = async () => {
    if (!importFile) {
      setImportError('請選擇 CSV 檔案')
      return
    }

    setImporting(true)
    setImportError('')
    setImportSuccess('')

    try {
      const text = await importFile.text()
      const Papa = await import('papaparse')

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          const headerMap: Record<string, string> = {
            '姓名': 'name',
            '暱稱': 'nickname',
            '儲值': 'balance',
            'VIP票券': 'vip_voucher_amount',
            '指定課時數': 'designated_lesson_minutes',
            'G23船券': 'boat_voucher_g23_minutes',
            'G21/黑豹船券': 'boat_voucher_g21_panther_minutes',
            '贈送大船時數': 'gift_boat_hours'
          }
          return headerMap[header] || header
        },
        complete: async (results) => {
          const records = (results.data as any[])
            .filter((row: any) => row.name && row.name.trim())

          if (records.length === 0) {
            setImportError('未找到有效的財務資料')
            setImporting(false)
            return
          }

          let updateCount = 0
          let errorCount = 0

          for (const record of records) {
            try {
              const recordData = record as any
              const { data: existingMember } = await supabase
                .from('members')
                .select('id')
                .eq('name', recordData.name.trim())
                .single()

              if (!existingMember) {
                errorCount++
                continue
              }

              const { error } = await supabase
                .from('members')
                .update({
                  balance: recordData.balance ? parseFloat(recordData.balance) : 0,
                  vip_voucher_amount: recordData.vip_voucher_amount ? parseFloat(recordData.vip_voucher_amount) : 0,
                  designated_lesson_minutes: recordData.designated_lesson_minutes ? parseInt(recordData.designated_lesson_minutes) : 0,
                  boat_voucher_g23_minutes: recordData.boat_voucher_g23_minutes ? parseInt(recordData.boat_voucher_g23_minutes) : 0,
                  boat_voucher_g21_panther_minutes: recordData.boat_voucher_g21_panther_minutes ? parseInt(recordData.boat_voucher_g21_panther_minutes) : 0,
                  gift_boat_hours: recordData.gift_boat_hours ? parseInt(recordData.gift_boat_hours) : 0
                })
                .eq('id', existingMember.id)

              if (error) {
                errorCount++
              } else {
                updateCount++
              }
            } catch (err) {
              errorCount++
            }
          }

          let resultMsg = ''
          if (updateCount > 0) {
            resultMsg = `✅ 成功更新 ${updateCount} 位會員的儲值資料`
          }
          if (errorCount > 0) {
            resultMsg += `${updateCount > 0 ? '\n' : ''}⚠️ ${errorCount} 筆失敗（會員不存在）`
          }

          if (updateCount > 0) {
            setImportSuccess(resultMsg)
            loadMembers()
            setTimeout(() => {
              setShowFinanceImport(false)
              setImportFile(null)
              setImportSuccess('')
              setImportError('')
            }, 3000)
          } else {
            setImportError(resultMsg || '❌ 沒有成功更新任何會員')
          }

          setImporting(false)
        },
        error: (error: Error) => {
          setImportError('解析 CSV 失敗: ' + error.message)
          setImporting(false)
        }
      })
    } catch (err: any) {
      setImportError('導入失敗: ' + err.message)
      setImporting(false)
    }
  }

  // 匯出總帳
  const handleExportAll = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast.warning('請選擇開始和結束日期')
      return
    }

    if (exportStartDate > exportEndDate) {
      toast.warning('開始日期不能晚於結束日期')
      return
    }

    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          member_id(name, nickname)
        `)
        .gte('transaction_date', exportStartDate)
        .lte('transaction_date', exportEndDate)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        toast.warning('所選時間範圍內沒有交易記錄')
        return
      }

      // 類別對應的中文標籤
      const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
          balance: '儲值',
          vip_voucher: 'VIP票券',
          designated_lesson: '指定課',
          boat_voucher_g23: 'G23船券',
          boat_voucher_g21: '黑豹/G21船券',
          boat_voucher_g21_panther: '黑豹/G21船券',
          gift_boat_hours: '贈送大船',
          free_hours: '贈送時數',
          membership: '會籍',
          board_storage: '置板',
        }
        return labels[category] || category
      }

      // 根據金額正負判斷是增加還是減少
      const getActionLabel = (t: any) => {
        const adjustType = t.adjust_type
        const value = t.amount || t.minutes || 0
        
        // 優先用 adjust_type，沒有的話看金額正負
        if (adjustType === 'increase' || (!adjustType && value > 0)) {
          return '增加'
        } else if (adjustType === 'decrease' || (!adjustType && value < 0)) {
          return '減少'
        }
        return ''
      }

      // 根據類別獲取對應的交易後餘額
      const getAfterValue = (t: any) => {
        switch (t.category) {
          case 'balance':
            return t.balance_after != null ? `$${t.balance_after.toLocaleString()}` : ''
          case 'vip_voucher':
            return t.vip_voucher_amount_after != null ? `$${t.vip_voucher_amount_after.toLocaleString()}` : ''
          case 'designated_lesson':
            return t.designated_lesson_minutes_after != null ? `${t.designated_lesson_minutes_after}分` : ''
          case 'boat_voucher_g23':
            return t.boat_voucher_g23_minutes_after != null ? `${t.boat_voucher_g23_minutes_after}分` : ''
          case 'boat_voucher_g21':
          case 'boat_voucher_g21_panther':
            return t.boat_voucher_g21_panther_minutes_after != null ? `${t.boat_voucher_g21_panther_minutes_after}分` : ''
          case 'gift_boat_hours':
            return t.gift_boat_hours_after != null ? `${t.gift_boat_hours_after}分` : ''
          default:
            return ''
        }
      }

      // 格式化變動數值（含正負號）
      const getChangeValue = (t: any) => {
        const isAmount = t.category === 'balance' || t.category === 'vip_voucher'
        const value = isAmount ? (t.amount || 0) : (t.minutes || 0)
        const absValue = Math.abs(value)
        
        // 判斷正負號（優先用 adjust_type，沒有的話看數值本身）
        let sign = ''
        if (t.adjust_type === 'increase' || (!t.adjust_type && value > 0)) {
          sign = '+'
        } else if (t.adjust_type === 'decrease' || (!t.adjust_type && value < 0)) {
          sign = '-'
        }
        
        if (isAmount) {
          return `${sign}$${absValue.toLocaleString()}`
        } else {
          return `${sign}${absValue}分`
        }
      }

      // CSV 欄位轉義：處理逗號、雙引號、換行符
      const csvEscape = (str: string) => {
        if (!str) return ''
        // 如果包含逗號、雙引號或換行，需要用雙引號包裹，並將內部雙引號轉義
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const csv = [
        ['會員', '日期', '項目', '操作', '變動', '交易後餘額', '說明', '備註'].join(','),
        ...data.map((t: any) => [
          csvEscape((t.member_id as any)?.nickname || (t.member_id as any)?.name || '未知'),
          t.transaction_date || t.created_at?.split('T')[0] || '',
          getCategoryLabel(t.category),
          getActionLabel(t),
          getChangeValue(t),
          getAfterValue(t),
          csvEscape(t.description || ''),
          csvEscape(t.notes || ''),
        ].join(','))
      ].join('\n')

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `總帳_${exportStartDate}_至_${exportEndDate}.csv`
      link.click()

      setShowExportDialog(false)
      setExportStartDate('')
      setExportEndDate('')
    } catch (error) {
      handleError(error, '匯出交易記錄')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader 
        title="💰 會員儲值" 
        user={user} 
        showBaoLink={true}
        extraLinks={[{ label: '👥 會員管理', link: '/members' }]}
      />

      {/* 數據總覽 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '20px',
        marginBottom: '16px',
        border: '1px solid #e0e0e0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '12px' : '16px',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>💰 總儲值</div>
            <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 'bold', color: '#333' }}>
              ${stats.totalBalance.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>💎 總VIP票券</div>
            <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 'bold', color: '#333' }}>
              ${stats.totalVipVoucher.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>🚤 總G23船券</div>
            <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 'bold', color: '#333' }}>
              {stats.totalG23.toLocaleString()}分
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>⛵ 總G21/黑豹</div>
            <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 'bold', color: '#333' }}>
              {stats.totalG21.toLocaleString()}分
            </div>
          </div>
        </div>
      </div>

      {/* 操作按鈕區（簡化版） */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        alignItems: 'center',
        position: 'relative',
      }}>
        {/* 使用說明按鈕 */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          style={{
            padding: '8px 14px',
            background: showHelp ? '#e3f2fd' : 'white',
            color: showHelp ? '#1976d2' : '#666',
            border: `1px solid ${showHelp ? '#1976d2' : '#ddd'}`,
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          💡 說明 {showHelp ? '▲' : '▼'}
        </button>

        {/* 匯出按鈕 */}
        <button
          onClick={handleExportFinance}
          style={{
            padding: '8px 14px',
            background: 'white',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          📤 匯出金流
        </button>
        <button
          onClick={() => setShowExportDialog(true)}
          style={{
            padding: '8px 14px',
            background: 'white',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          📋 匯出總帳
        </button>
      </div>

      {/* 使用說明（可收合） */}
      {showHelp && (
        <div style={{
          background: '#f8f9fa',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '16px',
          border: '1px solid #e0e0e0',
        }}>
          <div style={{
            fontSize: isMobile ? '12px' : '13px',
            lineHeight: '1.6',
            color: '#666',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '8px',
          }}>
            <div><strong style={{ color: '#333' }}>💰 儲值</strong>：會員儲值餘額</div>
            <div><strong style={{ color: '#333' }}>💎 VIP票券</strong>：VIP專用票券餘額</div>
            <div><strong style={{ color: '#333' }}>📚 指定課</strong>：指定教練課程時數（分鐘）</div>
            <div><strong style={{ color: '#333' }}>🚤 G23船券</strong>：G23船隻使用時數（分鐘）</div>
            <div><strong style={{ color: '#333' }}>⛵ G21/黑豹</strong>：G21與黑豹船隻共通時數（分鐘）</div>
            <div><strong style={{ color: '#333' }}>🎁 贈送大船</strong>：贈送的大船使用時數（分鐘）</div>
          </div>
        </div>
      )}

      {/* 搜尋欄 */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '12px',
        alignItems: 'center'
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
              width: '100%',
              padding: isMobile ? '10px 14px' : '12px 16px',
              paddingRight: searchTerm ? '40px' : '16px',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
                background: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
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

      {/* 統一篩選列 */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        flexWrap: 'wrap',
        marginBottom: '16px',
        alignItems: 'center'
      }}>
        {/* 會員類型篩選 */}
        {[
          { value: 'all', label: '全部', count: members.length },
          { value: 'member', label: '會員', count: members.filter(m => m.membership_type === 'general' || m.membership_type === 'dual').length },
          { value: 'general', label: '一般會員', count: members.filter(m => m.membership_type === 'general').length },
          { value: 'dual', label: '雙人會員', count: members.filter(m => m.membership_type === 'dual').length },
          { value: 'guest', label: '非會員', count: members.filter(m => m.membership_type === 'guest').length },
          { value: 'es', label: 'ES', count: members.filter(m => m.membership_type === 'es').length }
        ].map(type => (
          <button
            key={type.value}
            onClick={() => setMembershipTypeFilter(type.value)}
            style={{
              padding: '6px 12px',
              background: membershipTypeFilter === type.value ? '#5a5a5a' : 'white',
              color: membershipTypeFilter === type.value ? 'white' : '#666',
              border: `1px solid ${membershipTypeFilter === type.value ? '#5a5a5a' : '#ddd'}`,
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: membershipTypeFilter === type.value ? '600' : 'normal'
            }}
          >
            {type.label} ({type.count})
          </button>
        ))}

        {/* 分隔線 */}
        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* 排序按鈕 */}
        {[
          { key: 'nickname' as const, label: '暱稱' },
          { key: 'balance' as const, label: '儲值' },
          { key: 'vip' as const, label: 'VIP' },
          { key: 'g23' as const, label: 'G23' },
          { key: 'g21' as const, label: '黑豹/G21' },
          { key: 'lastTransaction' as const, label: '交易日期' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              if (sortBy === key) {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
              } else {
                setSortBy(key)
                setSortOrder(key === 'nickname' ? 'asc' : 'desc')
              }
            }}
            style={{
              padding: '6px 10px',
              border: sortBy === key ? '1px solid #1976d2' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '13px',
              background: sortBy === key ? '#e3f2fd' : 'white',
              cursor: 'pointer',
              color: sortBy === key ? '#1976d2' : '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: sortBy === key ? '500' : '400'
            }}
          >
            {label}
            {sortBy === key && (
              <span style={{ fontSize: '11px' }}>
                {sortOrder === 'asc' ? '▲' : '▼'}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 搜尋結果數量提示 */}
      {searchTerm && (
        <div style={{
          fontSize: '13px',
          color: '#666',
          marginBottom: '12px',
          padding: '8px 12px',
          background: '#f0f7ff',
          borderRadius: '6px',
          border: '1px solid #d0e3ff'
        }}>
          🔍 搜尋「{searchTerm}」找到 <strong>{filteredMembers.length}</strong> 位會員
        </div>
      )}

      {/* 會員列表 */}
      <div style={{ 
        display: 'grid',
        gap: '15px'
      }}>
        {loading ? (
          // 骨架屏
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{
                  background: '#f0f0f0',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '100px', height: '20px', background: '#e0e0e0', borderRadius: '4px' }} />
                    <div style={{ width: '60px', height: '16px', background: '#e8e8e8', borderRadius: '4px' }} />
                  </div>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                  gap: '10px',
                }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} style={{ textAlign: 'center' }}>
                      <div style={{ width: '60px', height: '12px', background: '#f0f0f0', borderRadius: '4px', margin: '0 auto 6px' }} />
                      <div style={{ width: '50px', height: '18px', background: '#e8e8e8', borderRadius: '4px', margin: '0 auto' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : filteredMembers.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#999',
            fontSize: '16px'
          }}>
            {searchTerm ? '沒有找到符合條件的會員' : '暫無會員資料'}
          </div>
        ) : (
          filteredMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  marginBottom: '15px',
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                {/* 會員基本資訊 */}
                <div style={{
                  background: '#f8f9fa',
                  padding: isMobile ? '12px' : '14px 16px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap'
                      }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: isMobile ? '16px' : '18px',
                          fontWeight: 'bold',
                          color: '#333'
                        }}>
                          {member.nickname || member.name}
                        </h3>
                        {member.nickname && (
                          <span style={{
                            fontSize: '13px',
                            color: '#999'
                          }}>
                            ({member.name})
                          </span>
                        )}
                        {member.phone && (
                          <span style={{
                            fontSize: '13px',
                            color: '#666',
                          }}>
                            📱 {member.phone}
                          </span>
                        )}
                      </div>
                      {/* 最後交易日期 */}
                      {member.lastTransactionDate && (
                        <div style={{
                          fontSize: '12px',
                          color: '#999',
                          marginTop: '4px',
                        }}>
                          📅 最後交易：{member.lastTransactionDate}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 儲值數據區 */}
                <div style={{
                  background: '#fff',
                  padding: isMobile ? '8px' : '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                    gap: isMobile ? '8px' : '10px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>💰 儲值餘額</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                        ${(member.balance || 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>💎 VIP票券</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                        ${(member.vip_voucher_amount || 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>📚 指定課</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                        {(member.designated_lesson_minutes || 0).toLocaleString()}分
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>🚤 G23船券</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                        {(member.boat_voucher_g23_minutes || 0).toLocaleString()}分
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>⛵ 黑豹/G21</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                        {(member.boat_voucher_g21_panther_minutes || 0).toLocaleString()}分
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>🎁 贈送大船</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
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

      {/* 匯出總帳對話框 */}
      {showExportDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                📥 匯出總帳
              </h2>
              <button
                onClick={() => setShowExportDialog(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  開始日期 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  結束日期 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#666',
                marginBottom: '16px',
              }}>
                💡 將匯出所選時間範圍內所有會員的交易記錄
              </div>
            </div>

            <div style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setShowExportDialog(false)}
                disabled={exporting}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#666',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                取消
              </button>
              <button
                onClick={handleExportAll}
                disabled={exporting || !exportStartDate || !exportEndDate}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: (exporting || !exportStartDate || !exportEndDate) ? '#ccc' : '#52c41a',
                  color: 'white',
                  cursor: (exporting || !exportStartDate || !exportEndDate) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {exporting ? '匯出中...' : '確認匯出'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 財務導入對話框 */}
      {showFinanceImport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                📥 導入會員賬戶資料
              </h2>
              <button
                onClick={() => {
                  setShowFinanceImport(false)
                  setImportFile(null)
                  setImportError('')
                  setImportSuccess('')
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {/* 說明 */}
              <div style={{
                background: '#f8f9fa',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
                lineHeight: '1.6',
              }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                  💡 導入說明
                </div>
                <div style={{ color: '#666' }}>
                  • CSV 格式：<code style={{ background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>姓名,暱稱,儲值,VIP票券,指定課時數,G23船券,G21/黑豹船券,贈送大船時數</code><br />
                  • 只更新已存在的會員（不會創建新會員）<br />
                  • 會根據會員姓名自動匹配<br />
                  • <strong style={{ color: '#2196F3' }}>只更新財務字段</strong>（儲值、票券、船券等），<strong style={{ color: '#2196F3' }}>不會更新暱稱</strong><br />
                  • 會員不存在時會被跳過並報告錯誤
                </div>
              </div>

              {/* 警告 */}
              <div style={{
                padding: '12px',
                background: '#fff3cd',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#856404',
                marginBottom: '16px',
                lineHeight: '1.6',
                border: '1px solid #ffc107'
              }}>
                <div style={{ marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                  ⚠️ 重要提醒
                </div>
                <div><strong style={{ color: '#d32f2f' }}>導入會直接覆蓋現有財務數據，建議先導出備份！</strong></div>
                <div style={{ marginTop: '4px', fontSize: '13px' }}>（暱稱不會被覆蓋，保持原有設定）</div>
              </div>

              {/* CSV 範例 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                  📄 CSV 範例：
                </div>
                <code style={{
                  display: 'block',
                  background: '#f8f9fa',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  border: '1px solid #dee2e6',
                  marginBottom: '8px',
                }}>
                  {`姓名,暱稱,儲值,VIP票券,指定課時數,G23船券,G21/黑豹船券,贈送大船時數,狀態
林敏,Ming,5000,2000,120,180,240,60,啟用
賴奕茵,Ingrid,3000,0,60,0,120,0,啟用`}
                </code>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  選擇 CSV 檔案 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null)
                    setImportError('')
                    setImportSuccess('')
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {importError && (
                <div style={{
                  padding: '12px',
                  background: '#ffebee',
                  color: '#d32f2f',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                  whiteSpace: 'pre-line'
                }}>
                  {importError}
                </div>
              )}

              {importSuccess && (
                <div style={{
                  padding: '12px',
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                  whiteSpace: 'pre-line'
                }}>
                  {importSuccess}
                </div>
              )}
            </div>

            <div style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => {
                  setShowFinanceImport(false)
                  setImportFile(null)
                  setImportError('')
                  setImportSuccess('')
                }}
                disabled={importing}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#666',
                  cursor: importing ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                取消
              </button>
              <button
                onClick={handleImportFinance}
                disabled={importing || !importFile}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: (importing || !importFile) ? '#ccc' : '#52c41a',
                  color: 'white',
                  cursor: (importing || !importFile) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {importing ? '導入中...' : '確認導入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

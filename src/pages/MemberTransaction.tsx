import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { TransactionDialog } from '../components/TransactionDialog'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  balance: number
  vip_voucher_amount: number  // VIP 票券（金額）
  designated_lesson_minutes: number  // 指定課時數
  boat_voucher_g23_minutes: number  // G23船券（時數）
  boat_voucher_g21_panther_minutes: number  // G21/黑豹共通船券（時數）
  gift_boat_hours: number  // 贈送大船時數
  membership_type: string
  status: string
}

interface MemberTransactionProps {
  user: User
}

export function MemberTransaction({ user }: MemberTransactionProps) {
  const { isMobile } = useResponsive()
  const [members, setMembers] = useState<Member[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([])
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

  // 載入會員列表
  const loadMembers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, nickname, phone, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours, membership_type, status')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setMembers(data || [])
      setFilteredMembers(data || [])
    } catch (error) {
      console.error('載入會員失敗:', error)
      alert('載入會員列表失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  // 搜尋過濾
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMembers(members)
    } else {
      const lowerSearch = searchTerm.toLowerCase()
      const filtered = members.filter(m =>
        m.name.toLowerCase().includes(lowerSearch) ||
        m.nickname?.toLowerCase().includes(lowerSearch) ||
        m.phone?.includes(searchTerm)
      )
      setFilteredMembers(filtered)
    }
  }, [searchTerm, members])

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
        alert('沒有會員財務資料可以導出')
        return
      }

      const headers = [
        '姓名', '儲值', 'VIP票券', '指定課時數', 'G23船券', 'G21/黑豹船券', '贈送大船時數'
      ]

      const rows = allMembers.map((member: any) => {
        return [
          member.name || '',
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

      alert(`✅ 成功導出 ${allMembers.length} 位會員的儲值資料`)
    } catch (err: any) {
      console.error('導出失敗:', err)
      alert('導出失敗: ' + err.message)
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
      alert('請選擇開始和結束日期')
      return
    }

    if (exportStartDate > exportEndDate) {
      alert('開始日期不能晚於結束日期')
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
        alert('所選時間範圍內沒有交易記錄')
        return
      }

      const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
          charge: '儲值',
          purchase: '購買',
          payment: '付款',
          refund: '退款',
          adjust: '調整',
        }
        return labels[type] || type
      }

      const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
          balance: '儲值',
          vip_voucher: 'VIP票券',
          designated_lesson: '指定課',
          boat_voucher_g23: 'G23船券',
          boat_voucher_g21: 'G21/黑豹船券',
          boat_voucher_g21_panther: 'G21/黑豹船券',
          gift_boat_hours: '贈送大船',
          free_hours: '贈送時數',
          membership: '會籍',
          board_storage: '置板',
        }
        return labels[category] || category
      }

      const csv = [
        ['會員', '日期', '交易類型', '類別', '金額', '分鐘數', '說明', '備註', '餘額', '指定課', 'G23船券', 'G21船券'].join(','),
        ...data.map((t: any) => [
          `"${(t.member_id as any)?.nickname || (t.member_id as any)?.name || '未知'}"`,
          t.transaction_date || t.created_at?.split('T')[0] || '',
          getTypeLabel(t.transaction_type),
          getCategoryLabel(t.category),
          t.amount || '',
          t.minutes || '',
          `"${t.description || ''}"`,
          `"${t.notes || ''}"`,
          t.balance_after || '',
          t.designated_lesson_minutes_after || '',
          t.boat_voucher_g23_minutes_after || '',
          t.boat_voucher_g21_minutes_after || ''
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
    } catch (error: any) {
      console.error('匯出失敗:', error)
      const errorMessage = error?.message || '未知錯誤'
      alert(`匯出失敗: ${errorMessage}\n\n請檢查瀏覽器控制台 (F12) 查看詳細錯誤訊息`)
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
      <PageHeader title="💰 會員儲值" user={user} showBaoLink={true} />

      {/* 操作按鈕區 */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '10px' : '12px',
        marginBottom: isMobile ? '16px' : '20px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setShowFinanceImport(true)}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>📥</span>
          <span>匯入</span>
        </button>

        <button
          onClick={handleExportFinance}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>📤</span>
          <span>匯出</span>
        </button>

        <button
          onClick={() => setShowExportDialog(true)}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>📋</span>
          <span>匯出總帳</span>
        </button>
      </div>

      {/* 使用說明 */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '20px',
        marginBottom: '16px',
        border: '1px solid #e0e0e0',
      }}>
        <div style={{
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: '600',
          marginBottom: '8px',
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          💡 使用說明
        </div>
        <div style={{
          fontSize: isMobile ? '12px' : '13px',
          lineHeight: '1.6',
          color: '#666',
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>💰 儲值</strong>：會員儲值餘額
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>💎 VIP票券</strong>：VIP專用票券餘額
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>📚 指定課</strong>：指定教練課程時數（分鐘）
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>🚤 G23船券</strong>：G23船隻使用時數（分鐘）
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>⛵ G21/黑豹</strong>：G21與黑豹船隻共通時數（分鐘）
          </div>
          <div>
            <strong style={{ color: '#333' }}>🎁 贈送大船</strong>：贈送的大船使用時數（分鐘）
          </div>
        </div>
      </div>

      {/* 搜尋欄 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '16px' : '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '8px',
          }}>
            🔍 搜尋會員
          </div>
          <input
            type="text"
            placeholder="輸入會員暱稱/姓名/電話搜尋..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: isMobile ? '16px' : '14px',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
          />
        </div>

        <div style={{
          fontSize: '13px',
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>找到 {filteredMembers.length} 位會員</span>
        </div>
      </div>

      {/* 會員列表 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#999',
          }}>
            載入中...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#999',
          }}>
            {searchTerm ? '沒有找到符合條件的會員' : '暫無會員資料'}
          </div>
        ) : (
          <div style={{
            maxHeight: isMobile ? 'calc(100vh - 280px)' : 'calc(100vh - 240px)',
            overflowY: 'auto',
          }}>
            {filteredMembers.map((member) => (
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
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMemberClick(member)
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'white',
                        color: '#666',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8f9fa'
                        e.currentTarget.style.borderColor = '#424242'
                        e.currentTarget.style.color = '#424242'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white'
                        e.currentTarget.style.borderColor = '#e0e0e0'
                        e.currentTarget.style.color = '#666'
                      }}
                    >
                      💰 記帳
                    </button>
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
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>⛵ G21/黑豹</div>
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
            ))}
          </div>
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
                  • CSV 格式：<code style={{ background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>姓名,暱稱,儲值,VIP票券,指定課時數,G23船券,G21/黑豹船券,贈送大船時數,狀態</code><br />
                  • 只更新已存在的會員（不會創建新會員）<br />
                  • 會根據會員姓名自動匹配<br />
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
                <strong style={{ color: '#d32f2f' }}>導入會直接覆蓋現有儲值數據，建議先導出備份！</strong>
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

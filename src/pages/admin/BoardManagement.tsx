import React, { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString } from '../../utils/date'
import type { MemberBasic, ImportRecord, BoardExportData } from '../../types/common'
import { Button, useToast, ToastContainer } from '../../components/ui'

interface BoardSlot {
  id?: number
  slot_number: number
  member_id?: string
  member_name?: string
  member_nickname?: string | null
  start_date?: string | null
  expires_at?: string | null
  notes?: string | null
  status?: string | null
}

// 置板區配置
const BOARD_SECTIONS = [
  { name: '第1排', start: 1, end: 30 },
  { name: '第2排', start: 31, end: 62 },
  { name: '第3排', start: 63, end: 94 },
  { name: '第4排', start: 95, end: 134 },
  { name: '第5排', start: 135, end: 145, upperOnly: true },
]

export function BoardManagement() {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [boardSlots, setBoardSlots] = useState<BoardSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<BoardSlot | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    start_date: '',
    expires_at: '',
    notes: ''
  })
  
  // 新增置板相關狀態
  const [isAddingBoard, setIsAddingBoard] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [searchResults, setSearchResults] = useState<MemberBasic[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberBasic | null>(null)
  const [newBoardForm, setNewBoardForm] = useState({
    start_date: '',
    expires_at: '',
    notes: ''
  })
  
  // Import/Export 相關狀態
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')

  useEffect(() => {
    loadBoardData()
  }, [])

  // 導出置板資料
  const handleExportBoards = async () => {
    try {
      const { data: allBoards, error } = await supabase
        .from('board_storage')
        .select(`
          id, slot_number, expires_at, notes, status,
          members:member_id (name, nickname)
        `)
        .eq('status', 'active')
        .order('slot_number', { ascending: true })

      if (error) throw error
      if (!allBoards || allBoards.length === 0) {
        toast.warning('沒有置板資料可以導出')
        return
      }

      const headers = ['姓名', '暱稱', '格位號碼', '到期日', '備註']
      const rows = (allBoards as BoardExportData[]).map((board) => [
        board.members?.name || '',
        board.members?.nickname || '',
        board.slot_number,
        board.expires_at || '',
        board.notes || ''
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => 
          typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(','))
      ].join('\n')

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `置板資料_${getLocalDateString()}.csv`
      link.click()
    } catch (error) {
      console.error('導出失敗:', error)
      toast.error('導出失敗')
    }
  }

  // 導入置板資料
  const handleImportBoards = async () => {
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
            '格位號碼': 'slot_number',
            '到期日': 'expires_at',
            '備註': 'notes'
          }
          return headerMap[header] || header
        },
        complete: async (results) => {
          const records = (results.data as ImportRecord[])
            .filter((row) => row.name && row.name.trim() && row.slot_number)

          if (records.length === 0) {
            setImportError('未找到有效的置板資料')
            setImporting(false)
            return
          }

          let successCount = 0
          let errorCount = 0
          const errors: string[] = []

          for (const record of records) {
            try {
              // 查找會員
              const { data: member } = await supabase
                .from('members')
                .select('id')
                .eq('name', record.name.trim())
                .single()

              if (!member) {
                errors.push(`會員「${record.name}」不存在`)
                errorCount++
                continue
              }

              const slotNumber = typeof record.slot_number === 'string' 
                ? parseInt(record.slot_number) 
                : record.slot_number
              if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
                errors.push(`格位號碼「${record.slot_number}」無效（需為 1-145）`)
                errorCount++
                continue
              }

              // 檢查格位是否已被其他會員使用
              const { data: existingSlot } = await supabase
                .from('board_storage')
                .select('id, member_id')
                .eq('slot_number', slotNumber)
                .eq('status', 'active')
                .single()

              if (existingSlot && existingSlot.member_id !== member.id) {
                errors.push(`格位 ${slotNumber} 已被其他會員使用`)
                errorCount++
                continue
              }

              // 如果格位已存在（同一會員），更新；否則創建
              if (existingSlot && existingSlot.member_id === member.id) {
                const { error } = await supabase
                  .from('board_storage')
                  .update({
                    expires_at: record.expires_at || null,
                    notes: record.notes || null,
                    status: 'active'
                  })
                  .eq('id', existingSlot.id)

                if (error) throw error
              } else {
                const { error } = await supabase
                  .from('board_storage')
                  .insert({
                    member_id: member.id,
                    slot_number: slotNumber,
                    expires_at: record.expires_at || null,
                    notes: record.notes || null,
                    status: 'active'
                  })

                if (error) throw error
              }

              successCount++
            } catch (err) {
              errors.push(`處理失敗：${record.name} - 格位 ${record.slot_number}`)
              errorCount++
            }
          }

          if (successCount > 0) {
            setImportSuccess(`✅ 成功導入 ${successCount} 筆置板資料${errorCount > 0 ? `\n⚠️ ${errorCount} 筆失敗` : ''}`)
            loadBoardData()
            setTimeout(() => {
              setShowImportDialog(false)
              setImportFile(null)
              setImportSuccess('')
            }, 3000)
          } else {
            setImportError(`導入失敗\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`)
          }

          setImporting(false)
        },
        error: (error: Error) => {
          setImportError('CSV 解析失敗：' + error.message)
          setImporting(false)
        }
      })
    } catch (error) {
      setImportError('導入失敗：' + (error as Error).message)
      setImporting(false)
    }
  }

  const loadBoardData = async () => {
    setLoading(true)
    try {
      // 載入所有置板資料及會員資訊
      const { data, error } = await supabase
        .from('board_storage')
        .select(`
          id,
          slot_number,
          member_id,
          start_date,
          expires_at,
          notes,
          status,
          members:member_id (
            name,
            nickname
          )
        `)
        .eq('status', 'active')
        .order('slot_number', { ascending: true })

      if (error) throw error

      const slots: BoardSlot[] = (data || []).map((item) => ({
        id: item.id,
        slot_number: item.slot_number,
        member_id: item.member_id,
        member_name: item.members?.name,
        member_nickname: item.members?.nickname,
        start_date: item.start_date,
        expires_at: item.expires_at,
        notes: item.notes,
        status: item.status,
      }))

      setBoardSlots(slots)
    } catch (error) {
      console.error('載入置板資料失敗:', error)
      toast.error('載入置板資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const getSlotInfo = (slotNumber: number): BoardSlot | null => {
    return boardSlots.find(s => s.slot_number === slotNumber) || null
  }

  const handleSlotClick = (slotInfo: BoardSlot | null, slotNumber: number) => {
    const slot = slotInfo || { slot_number: slotNumber }
    setSelectedSlot(slot)
    setEditing(false)
    if (slotInfo) {
      setEditForm({
        start_date: slotInfo.start_date || '',
        expires_at: slotInfo.expires_at || '',
        notes: slotInfo.notes || ''
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedSlot?.id) return

    try {
      const { error } = await supabase
        .from('board_storage')
        .update({
          start_date: editForm.start_date || null,
          expires_at: editForm.expires_at || null,
          notes: editForm.notes.trim() || null,
        })
        .eq('id', selectedSlot.id)

      if (error) throw error
      setEditing(false)
      setSelectedSlot(null)
      loadBoardData()
    } catch (error) {
      console.error('更新失敗:', error)
      toast.error('更新失敗')
    }
  }

  const handleDeleteBoard = async () => {
    if (!selectedSlot?.id) return
    
    if (!confirm(`確定要刪除格位 #${selectedSlot.slot_number} 嗎？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .delete()
        .eq('id', selectedSlot.id)

      if (error) throw error
      toast.success(`已刪除格位 #${selectedSlot.slot_number}`)
      setSelectedSlot(null)
      loadBoardData()
    } catch (error) {
      console.error('刪除失敗:', error)
      toast.error('刪除失敗')
    }
  }

  // 會員搜尋
  const searchMembers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, nickname, phone')
        .or(`name.ilike.%${query}%,nickname.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('status', 'active')
        .limit(10)

      if (error) throw error
      setSearchResults(data || [])
    } catch (error) {
      console.error('搜尋會員失敗:', error)
    }
  }

  // 處理新增置板
  const handleAddBoard = async () => {
    if (!selectedMember || !selectedSlot) return

    try {
      const { error } = await supabase
        .from('board_storage')
        .insert({
          slot_number: selectedSlot.slot_number,
          member_id: selectedMember.id,
          start_date: newBoardForm.start_date || null,
          expires_at: newBoardForm.expires_at || null,
          notes: newBoardForm.notes.trim() || null,
          status: 'active'
        })

      if (error) throw error

      // 重置狀態
      setIsAddingBoard(false)
      setSelectedSlot(null)
      setSelectedMember(null)
      setMemberSearch('')
      setSearchResults([])
      setNewBoardForm({ start_date: '', expires_at: '', notes: '' })
      
      loadBoardData()
    } catch (error) {
      console.error('新增置板失敗:', error)
      toast.error('新增置板失敗')
    }
  }

  // 開啟新增置板模式
  const startAddingBoard = (slotNumber: number) => {
    setSelectedSlot({ slot_number: slotNumber })
    setIsAddingBoard(true)
    setSelectedMember(null)
    setMemberSearch('')
    setSearchResults([])
    setNewBoardForm({ start_date: '', expires_at: '', notes: '' })
  }

  const renderSlotCard = (num: number) => {
    const slotInfo = getSlotInfo(num)
    const isOccupied = !!slotInfo
    
    // 計算到期狀態
    const getExpiryStatus = () => {
      if (!slotInfo?.expires_at) return 'normal'
      const today = new Date()
      const expiryDate = new Date(slotInfo.expires_at)
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilExpiry < 0) return 'expired'
      if (daysUntilExpiry <= 30) return 'expiring'
      return 'normal'
    }
    
    const expiryStatus = isOccupied ? getExpiryStatus() : 'empty'
    
    // 根據狀態設定顏色
    const getSlotStyles = () => {
      switch (expiryStatus) {
        case 'expired':
          return {
            background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
            color: '#c62828',
            border: '2px solid #ef9a9a'
          }
        case 'expiring':
          return {
            background: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)',
            color: '#e65100',
            border: '2px solid #ffcc80'
          }
        case 'normal':
          return {
            background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
            color: '#2e7d32',
            border: '2px solid #a5d6a7'
          }
        default:
          return {
            background: '#f5f5f5',
            color: '#999',
            border: '2px solid #e0e0e0'
          }
      }
    }
    
    const slotStyles = getSlotStyles()
    
    return (
      <div
        key={num}
        onClick={() => handleSlotClick(slotInfo, num)}
        style={{
          padding: isMobile ? '6px' : '8px',
          background: slotStyles.background,
          color: slotStyles.color,
          borderRadius: '6px',
          cursor: 'pointer',
          border: slotStyles.border,
          transition: 'all 0.2s',
          height: isMobile ? '80px' : '90px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          if (isOccupied) {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <div style={{ 
          fontSize: isMobile ? '10px' : '11px', 
          fontWeight: 'bold',
          opacity: 0.7,
          marginBottom: '3px'
        }}>
          #{num}
        </div>
        
        {isOccupied && slotInfo ? (
          <>
            <div style={{ 
              fontSize: isMobile ? '12px' : '13px', 
              fontWeight: 'bold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: '1.3'
            }}>
              {slotInfo.member_nickname || slotInfo.member_name}
            </div>
            
            {slotInfo.expires_at && (
              <div style={{ 
                fontSize: isMobile ? '9px' : '10px',
                opacity: 0.85,
                marginTop: '3px',
                lineHeight: '1.2'
              }}>
                📅 {slotInfo.expires_at}
              </div>
            )}
            
            {/* 備註提示 */}
            {slotInfo.notes && (
              <div style={{ 
                fontSize: isMobile ? '8px' : '9px',
                opacity: 0.9,
                marginTop: '2px',
                lineHeight: '1.2',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={slotInfo.notes}
              >
                📝 {slotInfo.notes.length > 8 ? slotInfo.notes.substring(0, 8) + '...' : slotInfo.notes}
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            fontSize: isMobile ? '11px' : '12px',
            textAlign: 'center',
            marginTop: '6px'
          }}>
            空位
          </div>
        )}
      </div>
    )
  }

  const renderSection = (section: typeof BOARD_SECTIONS[0]) => {
    const slotPairs: Array<{ upper: number | null; lower: number | null }> = []
    
    if (section.upperOnly) {
      for (let i = section.start; i <= section.end; i++) {
        slotPairs.push({ upper: i, lower: null })
      }
    } else {
      for (let i = section.start; i <= section.end; i += 2) {
        const lower = i
        const upper = i + 1
        
        const hasLower = lower <= section.end
        const hasUpper = upper <= section.end
        
        slotPairs.push({
          upper: hasUpper ? upper : null,
          lower: hasLower ? lower : null
        })
      }
    }

    const columnsPerRow = isMobile ? 3 : 9
    
    return (
      <div key={section.name} style={{ marginBottom: '30px' }}>
        <h3 style={{ 
          margin: '0 0 15px 0', 
          fontSize: isMobile ? '16px' : '18px', 
          fontWeight: 'bold',
          color: 'white',
          background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
          padding: '12px',
          borderRadius: '8px'
        }}>
          {section.name} ({section.start}-{section.end})
        </h3>
        
        <div style={{ 
          background: 'white', 
          padding: isMobile ? '12px' : '20px', 
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)`,
            gap: isMobile ? '8px' : '10px'
          }}>
            {slotPairs.map((pair, index) => (
              <React.Fragment key={index}>
                {/* 在每一行開始前（除了第一行）插入橫向分隔線 */}
                {index > 0 && index % columnsPerRow === 0 && (
                  <div style={{
                    gridColumn: `1 / -1`,
                    height: '3px',
                    background: 'linear-gradient(to right, transparent, #666, transparent)',
                    margin: '8px 0',
                    borderRadius: '2px'
                  }} />
                )}
                
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px'
                }}>
                  {pair.upper && renderSlotCard(pair.upper)}
                  {pair.lower && renderSlotCard(pair.lower)}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        載入中...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="🏄 置板區管理" user={user} showBaoLink={true} />

      {/* 操作按鈕區 */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '10px' : '12px',
        marginBottom: isMobile ? '16px' : '20px',
        flexWrap: 'wrap',
      }}>
        <Button
          variant="outline"
          size="medium"
          onClick={() => setShowImportDialog(true)}
          icon={<span>📥</span>}
          style={{ flex: isMobile ? '1 1 100%' : '0 0 auto' }}
        >
          匯入
        </Button>

        <Button
          variant="outline"
          size="medium"
          onClick={handleExportBoards}
          icon={<span>📤</span>}
          style={{ flex: isMobile ? '1 1 100%' : '0 0 auto' }}
        >
          匯出
        </Button>
      </div>

      {/* 統計資訊 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>總格位數</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
            145
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>已使用</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50' }}>
            {boardSlots.length}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>空位</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff9800' }}>
            {145 - boardSlots.length}
          </div>
        </div>
      </div>

      {/* 置板區域 */}
      {BOARD_SECTIONS.map(section => renderSection(section))}

      {/* 格位詳情彈窗 */}
      {selectedSlot && (
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
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            {/* 標題 */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                格位 {selectedSlot.slot_number}
              </h2>
              <button
                onClick={() => setSelectedSlot(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                &times;
              </button>
            </div>

            {/* 內容 */}
            <div style={{ padding: '20px' }}>
              {selectedSlot.member_name ? (
                <>
                  {/* 會員資訊 */}
                  <div style={{ 
                    marginBottom: '20px',
                    padding: '16px',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>會員</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {selectedSlot.member_nickname || selectedSlot.member_name}
                      {selectedSlot.member_nickname && selectedSlot.member_name && (
                        <span style={{ 
                          fontSize: '14px', 
                          color: '#666', 
                          marginLeft: '8px',
                          fontWeight: 'normal'
                        }}>
                          ({selectedSlot.member_name})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 編輯模式 */}
                  {editing ? (
                    <>
                      {/* 開始日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          開始日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.start_date}
                          onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 到期日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          到期日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.expires_at}
                          onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 備註 */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          備註 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="例如：有三格"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 編輯按鈕 */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => setEditing(false)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: '#f0f0f0',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          儲存
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 檢視模式 */}
                      {selectedSlot.expires_at && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>到期日</div>
                          <div style={{ fontSize: '16px' }}>{selectedSlot.expires_at}</div>
                        </div>
                      )}

                      {selectedSlot.notes && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>備註</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic', color: '#999' }}>
                            {selectedSlot.notes}
                          </div>
                        </div>
                      )}

                      {/* 操作按鈕 */}
                      <div style={{ 
                        display: 'flex',
                        gap: '10px',
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid #e0e0e0'
                      }}>
                        <button
                          onClick={() => setEditing(true)}
                          style={{
                            flex: 1,
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ 編輯
                        </button>
                        <button
                          onClick={handleDeleteBoard}
                          style={{
                            flex: 1,
                            padding: '10px 20px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ padding: '20px' }}>
                  {!isAddingBoard ? (
                    <div style={{ 
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#999'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏄</div>
                      <div style={{ fontSize: '16px', marginBottom: '20px' }}>此格位尚未使用</div>
                      <button
                        onClick={() => startAddingBoard(selectedSlot.slot_number)}
                        style={{
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        新增置板
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 會員搜尋 */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          選擇會員 <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={memberSearch}
                          onChange={(e) => {
                            setMemberSearch(e.target.value)
                            searchMembers(e.target.value)
                          }}
                          placeholder="搜尋會員姓名/暱稱..."
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                        
                        {/* 搜尋結果 */}
                        {searchResults.length > 0 && !selectedMember && (
                          <div style={{
                            marginTop: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            background: 'white'
                          }}>
                            {searchResults.map((member) => (
                              <div
                                key={member.id}
                                onClick={() => {
                                  setSelectedMember(member)
                                  setMemberSearch(member.name)
                                  setSearchResults([])
                                }}
                                style={{
                                  padding: '10px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                              >
                                <div style={{ fontWeight: '500' }}>{member.name}</div>
                                {member.nickname && (
                                  <div style={{ fontSize: '13px', color: '#666' }}>
                                    暱稱：{member.nickname}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 已選擇的會員 */}
                        {selectedMember && (
                          <div style={{
                            marginTop: '8px',
                            padding: '12px',
                            background: '#e8f5e9',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontWeight: '500' }}>{selectedMember.name}</div>
                              {selectedMember.nickname && (
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                  暱稱：{selectedMember.nickname}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedMember(null)
                                setMemberSearch('')
                              }}
                              style={{
                                padding: '4px 8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '18px'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 開始日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          開始日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={newBoardForm.start_date}
                          onChange={(e) => setNewBoardForm({ ...newBoardForm, start_date: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 到期日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          到期日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={newBoardForm.expires_at}
                          onChange={(e) => setNewBoardForm({ ...newBoardForm, expires_at: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 備註 */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          備註 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="text"
                          value={newBoardForm.notes}
                          onChange={(e) => setNewBoardForm({ ...newBoardForm, notes: e.target.value })}
                          placeholder="例如：有三格"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 按鈕 */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setIsAddingBoard(false)
                            setSelectedSlot(null)
                          }}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: '#f0f0f0',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleAddBoard}
                          disabled={!selectedMember}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: selectedMember ? 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: selectedMember ? 'pointer' : 'not-allowed'
                          }}
                        >
                          確認新增
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 導入對話框 */}
      {showImportDialog && (
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
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>📥 導入置板資料</h3>
              <button
                onClick={() => {
                  setShowImportDialog(false)
                  setImportFile(null)
                  setImportError('')
                  setImportSuccess('')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999',
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
                marginBottom: '20px',
                fontSize: '14px',
                lineHeight: '1.6',
              }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                  💡 導入說明
                </div>
                <div style={{ color: '#666' }}>
                  • CSV 格式：<code style={{ background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>姓名,暱稱,格位號碼,到期日,備註</code><br />
                  • 會根據會員姓名自動匹配會員資料<br />
                  • <strong style={{ color: '#2196F3' }}>只更新置板資訊</strong>（格位號碼、到期日、備註），<strong style={{ color: '#2196F3' }}>不會更新會員暱稱</strong><br />
                  • 支持一個會員多個格位（每個格位一行）<br />
                  • 格位號碼範圍：1-145<br />
                  • 如果格位已存在會更新，不存在則新增
                </div>
              </div>

              {/* CSV 範例 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                  📄 CSV 範例：
                </div>
                <code style={{
                  display: 'block',
                  background: '#f8f9fa',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  border: '1px solid #dee2e6',
                }}>
姓名,暱稱,格位號碼,到期日,備註{'\n'}
林敏,Ming,1,2025-12-31,第一格{'\n'}
林敏,Ming,5,2025-12-31,第二格{'\n'}
賴奕茵,Ingrid,10,2026-06-30,
                </code>
              </div>

              {/* 檔案選擇 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  fontSize: '14px',
                }}>
                  選擇 CSV 檔案
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

              {/* 錯誤訊息 */}
              {importError && (
                <div style={{
                  background: '#fee',
                  border: '1px solid #fcc',
                  color: '#c33',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {importError}
                </div>
              )}

              {/* 成功訊息 */}
              {importSuccess && (
                <div style={{
                  background: '#d4edda',
                  border: '1px solid #c3e6cb',
                  color: '#155724',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {importSuccess}
                </div>
              )}

              {/* 按鈕 */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleImportBoards}
                  disabled={!importFile || importing}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: !importFile || importing ? '#ccc' : '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: !importFile || importing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importing ? '導入中...' : '開始導入'}
                </button>
                <button
                  onClick={() => {
                    setShowImportDialog(false)
                    setImportFile(null)
                    setImportError('')
                    setImportSuccess('')
                  }}
                  disabled={importing}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: importing ? 'not-allowed' : 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}


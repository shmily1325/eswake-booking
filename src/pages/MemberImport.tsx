import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle, getCardStyle, getTextStyle } from '../styles/designSystem'

interface MemberImportProps {
  user: User
}

interface ParsedMember {
  name: string
  nickname?: string
  phone?: string
  birthday?: string
  membership_type?: string
  membership_start_date?: string
  membership_end_date?: string
  board_slot_number?: string
  board_expiry_date?: string
  free_hours?: string
  notes?: string
}

export function MemberImport({ user }: MemberImportProps) {
  const { isMobile } = useResponsive()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState<ParsedMember[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('請選擇 CSV 文件')
      return
    }

    setFile(selectedFile)
    setError('')
    setSuccess('')

    // 預覽 CSV 內容（使用 papaparse 正確處理特殊字符）
    try {
      const text = await selectedFile.text()
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // 將中文欄位名轉換為英文
          const headerMap: Record<string, string> = {
            '姓名': 'name',
            '暱稱': 'nickname',
            '會員': 'membership_type',
            '會員類型': 'membership_type',
            '會員開始日期': 'membership_start_date',
            '會員截止日': 'membership_end_date',
            '會員到期日': 'membership_end_date',
            '置板位號碼': 'board_slot_number',
            '置板截止日期': 'board_expiry_date',
            '生日': 'birthday',
            '電話': 'phone',
            '贈送時數': 'free_hours',
            '備註': 'notes'
          }
          return headerMap[header] || header
        },
        complete: (results) => {
          const members: ParsedMember[] = results.data
            .filter((row: any) => row.name && row.name.trim())
            .map((row: any) => ({
              name: row.name,
              nickname: row.nickname || undefined,
              phone: row.phone || undefined,
              birthday: row.birthday || undefined,
              membership_type: row.membership_type || undefined,
              membership_start_date: row.membership_start_date || undefined,
              membership_end_date: row.membership_end_date || undefined,
              board_slot_number: row.board_slot_number || undefined,
              board_expiry_date: row.board_expiry_date || undefined,
              free_hours: row.free_hours || undefined,
              notes: row.notes || undefined
            }))

          if (members.length === 0) {
            setError('未找到有效的會員資料')
            return
          }

          setPreview(members)
        },
        error: (error: Error) => {
          setError('解析 CSV 失敗: ' + error.message)
        }
      })
    } catch (err: any) {
      setError('讀取文件失敗: ' + err.message)
    }
  }

  const handleImport = async () => {
    if (preview.length === 0) {
      setError('沒有可導入的資料')
      return
    }

    setImporting(true)
    setError('')
    setSuccess('')

    try {
      // 1. 查詢現有會員的姓名
      const namesToCheck = preview.map(m => m.name.trim())
      
      let existingNames = new Set<string>()
      if (namesToCheck.length > 0) {
        const { data: existingMembers } = await supabase
          .from('members')
          .select('name')
          .in('name', namesToCheck)
          .eq('status', 'active')
        
        existingNames = new Set(existingMembers?.map(m => m.name) || [])
      }

      // 2. 過濾掉重複的會員（根據姓名）
      const newMembers = preview.filter(member => {
        return !existingNames.has(member.name.trim())
      })

      const skippedCount = preview.length - newMembers.length

      if (newMembers.length === 0) {
        setError('所有會員都已存在（根據姓名判斷），沒有新會員需要導入')
        setImporting(false)
        return
      }

      // 3. 插入新會員
      const membersToInsert = newMembers.map(member => {
        // 將中文會籍類型轉換為英文代碼
        let membershipType = 'general'
        if (member.membership_type) {
          const type = member.membership_type.trim()
          if (type === '會員' || type === 'general') {
            membershipType = 'general'
          } else if (type === '雙人會員' || type === 'dual') {
            membershipType = 'dual'
          } else if (type === '置板' || type === 'board') {
            membershipType = 'board'
          }
        }

        return {
          name: member.name,
          nickname: member.nickname || null,
          phone: member.phone || null,
          birthday: member.birthday || null,
          member_type: 'member',
          membership_type: membershipType,
          membership_start_date: member.membership_start_date || null,
          membership_end_date: member.membership_end_date || null,
          board_slot_number: member.board_slot_number || null,
          board_expiry_date: member.board_expiry_date || null,
          free_hours: member.free_hours ? parseInt(member.free_hours) : 0,
          free_hours_used: 0,
          notes: member.notes || null,
          status: 'active',
          balance: 0,
          designated_lesson_minutes: 0,
          boat_voucher_g23_minutes: 0,
          boat_voucher_g21_minutes: 0,
          created_at: new Date().toISOString()
        }
      })

      const { data, error: insertError } = await supabase
        .from('members')
        .insert(membersToInsert)
        .select()

      if (insertError) throw insertError

      // 4. 對於有置板位號碼的會員，同步到 board_storage 表
      if (data && data.length > 0) {
        const boardStorageRecords = []
        
        for (let i = 0; i < data.length; i++) {
          const member = data[i]
          const originalMember = newMembers[i]
          
          if (originalMember.board_slot_number) {
            const slotNumber = parseInt(originalMember.board_slot_number)
            if (!isNaN(slotNumber) && slotNumber >= 1 && slotNumber <= 145) {
              boardStorageRecords.push({
                member_id: member.id,
                slot_number: slotNumber,
                expires_at: originalMember.board_expiry_date || null,
                notes: null,
                status: 'active'
              })
            }
          }
        }

        // 批量插入置板記錄
        if (boardStorageRecords.length > 0) {
          const { error: boardError } = await supabase
            .from('board_storage')
            .insert(boardStorageRecords)

          if (boardError) {
            console.error('置板記錄創建失敗:', boardError)
            // 不中斷流程，只是記錄錯誤
          }
        }
      }

      let successMsg = `✅ 成功導入 ${data?.length || newMembers.length} 位會員！`
      if (skippedCount > 0) {
        successMsg += `\n⚠️ 跳過 ${skippedCount} 位重複會員（姓名已存在）`
      }

      setSuccess(successMsg)
      setPreview([])
      setFile(null)
      
      // 清空文件輸入
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      setError('導入失敗: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const template = '姓名,暱稱,會員,會員開始日期,會員截止日,置板位號碼,置板截止日期,生日,電話,贈送時數,備註\n林敏,Ming,會員,2024-01-01,2055-12-31,,,1990-01-01,0986937619,0,\n楊翊,小楊,會員,2024-01-01,2025-12-31,25,2025-12-31,1992-08-20,,0,不知道姓什麼\nIngrid,Ingrid Lai,雙人會員,2024-06-01,2026-06-01,,,1988-12-10,,30,\n'
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'members_template.csv'
    link.click()
  }

  // 方案1：只刪除沒有預約記錄的會員（保留有預約的會員）
  const handleDeleteMembersWithoutBookings = async () => {
    setDeleting(true)
    setError('')
    setSuccess('')

    try {
      // 先檢查哪些會員有預約記錄
      const { data: allMembers, error: fetchError } = await supabase
        .from('members')
        .select('id')
        .eq('status', 'active')

      if (fetchError) throw fetchError
      if (!allMembers || allMembers.length === 0) {
        setSuccess('✅ 沒有會員需要清空')
        setDeleteDialogOpen(false)
        setDeleting(false)
        return
      }

      // 檢查這些會員是否有預約記錄
      const { data: membersWithBookings, error: memberBookingsError } = await supabase
        .from('bookings')
        .select('member_id')
        .in('member_id', allMembers.map(m => m.id))

      if (memberBookingsError) throw memberBookingsError

      const memberIdsWithBookings = new Set(membersWithBookings?.map(b => b.member_id) || [])
      const memberIdsWithoutBookings = allMembers
        .filter(m => !memberIdsWithBookings.has(m.id))
        .map(m => m.id)

      if (memberIdsWithoutBookings.length === 0) {
        setError('❌ 所有會員都有預約記錄，無會員可刪除')
        setDeleting(false)
        return
      }

      // 只刪除沒有預約記錄的會員
      const { error: deleteError } = await supabase
        .from('members')
        .delete()
        .in('id', memberIdsWithoutBookings)

      if (deleteError) throw deleteError

      setSuccess(`✅ 已刪除 ${memberIdsWithoutBookings.length} 位沒有預約記錄的會員。仍保留 ${memberIdsWithBookings.size} 位有預約記錄的會員。`)
      setDeleteDialogOpen(false)
    } catch (err: any) {
      setError('刪除失敗: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  // 方案2：完全清空所有會員和預約記錄（但保留船和教練）
  const handleDeleteAllMembersAndBookings = async () => {
    setDeleting(true)
    setError('')
    setSuccess('')

    try {
      // 計算統計數據
      const { data: allMembers } = await supabase
        .from('members')
        .select('id')
        .eq('status', 'active')
      
      const { data: allBookings } = await supabase
        .from('bookings')
        .select('id')
      
      const { data: allBoards } = await supabase
        .from('board_storage')
        .select('id')
      
      const { data: allTimeOff } = await supabase
        .from('coach_time_off')
        .select('id')
      
      const { data: allAnnouncements } = await supabase
        .from('daily_announcements')
        .select('id')

      // 1. 刪除每日公告（沒有外鍵依賴）
      const { error: announcementError } = await supabase
        .from('daily_announcements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (announcementError) throw announcementError

      // 2. 刪除教練休假記錄（沒有外鍵依賴會員）
      const { error: timeOffError } = await supabase
        .from('coach_time_off')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (timeOffError) throw timeOffError

      // 3. 刪除所有置板記錄（因為有 member_id 外鍵）
      const { error: boardError } = await supabase
        .from('board_storage')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (boardError) throw boardError

      // 4. 刪除所有預約記錄
      const { error: bookingsError } = await supabase
        .from('bookings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (bookingsError) throw bookingsError

      // 5. 最後刪除所有會員
      const { error: membersError } = await supabase
        .from('members')
        .delete()
        .eq('status', 'active')

      if (membersError) throw membersError

      setSuccess(`✅ 已完全清空：
• 會員：${allMembers?.length || 0} 位
• 預約記錄：${allBookings?.length || 0} 筆
• 置板記錄：${allBoards?.length || 0} 筆
• 教練休假：${allTimeOff?.length || 0} 筆
• 每日公告：${allAnnouncements?.length || 0} 筆

✅ 船和教練資料已保留`)
      setDeleteAllDialogOpen(false)
    } catch (err: any) {
      setError('清空失敗: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <PageHeader user={user} title="會員批量導入" showBaoLink={true} />
      
      <div style={{ flex: 1, padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ ...getTextStyle('h1', isMobile), marginBottom: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl }}>
          📥 會員批量導入
        </h1>

        {/* 電腦使用提示 */}
        <div style={{ 
          ...getCardStyle(isMobile),
          background: '#fff3cd',
          borderLeft: `4px solid #ffc107`,
          marginBottom: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl
        }}>
          <div style={{ ...getTextStyle('body', isMobile), color: '#856404', display: 'flex', alignItems: 'center', gap: designSystem.spacing.sm }}>
            <span style={{ fontSize: '24px' }}>💻</span>
            <span><strong>建議使用電腦操作</strong> - 此功能適合在電腦上使用，以便編輯和上傳 CSV 文件</span>
          </div>
        </div>

        {/* 說明 */}
        <div style={{ 
          ...getCardStyle(isMobile),
          background: '#e3f2fd',
          borderLeft: `4px solid ${designSystem.colors.info}`
        }}>
          <h2 style={{ ...getTextStyle('h3', isMobile), marginBottom: designSystem.spacing.sm, color: designSystem.colors.info }}>
            📋 CSV 格式說明
          </h2>
          <div style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.secondary, lineHeight: '1.8' }}>
            <p style={{ margin: `0 0 ${designSystem.spacing.sm} 0` }}>
              CSV 文件格式（支援逗號或 Tab 分隔）：
            </p>
            <code style={{ 
              display: 'block', 
              background: '#f8f9fa', 
              padding: designSystem.spacing.lg, 
              borderRadius: designSystem.borderRadius.md,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: isMobile ? '11px' : '13px',
              lineHeight: '1.6',
              color: '#2c3e50',
              marginBottom: designSystem.spacing.md,
              overflowX: 'auto',
              border: '1px solid #dee2e6',
              whiteSpace: 'pre'
            }}>
姓名,暱稱,會員,會員開始日期,會員截止日,置板位號碼,置板截止日期,生日,電話,贈送時數,備註{'\n'}
林敏,Ming,會員,2024-01-01,2055-12-31,,,1990-01-01,0986937619,0,{'\n'}
楊翊,小楊,會員,2024-01-01,2025-12-31,25,2025-12-31,1992-08-20,,0,不知道姓什麼{'\n'}
Ingrid,Ingrid Lai,雙人會員,2024-06-01,2026-06-01,,,1988-12-10,,30,
            </code>
                  <p style={{ margin: 0 }}>
                    • <strong>姓名</strong>為必填，其他選填<br/>
                    • <strong>會員類型</strong>：會員、雙人會員、置板<br/>
                    • <strong>日期格式</strong>：<code style={{ background: '#ffebee', padding: '2px 6px', borderRadius: '3px' }}>YYYY-MM-DD</code>（例：2024-01-01）<br/>
                    • <strong>置板位號碼</strong>：1-145 之間的數字<br/>
                    • <strong>電話</strong>：09 開頭 10 位數字<br/>
                    • <strong>贈送時數</strong>：分鐘數（預設 0）
                  </p>
          </div>
          <button
            onClick={downloadTemplate}
            style={{
              ...getButtonStyle('outline', 'small', isMobile),
              marginTop: designSystem.spacing.md
            }}
          >
            📄 下載範本文件
          </button>
        </div>

        {/* 文件上傳 */}
        <div style={{ ...getCardStyle(isMobile) }}>
          <h2 style={{ ...getTextStyle('h3', isMobile), marginBottom: designSystem.spacing.md }}>
            1️⃣ 選擇 CSV 文件
          </h2>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: designSystem.spacing.md,
              border: `2px dashed ${designSystem.colors.border}`,
              borderRadius: designSystem.borderRadius.md,
              cursor: 'pointer',
              fontSize: getTextStyle('body', isMobile).fontSize
            }}
          />
          {file && (
            <div style={{ 
              marginTop: designSystem.spacing.sm, 
              color: designSystem.colors.success,
              fontSize: getTextStyle('bodySmall', isMobile).fontSize
            }}>
              ✓ 已選擇: {file.name}
            </div>
          )}
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div style={{
            ...getCardStyle(isMobile),
            background: '#ffebee',
            color: designSystem.colors.danger,
            borderLeft: `4px solid ${designSystem.colors.danger}`
          }}>
            ❌ {error}
          </div>
        )}

        {/* 成功訊息 */}
        {success && (
          <div style={{
            ...getCardStyle(isMobile),
            background: '#e8f5e9',
            color: designSystem.colors.success,
            borderLeft: `4px solid ${designSystem.colors.success}`
          }}>
            {success}
          </div>
        )}

        {/* 預覽 */}
        {preview.length > 0 && (
          <div style={{ ...getCardStyle(isMobile) }}>
            <h2 style={{ ...getTextStyle('h3', isMobile), marginBottom: designSystem.spacing.md }}>
              2️⃣ 預覽資料（{preview.length} 位會員）
            </h2>
            
            {/* 桌面版表格 */}
            {!isMobile && (
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                overflowX: 'auto',
                border: `1px solid ${designSystem.colors.border}`,
                borderRadius: designSystem.borderRadius.md
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: getTextStyle('bodySmall', isMobile).fontSize
                }}>
                  <thead>
                    <tr style={{ background: designSystem.colors.background.hover }}>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>姓名</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>暱稱</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>會籍類型</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>會員開始</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>會員截止</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>置板位</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>置板到期</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>生日</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>電話</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>贈送時數</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}`, whiteSpace: 'nowrap' }}>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((member, index) => {
                      // 格式化會籍類型顯示
                      let membershipTypeDisplay = '會員'
                      let membershipTypeColor = '#e3f2fd'
                      let membershipTypeTextColor = designSystem.colors.info
                      
                      if (member.membership_type) {
                        const type = member.membership_type.trim()
                        if (type === '雙人會員' || type === 'dual') {
                          membershipTypeDisplay = '雙人會員'
                          membershipTypeColor = '#f3e5f5'
                          membershipTypeTextColor = '#9c27b0'
                        } else if (type === '置板' || type === 'board') {
                          membershipTypeDisplay = '置板'
                          membershipTypeColor = '#e8f5e9'
                          membershipTypeTextColor = '#4caf50'
                        }
                      }

                      return (
                        <tr key={index} style={{ borderBottom: `1px solid ${designSystem.colors.background.hover}` }}>
                          <td style={{ padding: designSystem.spacing.sm }}>{index + 1}</td>
                          <td style={{ padding: designSystem.spacing.sm, fontWeight: '600', whiteSpace: 'nowrap' }}>{member.name}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.nickname || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '11px',
                              background: membershipTypeColor,
                              color: membershipTypeTextColor,
                              whiteSpace: 'nowrap'
                            }}>
                              {membershipTypeDisplay}
                            </span>
                          </td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>{member.membership_start_date || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>{member.membership_end_date || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.board_slot_number || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>{member.board_expiry_date || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>{member.birthday || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>{member.phone || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.free_hours || '0'}分</td>
                          <td style={{ 
                            padding: designSystem.spacing.sm, 
                            color: designSystem.colors.text.secondary,
                            maxWidth: '150px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>{member.notes || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 手機版卡片列表 */}
            {isMobile && (
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: designSystem.spacing.md
              }}>
                {preview.map((member, index) => {
                  // 格式化會籍類型顯示
                  let membershipTypeDisplay = '會員'
                  let membershipTypeColor = '#e3f2fd'
                  let membershipTypeTextColor = designSystem.colors.info
                  
                  if (member.membership_type) {
                    const type = member.membership_type.trim()
                    if (type === '雙人會員' || type === 'dual') {
                      membershipTypeDisplay = '雙人會員'
                      membershipTypeColor = '#f3e5f5'
                      membershipTypeTextColor = '#9c27b0'
                    } else if (type === '置板' || type === 'board') {
                      membershipTypeDisplay = '置板'
                      membershipTypeColor = '#e8f5e9'
                      membershipTypeTextColor = '#4caf50'
                    }
                  }

                  return (
                    <div key={index} style={{
                      padding: designSystem.spacing.md,
                      background: designSystem.colors.background.card,
                      border: `1px solid ${designSystem.colors.border}`,
                      borderRadius: designSystem.borderRadius.md
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: designSystem.spacing.sm,
                        paddingBottom: designSystem.spacing.sm,
                        borderBottom: `1px solid ${designSystem.colors.border}`
                      }}>
                        <span style={{ ...getTextStyle('bodyLarge', isMobile), fontWeight: 'bold' }}>
                          #{index + 1} {member.name}
                        </span>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '11px',
                          background: membershipTypeColor,
                          color: membershipTypeTextColor
                        }}>
                          {membershipTypeDisplay}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: getTextStyle('bodySmall', isMobile).fontSize }}>
                        {member.nickname && <div>暱稱: {member.nickname}</div>}
                        {member.membership_start_date && <div>會員開始: {member.membership_start_date}</div>}
                        {member.membership_end_date && <div>會員截止: {member.membership_end_date}</div>}
                        {member.board_slot_number && <div>置板位: {member.board_slot_number}</div>}
                        {member.board_expiry_date && <div>置板到期: {member.board_expiry_date}</div>}
                        {member.birthday && <div>生日: {member.birthday}</div>}
                        {member.phone && <div>電話: {member.phone}</div>}
                        {(member.free_hours && member.free_hours !== '0') && <div>贈送時數: {member.free_hours}分鐘</div>}
                        {member.notes && <div style={{ 
                          color: designSystem.colors.text.secondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}>備註: {member.notes}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ 
              marginTop: designSystem.spacing.lg,
              display: 'flex',
              gap: designSystem.spacing.md,
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              <button
                onClick={() => {
                  setPreview([])
                  setFile(null)
                  setError('')
                  setSuccess('')
                  const fileInput = document.getElementById('csv-file-input') as HTMLInputElement
                  if (fileInput) fileInput.value = ''
                }}
                disabled={importing}
                style={{
                  ...getButtonStyle('outline', 'medium', isMobile),
                  flex: isMobile ? undefined : 1,
                  opacity: importing ? 0.5 : 1,
                  cursor: importing ? 'not-allowed' : 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  ...getButtonStyle('primary', 'medium', isMobile),
                  flex: isMobile ? undefined : 1,
                  opacity: importing ? 0.5 : 1,
                  cursor: importing ? 'not-allowed' : 'pointer'
                }}
              >
                {importing ? '導入中...' : `✓ 確認導入 ${preview.length} 位會員`}
              </button>
            </div>
          </div>
        )}

        {/* 危險操作區 */}
        <div style={{ 
          ...getCardStyle(isMobile),
          background: '#ffebee',
          borderLeft: `4px solid ${designSystem.colors.danger}`,
          marginTop: isMobile ? designSystem.spacing.xl : '40px'
        }}>
          <h3 style={{ ...getTextStyle('h3', isMobile), margin: 0, marginBottom: designSystem.spacing.md, color: designSystem.colors.danger }}>
            ⚠️ 危險操作
          </h3>
          
          {/* 方案1：只刪除沒有預約的會員 */}
          <div style={{ 
            marginBottom: designSystem.spacing.md,
            padding: designSystem.spacing.md,
            background: 'white',
            borderRadius: designSystem.borderRadius.md,
            border: '1px solid #ffcdd2'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: designSystem.spacing.md }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ ...getTextStyle('bodyLarge', isMobile), fontWeight: '600', marginBottom: designSystem.spacing.xs, color: '#d32f2f' }}>
                  🗑️ 刪除無預約會員
                </div>
                <div style={{ ...getTextStyle('bodySmall', isMobile), color: '#666', lineHeight: '1.6' }}>
                  刪除沒有預約記錄的會員<br/>
                  保留有預約記錄的會員<br/>
                  <span style={{ color: '#999', fontSize: '12px' }}>（適合測試後清理測試資料）</span>
                </div>
              </div>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                style={{
                  ...getButtonStyle('danger', 'medium', isMobile),
                  minWidth: isMobile ? '100%' : '140px'
                }}
              >
                刪除無預約會員
              </button>
            </div>
          </div>

          {/* 方案2：完全清空 */}
          <div style={{ 
            padding: designSystem.spacing.md,
            background: 'white',
            borderRadius: designSystem.borderRadius.md,
            border: '2px solid #d32f2f'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: designSystem.spacing.md }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ ...getTextStyle('bodyLarge', isMobile), fontWeight: '600', marginBottom: designSystem.spacing.xs, color: '#b71c1c' }}>
                  💥 完全清空
                </div>
                <div style={{ ...getTextStyle('bodySmall', isMobile), color: '#666', lineHeight: '1.6' }}>
                  刪除所有會員、預約、置板、教練休假、公告<br/>
                  保留船和教練資料<br/>
                  <span style={{ color: '#d32f2f', fontSize: '12px', fontWeight: '600' }}>⚠️ 無法復原！</span>
                </div>
              </div>
              <button
                onClick={() => setDeleteAllDialogOpen(true)}
                style={{
                  ...getButtonStyle('danger', 'medium', isMobile),
                  background: '#b71c1c',
                  minWidth: isMobile ? '100%' : '140px'
                }}
              >
                完全清空
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* 對話框1：刪除無預約會員 */}
      {deleteDialogOpen && (
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
          padding: designSystem.spacing.xl
        }}>
          <div style={{
            background: 'white',
            borderRadius: designSystem.borderRadius.lg,
            maxWidth: '450px',
            width: '100%',
            padding: designSystem.spacing.xl
          }}>
            <h2 style={{ ...getTextStyle('h2', isMobile), margin: 0, marginBottom: designSystem.spacing.md, color: designSystem.colors.danger }}>
              🗑️ 確認刪除無預約會員
            </h2>
            <p style={{ ...getTextStyle('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xl, lineHeight: '1.6' }}>
              此操作會：<br/>
              • <strong>刪除</strong>沒有預約記錄的會員<br/>
              • <strong>保留</strong>有預約記錄的會員<br/>
              • <strong>保留</strong>所有預約記錄<br/>
              <br/>
              <span style={{ color: designSystem.colors.danger }}>此操作<strong>無法復原</strong>，請確認是否繼續？</span>
            </p>
            <div style={{ display: 'flex', gap: designSystem.spacing.md }}>
              <button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                style={{
                  ...getButtonStyle('outline', 'medium', isMobile),
                  flex: 1,
                  opacity: deleting ? 0.5 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleDeleteMembersWithoutBookings}
                disabled={deleting}
                style={{
                  ...getButtonStyle('danger', 'medium', isMobile),
                  flex: 1,
                  opacity: deleting ? 0.5 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 對話框2：完全清空 */}
      {deleteAllDialogOpen && (
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
          padding: designSystem.spacing.xl
        }}>
          <div style={{
            background: 'white',
            borderRadius: designSystem.borderRadius.lg,
            maxWidth: '450px',
            width: '100%',
            padding: designSystem.spacing.xl,
            border: '3px solid #d32f2f'
          }}>
            <h2 style={{ ...getTextStyle('h2', isMobile), margin: 0, marginBottom: designSystem.spacing.md, color: '#b71c1c' }}>
              💥 確認完全清空
            </h2>
            <p style={{ ...getTextStyle('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xl, lineHeight: '1.6' }}>
              此操作會：<br/>
              • <strong style={{ color: '#d32f2f' }}>刪除所有會員</strong>（無論是否有預約）<br/>
              • <strong style={{ color: '#d32f2f' }}>刪除所有預約記錄</strong><br/>
              • <strong style={{ color: '#d32f2f' }}>刪除所有置板記錄</strong><br/>
              • <strong style={{ color: '#d32f2f' }}>刪除所有教練休假</strong><br/>
              • <strong style={{ color: '#d32f2f' }}>刪除所有每日公告</strong><br/>
              • <strong style={{ color: '#4caf50' }}>保留船資料</strong><br/>
              • <strong style={{ color: '#4caf50' }}>保留教練資料</strong><br/>
              <br/>
              <span style={{ color: '#b71c1c', fontWeight: 'bold', fontSize: '15px' }}>⚠️ 此操作<strong>無法復原</strong>！<br/>確定要繼續嗎？</span>
            </p>
            <div style={{ display: 'flex', gap: designSystem.spacing.md }}>
              <button
                onClick={() => setDeleteAllDialogOpen(false)}
                disabled={deleting}
                style={{
                  ...getButtonStyle('outline', 'medium', isMobile),
                  flex: 1,
                  opacity: deleting ? 0.5 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleDeleteAllMembersAndBookings}
                disabled={deleting}
                style={{
                  ...getButtonStyle('danger', 'medium', isMobile),
                  background: '#b71c1c',
                  flex: 1,
                  opacity: deleting ? 0.5 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? '清空中...' : '確認完全清空'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


import { useState } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { designSystem, getButtonStyle, getCardStyle, getTextStyle } from '../../styles/designSystem'
import { getLocalTimestamp } from '../../utils/date'

interface ParsedMember {
  name: string
  nickname?: string
  phone?: string
  birthday?: string
  membership_type?: string
  partner_name?: string  // 配對會員姓名
  membership_start_date?: string
  membership_end_date?: string
  notes?: string
  status?: string
}

export function MemberImport() {
  const user = useAuthUser()
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
            '會籍類型': 'membership_type',
            '配對會員': 'partner_name',
            '會員開始日期': 'membership_start_date',
            '會員截止日': 'membership_end_date',
            '生日': 'birthday',
            '電話': 'phone',
            '備註': 'notes',
            '狀態': 'status'
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
              partner_name: row.partner_name || undefined,
              membership_start_date: row.membership_start_date || undefined,
              membership_end_date: row.membership_end_date || undefined,
              notes: row.notes || undefined,
              status: row.status || undefined
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

      // 2. 分類會員：新會員 vs 已存在會員（需要更新）
      const newMembers = preview.filter(member => {
        return !existingNames.has(member.name.trim())
      })
      
      const existingMembers = preview.filter(member => {
        return existingNames.has(member.name.trim())
      })

      // 3. 更新已存在的會員
      let updateCount = 0
      if (existingMembers.length > 0) {
        for (const member of existingMembers) {
          // 會籍類型 (用來區分：非會員、一般會員、雙人會員)
          let membershipType = 'general'
          if (member.membership_type) {
            const type = member.membership_type.trim()
            if (type === '一般會員' || type === 'general') {
              membershipType = 'general'
            } else if (type === '雙人會員' || type === 'dual') {
              membershipType = 'dual'
            } else if (type === '非會員' || type === 'guest' || type === '客人') {
              membershipType = 'guest'
            }
          }

          // 狀態
          let status = 'active'
          if (member.status) {
            const statusStr = member.status.trim()
            if (statusStr === '隱藏' || statusStr === 'inactive') {
              status = 'inactive'
            }
          }

          const updateData = {
            nickname: member.nickname || null,
            phone: member.phone || null,
            birthday: member.birthday || null,
            membership_type: membershipType,
            membership_start_date: member.membership_start_date || null,
            membership_end_date: member.membership_end_date || null,
            notes: member.notes || null,
            status: status,
          }

          const { error: updateError } = await supabase
            .from('members')
            .update(updateData)
            .eq('name', member.name.trim())

          if (!updateError) {
            updateCount++
          }
        }
      }

      // 4. 插入新會員（第一階段：不包含配對關係）
      const membersToInsert = newMembers.map(member => {
        // 會籍類型 (用來區分：非會員、一般會員、雙人會員)
        let membershipType = 'general'
        if (member.membership_type) {
          const type = member.membership_type.trim()
          if (type === '一般會員' || type === 'general') {
            membershipType = 'general'
          } else if (type === '雙人會員' || type === 'dual') {
            membershipType = 'dual'
          } else if (type === '非會員' || type === 'guest' || type === '客人') {
            membershipType = 'guest'
          }
        }

        // 狀態
        let status = 'active'
        if (member.status) {
          const statusStr = member.status.trim()
          if (statusStr === '隱藏' || statusStr === 'inactive') {
            status = 'inactive'
          }
        }

        return {
          name: member.name,
          nickname: member.nickname || null,
          phone: member.phone || null,
          birthday: member.birthday || null,
          membership_type: membershipType,
          membership_start_date: member.membership_start_date || null,
          membership_end_date: member.membership_end_date || null,
          balance: 0,
          vip_voucher_amount: 0,
          designated_lesson_minutes: 0,
          boat_voucher_g23_minutes: 0,
          boat_voucher_g21_panther_minutes: 0,
          gift_boat_hours: 0,
          notes: member.notes || null,
          status: status,
          created_at: getLocalTimestamp()
        }
      })

      const { data, error: insertError } = await supabase
        .from('members')
        .insert(membersToInsert)
        .select()

      if (insertError) throw insertError

      // 5. 建立配對關係（第二階段：包含新增和已存在的會員）
      // 注意：只處理 CSV 中出現的會員，不在 CSV 中的會員配對關係不會被影響
      const allMembersToProcess = [...newMembers, ...existingMembers]
      const partnerNotFound: string[] = []
      
      if (allMembersToProcess.length > 0) {
        // 建立姓名到會員ID的映射（新增的會員）
        const nameToIdMap: Record<string, string> = {}
        if (data && data.length > 0) {
          data.forEach((member: any, index: number) => {
            const memberName = newMembers[index].name.trim()
            nameToIdMap[memberName] = member.id
            // 如果新會員有暱稱，也加入映射
            if (newMembers[index].nickname?.trim()) {
              nameToIdMap[newMembers[index].nickname!.trim()] = member.id
            }
          })
        }

        // 查詢所有可能的配對會員名稱
        const allPartnerNames = allMembersToProcess
          .map(m => m.partner_name?.trim())
          .filter(Boolean) as string[]
        
        // 查詢所有需要處理的會員（包括已存在的）
        const allMemberNames = allMembersToProcess.map(m => m.name.trim())

        // 查詢所有相關會員的 ID（同時檢查 name 和 nickname）
        const allNamesToQuery = [...new Set([...allMemberNames, ...allPartnerNames])]
        
        if (allNamesToQuery.length > 0) {
          // 查詢 name 匹配的會員
          const { data: allMembersByName } = await supabase
            .from('members')
            .select('id, name, nickname')
            .in('name', allNamesToQuery)
            .eq('status', 'active')

          // 查詢 nickname 匹配的會員
          const { data: allMembersByNickname } = await supabase
            .from('members')
            .select('id, name, nickname')
            .in('nickname', allNamesToQuery)
            .eq('status', 'active')
            .not('nickname', 'is', null)

          // 合併結果並建立映射
          const allMembers = [
            ...(allMembersByName || []),
            ...(allMembersByNickname || [])
          ]

          // 去重（根據 id）
          const uniqueMembers = new Map<string, any>()
          allMembers.forEach((member: any) => {
            if (!uniqueMembers.has(member.id)) {
              uniqueMembers.set(member.id, member)
            }
          })

          // 建立完整的名稱到ID映射（同時支援 name 和 nickname）
          uniqueMembers.forEach((member: any) => {
            if (member.name && !nameToIdMap[member.name]) {
              nameToIdMap[member.name] = member.id
            }
            if (member.nickname && !nameToIdMap[member.nickname]) {
              nameToIdMap[member.nickname] = member.id
            }
          })
        }

        // 準備配對更新（只處理 CSV 中出現的會員）
        // 重要：只更新有明確提供配對會員名稱的記錄
        // - 如果 CSV 中有填寫配對會員 → 更新配對關係
        // - 如果 CSV 中沒有填寫配對會員 → 不更新（保留原有配對關係）
        // - 如果會員不在 CSV 中 → 完全不處理（配對關係保持不變）
        const partnerUpdates: Array<{ id: string, partner_id: string | null, end_date: string | null }> = []
        
        for (const originalMember of allMembersToProcess) {
          const memberId = nameToIdMap[originalMember.name.trim()]
          if (!memberId) continue
          
          // 只有當 CSV 中有明確填寫配對會員時才更新配對關係
          if (originalMember.partner_name && originalMember.partner_name.trim()) {
            const partnerName = originalMember.partner_name.trim()
            const partnerId = nameToIdMap[partnerName]
            
            if (partnerId) {
              // 雙人會員：到期日綁定一起
              partnerUpdates.push({
                id: memberId,
                partner_id: partnerId,
                end_date: originalMember.membership_end_date || null
              })
            } else {
              // 配對會員不存在，記錄警告
              partnerNotFound.push(`${originalMember.name}→ ${partnerName}`)
              // 如果配對會員不存在，清除配對關係（因為用戶明確指定了配對會員但找不到）
              partnerUpdates.push({
                id: memberId,
                partner_id: null,
                end_date: originalMember.membership_end_date || null
              })
            }
          }
          // 如果 CSV 中沒有填寫配對會員，則不更新配對關係（保留原有配對）
        }

        // 批量更新配對關係
        for (const update of partnerUpdates) {
          await supabase
            .from('members')
            .update({ 
              membership_partner_id: update.partner_id,
              membership_end_date: update.end_date
            })
            .eq('id', update.id)
        }

        // 對於雙人會員，同步更新配對會員的到期日
        for (const update of partnerUpdates) {
          if (update.end_date && update.partner_id) {
            await supabase
              .from('members')
              .update({ membership_end_date: update.end_date })
              .eq('id', update.partner_id)
          }
        }
      }


      let successMsg = `✅ 導入完成！`
      if (newMembers.length > 0) {
        successMsg += `\n📝 新增${newMembers.length}位會員`
      }
      if (updateCount > 0) {
        successMsg += `\n🔄 更新${updateCount}位會員`
      }
      if (partnerNotFound && partnerNotFound.length > 0) {
        successMsg += `\n⚠️ ${partnerNotFound.length}位配對會員不存在：`
        partnerNotFound.forEach(partner => {
          successMsg += `\n${partner}`
        })
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
    const template = '姓名,暱稱,會籍類型,配對會員,會員開始日期,會員截止日,電話,生日,備註,狀態\n林敏,Ming,一般會員,,2024-01-01,2055-12-31,0986937619,1990-01-01,這是範例,啟用\n賴奕茵,Ingrid Lai,雙人會員,林敏,2024-06-01,2026-06-01,0912345678,1988-12-10,雙人配對範例,啟用\n'
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'members_template.csv'
    link.click()
  }

  // 方案1：只刪除沒有任何相關記錄的會員（保留有任何記錄的會員）
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

      // 檢查這些會員是否有任何相關記錄（預約、參與者、財務交易等）
      const memberIds = allMembers.map(m => m.id)
      
      // 1. 查詢 bookings 表中的 member_id（向下相容）
      const { data: membersWithBookingsDirect, error: bookingsError } = await supabase
        .from('bookings')
        .select('member_id')
        .in('member_id', memberIds)
        .not('member_id', 'is', null)

      if (bookingsError) throw bookingsError

      // 2. 查詢 booking_members 表中的 member_id（V5 多會員預約）
      const { data: membersWithBookingsViaTable, error: bookingMembersError } = await supabase
        .from('booking_members')
        .select('member_id')
        .in('member_id', memberIds)

      if (bookingMembersError) throw bookingMembersError

      // 3. 查詢 booking_participants 表中的 member_id（參與者記錄）
      const { data: membersWithParticipants, error: participantsError } = await supabase
        .from('booking_participants')
        .select('member_id')
        .in('member_id', memberIds)
        .not('member_id', 'is', null)

      if (participantsError) throw participantsError

      // 4. 查詢 transactions 表中的 member_id（財務交易記錄）
      const { data: membersWithTransactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('member_id')
        .in('member_id', memberIds)
        .not('member_id', 'is', null)

      if (transactionsError) throw transactionsError

      // 合併所有查詢結果（只要有任何一種記錄就保留該會員）
      const memberIdsWithRecords = new Set([
        ...(membersWithBookingsDirect?.map(b => b.member_id).filter(Boolean) || []),
        ...(membersWithBookingsViaTable?.map(b => b.member_id) || []),
        ...(membersWithParticipants?.map(p => p.member_id).filter(Boolean) || []),
        ...(membersWithTransactions?.map(t => t.member_id).filter(Boolean) || [])
      ])
      const memberIdsWithoutRecords = allMembers
        .filter(m => !memberIdsWithRecords.has(m.id))
        .map(m => m.id)

      if (memberIdsWithoutRecords.length === 0) {
        setError('❌ 所有會員都有相關記錄（預約、參與者或財務交易），無會員可刪除')
        setDeleting(false)
        return
      }

      // 只刪除沒有任何相關記錄的會員
      const { error: deleteError } = await supabase
        .from('members')
        .delete()
        .in('id', memberIdsWithoutRecords)

      if (deleteError) throw deleteError

      setSuccess(`✅ 已刪除 ${memberIdsWithoutRecords.length} 位沒有相關記錄的會員。仍保留 ${memberIdsWithRecords.size} 位有記錄的會員。`)
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
      
      const { data: allParticipants } = await supabase
        .from('booking_participants')
        .select('id')
      
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select('id')

      // 1. 刪除每日公告（沒有外鍵依賴）
      const { error: announcementError } = await supabase
        .from('daily_announcements')
        .delete()
        .neq('id', 0)

      if (announcementError) throw announcementError

      // 2. 刪除教練休假記錄（沒有外鍵依賴會員）
      const { error: timeOffError } = await supabase
        .from('coach_time_off')
        .delete()
        .neq('id', 0)

      if (timeOffError) throw timeOffError

      // 3. 刪除所有置板記錄（因為有 member_id 外鍵）
      const { error: boardError } = await supabase
        .from('board_storage')
        .delete()
        .neq('id', 0)

      if (boardError) throw boardError

      // 4. 刪除所有財務交易記錄（因為有 member_id 外鍵）
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .neq('id', 0)

      if (transactionsError) throw transactionsError

      // 5. 刪除所有參與者記錄（因為有 member_id 外鍵，且 booking_id 有 CASCADE）
      const { error: participantsError } = await supabase
        .from('booking_participants')
        .delete()
        .neq('id', 0)

      if (participantsError) throw participantsError

      // 6. 刪除所有預約記錄（booking_members 會自動 CASCADE 刪除）
      const { error: bookingsError } = await supabase
        .from('bookings')
        .delete()
        .neq('id', 0)

      if (bookingsError) throw bookingsError

      // 7. 最後刪除所有會員
      const { error: membersError } = await supabase
        .from('members')
        .delete()
        .eq('status', 'active')

      if (membersError) throw membersError

      setSuccess(`✅ 已完全清空：
• 會員：${allMembers?.length || 0} 位
• 預約記錄：${allBookings?.length || 0} 筆
• 參與者記錄：${allParticipants?.length || 0} 筆
• 財務交易：${allTransactions?.length || 0} 筆
• 置板記錄：${allBoards?.length || 0} 筆
• 教練休假：${allTimeOff?.length || 0} 筆
• 每日公告：${allAnnouncements?.length || 0} 筆

✅ 已保留：船、教練、權限設定`)
      setDeleteAllDialogOpen(false)
    } catch (err: any) {
      setError('清空失敗: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <div style={{ flex: 1, padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <PageHeader user={user} title="會員批量導入" showBaoLink={true} />
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
        <div         style={{
          ...getCardStyle(isMobile),
          background: '#e3f2fd',
          borderLeft: `4px solid ${designSystem.colors.info[500]}`
        }}>
          <h2 style={{ ...getTextStyle('h3', isMobile), marginBottom: designSystem.spacing.sm, color: designSystem.colors.info[500] }}>
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
              fontSize: isMobile ? '10px' : '12px',
              lineHeight: '1.6',
              color: '#2c3e50',
              marginBottom: designSystem.spacing.md,
              overflowX: 'auto',
              border: '1px solid #dee2e6',
              whiteSpace: 'pre'
            }}>
姓名,暱稱,會籍類型,配對會員,會員開始日期,會員截止日,電話,生日,備註,狀態{'\n'}
林敏,Ming,一般會員,,2024-01-01,2055-12-31,0986937619,1990-01-01,這是範例,啟用{'\n'}
賴奕茵,Ingrid,雙人會員,林敏,2024-06-01,2026-06-01,0912345678,1988-12-10,雙人配對,啟用
            </code>
                  <div style={{
                    background: '#fff3cd',
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    border: '1px solid #ffc107'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#856404', marginBottom: '4px' }}>
                      💡 最佳使用方式
                    </div>
                    <div style={{ fontSize: '13px', color: '#856404', lineHeight: '1.6' }}>
                      1️⃣ 點擊「📤 匯出」導出現有會員資料<br/>
                      2️⃣ 在 Excel 中修改需要更新的資料<br/>
                      3️⃣ 上傳修改後的完整 CSV 檔案<br/>
                      <strong style={{ color: '#d32f2f' }}>⚠️ 姓名相同會覆蓋所有字段（包括空值）</strong>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    • <strong>姓名</strong>為必填，其他選填<br/>
                    • <strong>會籍類型</strong>：一般會員、雙人會員、非會員<br/>
                    • <strong>配對會員</strong>：填寫配對會員的姓名（雙人會員用）<br/>
                    • <strong>日期格式</strong>：<code style={{ background: '#ffebee', padding: '2px 6px', borderRadius: '3px' }}>YYYY-MM-DD</code>（例：2024-01-01）<br/>
                    • <strong>狀態</strong>：啟用、隱藏<br/>
                    • <strong>💰 儲值資料</strong>：請到「會員記帳」頁面導入（儲值、船券等）
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
              border: `2px dashed ${designSystem.colors.border.main}`,
              borderRadius: designSystem.borderRadius.md,
              cursor: 'pointer',
              fontSize: getTextStyle('body', isMobile).fontSize
            }}
          />
          {file && (
            <div style={{ 
              marginTop: designSystem.spacing.sm, 
              color: designSystem.colors.success[500],
              fontSize: getTextStyle('bodySmall', isMobile).fontSize
            }}>
              ✓ 已選擇: {file.name}
            </div>
          )}
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div           style={{
            ...getCardStyle(isMobile),
            background: '#ffebee',
            color: designSystem.colors.danger[500],
            borderLeft: `4px solid ${designSystem.colors.danger[500]}`
          }}>
            ❌ {error}
          </div>
        )}

        {/* 成功訊息 */}
        {success && (
          <div           style={{
            ...getCardStyle(isMobile),
            background: '#e8f5e9',
            color: designSystem.colors.success[500],
            borderLeft: `4px solid ${designSystem.colors.success[500]}`
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
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: designSystem.borderRadius.md
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: getTextStyle('bodySmall', isMobile).fontSize
                }}>
                  <thead>
                    <tr style={{ background: designSystem.colors.background.hover }}>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>姓名</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>暱稱</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>會籍類型</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>會員開始</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>會員截止</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>生日</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>電話</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}`, whiteSpace: 'nowrap' }}>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((member, index) => {
                      // 格式化會籍類型顯示
                      let membershipTypeDisplay = '會員'
                      let membershipTypeColor = '#e3f2fd'
                      let membershipTypeTextColor = designSystem.colors.info[500]
                      
                      if (member.membership_type) {
                        const type = member.membership_type.trim()
                        if (type === '雙人會員' || type === 'dual') {
                          membershipTypeDisplay = '雙人會員'
                          membershipTypeColor = '#f3e5f5'
                          membershipTypeTextColor = '#9c27b0'
                        } else if (type === '非會員' || type === 'guest') {
                          membershipTypeDisplay = '非會員'
                          membershipTypeColor = '#fff9e6'
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
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>{member.birthday || '-'}</td>
                          <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>{member.phone || '-'}</td>
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
                  let membershipTypeTextColor = designSystem.colors.info[500]
                  
                  if (member.membership_type) {
                    const type = member.membership_type.trim()
                    if (type === '雙人會員' || type === 'dual') {
                      membershipTypeDisplay = '雙人會員'
                      membershipTypeColor = '#f3e5f5'
                      membershipTypeTextColor = '#9c27b0'
                    } else if (type === '非會員' || type === 'guest') {
                      membershipTypeDisplay = '非會員'
                      membershipTypeColor = '#fff9e6'
                      membershipTypeTextColor = '#4caf50'
                    }
                  }

                  return (
                    <div key={index} style={{
                      padding: designSystem.spacing.md,
                      background: designSystem.colors.background.card,
                      border: `1px solid ${designSystem.colors.border.main}`,
                      borderRadius: designSystem.borderRadius.md
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: designSystem.spacing.sm,
                        paddingBottom: designSystem.spacing.sm,
                        borderBottom: `1px solid ${designSystem.colors.border.main}`
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
                        {member.birthday && <div>生日: {member.birthday}</div>}
                        {member.phone && <div>電話: {member.phone}</div>}
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
        <div         style={{
          ...getCardStyle(isMobile),
          background: '#ffebee',
          borderLeft: `4px solid ${designSystem.colors.danger[500]}`,
          marginTop: isMobile ? designSystem.spacing.xl : '40px'
        }}>
          <h3 style={{ ...getTextStyle('h3', isMobile), margin: 0, marginBottom: designSystem.spacing.md, color: designSystem.colors.danger[500] }}>
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
                  🗑️ 刪除無資料會員
                </div>
                <div style={{ ...getTextStyle('bodySmall', isMobile), color: '#666', lineHeight: '1.6' }}>
                  刪除沒有任何相關記錄的會員<br/>
                  保留有記錄的會員（預約、參與者、財務交易等）
                </div>
              </div>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                style={{
                  ...getButtonStyle('danger', 'medium', isMobile),
                  minWidth: isMobile ? '100%' : '140px'
                }}
              >
                刪除無資料會員
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
                  保留船、教練、權限設定<br/>
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

      {/* 對話框1：刪除無資料會員 */}
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
            <h2 style={{ ...getTextStyle('h2', isMobile), margin: 0, marginBottom: designSystem.spacing.md, color: designSystem.colors.danger[500] }}>
              🗑️ 確認刪除無資料會員
            </h2>
            <p style={{ ...getTextStyle('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xl, lineHeight: '1.6' }}>
              此操作會：<br/>
              • <strong>刪除</strong>沒有任何相關記錄的會員（預約、參與者、財務交易等）<br/>
              • <strong>保留</strong>有任何記錄的會員<br/>
              • <strong>保留</strong>所有相關記錄<br/>
              <br/>
              <span style={{ color: designSystem.colors.danger[500] }}>此操作<strong>無法復原</strong>，請確認是否繼續？</span>
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
              • <strong style={{ color: '#4caf50' }}>保留權限設定</strong><br/>
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


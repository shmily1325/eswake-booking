import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
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
  member_type?: string
  membership_expires_at?: string
  balance?: string
  boat_voucher_g23_minutes?: string
  boat_voucher_g21_minutes?: string
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

    // 預覽 CSV 內容
    try {
      const text = await selectedFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        setError('CSV 文件為空')
        return
      }

      // 解析 CSV（支援逗號或 Tab 分隔）
      const members: ParsedMember[] = []
      const hasHeader = lines[0].includes('name') || lines[0].includes('姓名')
      const startIndex = hasHeader ? 1 : 0

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // 支援逗號或 Tab 分隔
        const separator = line.includes('\t') ? '\t' : ','
        const parts = line.split(separator).map(p => p.trim())

        if (parts.length === 0 || !parts[0]) continue

        members.push({
          name: parts[0],
          nickname: parts[1] || undefined,
          phone: parts[2] || undefined,
          birthday: parts[3] || undefined,
          member_type: parts[4] || undefined,
          membership_expires_at: parts[5] || undefined,
          balance: parts[6] || undefined,
          boat_voucher_g23_minutes: parts[7] || undefined,
          boat_voucher_g21_minutes: parts[8] || undefined,
          notes: parts[9] || undefined
        })
      }

      if (members.length === 0) {
        setError('未找到有效的會員資料')
        return
      }

      setPreview(members)
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
      const membersToInsert = newMembers.map(member => ({
        name: member.name,
        nickname: member.nickname || null,
        phone: member.phone || null,
        birthday: member.birthday || null,
        member_type: (member.member_type === 'member' || member.member_type === '會員') ? 'member' : 'guest',
        membership_expires_at: member.membership_expires_at || null,
        balance: member.balance ? parseFloat(member.balance) : 0,
        boat_voucher_g23_minutes: member.boat_voucher_g23_minutes ? parseInt(member.boat_voucher_g23_minutes) : 0,
        boat_voucher_g21_minutes: member.boat_voucher_g21_minutes ? parseInt(member.boat_voucher_g21_minutes) : 0,
        notes: member.notes || null,
        status: 'active',
        designated_lesson_minutes: 0,
        created_at: new Date().toISOString()
      }))

      const { data, error: insertError } = await supabase
        .from('members')
        .insert(membersToInsert)
        .select()

      if (insertError) throw insertError

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
    const template = '姓名,暱稱,電話,生日,會員類型,會員到期日,餘額,G23船券,G21/黑豹船券,備註\n林敏,Ming,0986937619,1990-01-01,member,2055-12-31,9999999,9999999,9999999,會籍forever滑水滑到飽\n潘姵如,PJ,0919318658,,guest,,,0,0,0,xxxxx\n小楊,楊翊/林楊翊,,,member,,,0,0,0,不知道姓什麼\nIngrid,,,,member,,,0,0,0,\n'
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'members_template.csv'
    link.click()
  }

  const handleDeleteAllMembers = async () => {
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
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('member_id')
        .in('member_id', allMembers.map(m => m.id))
        .limit(1)

      if (bookingsError) throw bookingsError

      if (bookingsData && bookingsData.length > 0) {
        // 有預約記錄的會員無法刪除，只能刪除沒有預約記錄的
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
          setError('❌ 無法清空：所有會員都有預約記錄。請先在「預約管理」中刪除相關預約，或使用「標記為無效」功能來隱藏會員。')
          setDeleting(false)
          return
        }

        // 只刪除沒有預約記錄的會員
        const { error: deleteError } = await supabase
          .from('members')
          .delete()
          .in('id', memberIdsWithoutBookings)

        if (deleteError) throw deleteError

        setSuccess(`✅ 已刪除 ${memberIdsWithoutBookings.length} 位沒有預約記錄的會員。仍有 ${memberIdsWithBookings.size} 位會員因有預約記錄而無法刪除。`)
        setDeleteDialogOpen(false)
      } else {
        // 沒有預約記錄，可以安全刪除所有會員
        const { error: deleteError } = await supabase
          .from('members')
          .delete()
          .eq('status', 'active')

        if (deleteError) throw deleteError

        setSuccess(`✅ 已清空所有會員（共 ${allMembers.length} 位）！`)
        setDeleteDialogOpen(false)
      }
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
              fontSize: isMobile ? '13px' : '14px',
              lineHeight: '1.8',
              color: '#2c3e50',
              marginBottom: designSystem.spacing.md,
              overflowX: 'auto',
              border: '1px solid #dee2e6',
              whiteSpace: 'pre'
            }}>
姓名,暱稱,電話,生日,會員類型,會員到期日,餘額,G23船券,G21/黑豹船券,備註{'\n'}
林敏,Ming,0986937619,1990-01-01,member,2055-12-31,9999999,9999999,9999999,會籍forever滑水滑到飽{'\n'}
潘姵如,PJ,0919318658,,guest,,,0,0,0,xxxxx{'\n'}
小楊,楊翊/林楊翊,,,member,,,0,0,0,不知道姓什麼{'\n'}
Ingrid,,,,member,,,0,0,0,
            </code>
                  <p style={{ margin: 0 }}>
                    • <strong>姓名</strong>為必填，其他欄位選填<br/>
                    • <strong>生日</strong>: 格式為 <code style={{ background: '#fff3cd', padding: '2px 6px', borderRadius: '3px' }}>YYYY-MM-DD</code>（例：1990-01-01）<br/>
                    • <strong>會員類型</strong>: guest（客人）或 member（會員），預設為 guest<br/>
                    • <strong>會員到期日</strong>: 格式為 <code style={{ background: '#fff3cd', padding: '2px 6px', borderRadius: '3px' }}>YYYY-MM-DD</code>（例：2055-12-31）<br/>
                    • <strong>餘額</strong>: 儲值餘額（數字），預設為 0<br/>
                    • <strong>G23船券</strong>: G23 專用船券時數（分鐘），預設為 0<br/>
                    • <strong>G21/黑豹船券</strong>: G21 與黑豹通用船券時數（分鐘），預設為 0<br/>
                    • ⚠️ <strong>重要</strong>：所有日期必須使用 <code style={{ background: '#ffebee', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>YYYY-MM-DD</code> 格式（年-月-日）<br/>
                    • 第一行可以是標題行（包含「姓名」會自動跳過）<br/>
                    • 空欄位可以留空或使用逗號佔位
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
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>#</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>姓名</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>暱稱</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>電話</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>生日</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>類型</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>會員到期</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>餘額</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>G23船券</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>G21船券</th>
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((member, index) => (
                      <tr key={index} style={{ borderBottom: `1px solid ${designSystem.colors.background.hover}` }}>
                        <td style={{ padding: designSystem.spacing.sm }}>{index + 1}</td>
                        <td style={{ padding: designSystem.spacing.sm, fontWeight: '600' }}>{member.name}</td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.nickname || '-'}</td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.phone || '-'}</td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.birthday || '-'}</td>
                        <td style={{ padding: designSystem.spacing.sm }}>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px',
                            background: member.member_type === 'member' || member.member_type === '會員' ? '#e3f2fd' : '#f5f5f5',
                            color: member.member_type === 'member' || member.member_type === '會員' ? designSystem.colors.info : designSystem.colors.text.secondary
                          }}>
                            {member.member_type === 'member' || member.member_type === '會員' ? '會員' : '客人'}
                          </span>
                        </td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.membership_expires_at || '-'}</td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.balance || '0'}</td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.boat_voucher_g23_minutes || '0'}</td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.boat_voucher_g21_minutes || '0'}</td>
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.notes || '-'}</td>
                      </tr>
                    ))}
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
                {preview.map((member, index) => (
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
                        background: member.member_type === 'member' || member.member_type === '會員' ? '#e3f2fd' : '#f5f5f5',
                        color: member.member_type === 'member' || member.member_type === '會員' ? designSystem.colors.info : designSystem.colors.text.secondary
                      }}>
                        {member.member_type === 'member' || member.member_type === '會員' ? '會員' : '客人'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: getTextStyle('bodySmall', isMobile).fontSize }}>
                      {member.nickname && <div>暱稱: {member.nickname}</div>}
                      {member.phone && <div>電話: {member.phone}</div>}
                      {member.birthday && <div>生日: {member.birthday}</div>}
                        {member.membership_expires_at && <div>會員到期: {member.membership_expires_at}</div>}
                        {(member.balance && member.balance !== '0') && <div>餘額: ${member.balance}</div>}
                        {(member.boat_voucher_g23_minutes && member.boat_voucher_g23_minutes !== '0') && <div>G23船券: {member.boat_voucher_g23_minutes}分鐘</div>}
                        {(member.boat_voucher_g21_minutes && member.boat_voucher_g21_minutes !== '0') && <div>G21船券: {member.boat_voucher_g21_minutes}分鐘</div>}
                        {member.notes && <div style={{ color: designSystem.colors.text.secondary }}>備註: {member.notes}</div>}
                    </div>
                  </div>
                ))}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: designSystem.spacing.md }}>
            <div>
              <h3 style={{ ...getTextStyle('h3', isMobile), margin: 0, marginBottom: designSystem.spacing.xs, color: designSystem.colors.danger }}>
                ⚠️ 危險操作
              </h3>
              <div style={{ ...getTextStyle('bodySmall', isMobile), color: '#c62828' }}>
                永久刪除所有會員資料（無法復原）
              </div>
            </div>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              style={{
                ...getButtonStyle('danger', 'medium', isMobile)
              }}
            >
              🗑️ 清空所有會員
            </button>
          </div>
        </div>
      </div>

      <Footer />

      {/* 清空確認對話框 */}
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
            maxWidth: '400px',
            width: '100%',
            padding: designSystem.spacing.xl
          }}>
            <h2 style={{ ...getTextStyle('h2', isMobile), margin: 0, marginBottom: designSystem.spacing.md, color: designSystem.colors.danger }}>
              ⚠️ 確認清空所有會員
            </h2>
            <p style={{ ...getTextStyle('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xl }}>
              此操作會<strong>永久刪除</strong>所有會員資料。<br/>
              此操作<strong>無法復原</strong>，請確認是否繼續？
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
                onClick={handleDeleteAllMembers}
                disabled={deleting}
                style={{
                  ...getButtonStyle('danger', 'medium', isMobile),
                  flex: 1,
                  opacity: deleting ? 0.5 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? '清空中...' : '確認清空'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


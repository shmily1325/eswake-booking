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
  boat_voucher_minutes?: string
  notes?: string
}

export function MemberImport({ user }: MemberImportProps) {
  const { isMobile } = useResponsive()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState<ParsedMember[]>([])

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
          boat_voucher_minutes: parts[7] || undefined,
          notes: parts[8] || undefined
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
      const membersToInsert = preview.map(member => ({
        name: member.name,
        nickname: member.nickname || null,
        phone: member.phone || null,
        birthday: member.birthday || null,
        member_type: (member.member_type === 'member' || member.member_type === '會員') ? 'member' : 'guest',
        membership_expires_at: member.membership_expires_at || null,
        balance: member.balance ? parseFloat(member.balance) : 0,
        boat_voucher_minutes: member.boat_voucher_minutes ? parseInt(member.boat_voucher_minutes) : 0,
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

      setSuccess(`✅ 成功導入 ${data?.length || preview.length} 位會員！`)
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
    const template = 'name,nickname,phone,birthday,member_type,membership_expires_at,balance,boat_voucher_minutes,notes\n林敏,Ming,0986937619,1990-01-01,member,2055-12-31,1000,120,\n潘姵如,PJ,0919318658,,guest,,,0,xxxxx\n小楊,楊翊/林楊翊,,,guest,,,0,不知道姓什麼\nIngrid,,,,guest,,,0,\n'
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'members_template.csv'
    link.click()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <PageHeader user={user} title="會員批量導入" />
      
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
              background: 'white', 
              padding: designSystem.spacing.sm, 
              borderRadius: designSystem.borderRadius.sm,
              fontFamily: 'monospace',
              fontSize: '12px',
              marginBottom: designSystem.spacing.sm,
              overflowX: 'auto'
            }}>
              name,nickname,phone,birthday,member_type,membership_expires_at,balance,boat_voucher_minutes,notes<br/>
              林敏,Ming,0986937619,1990-01-01,member,2055-12-31,1000,120,<br/>
              潘姵如,PJ,0919318658,,guest,,,0,xxxxx<br/>
              小楊,楊翊/林楊翊,,,member,,,0,不知道姓什麼<br/>
              Ingrid,,,,member,,,0,
            </code>
            <p style={{ margin: 0 }}>
              • <strong>name</strong>（姓名）為必填，其他欄位選填<br/>
              • <strong>birthday</strong>: 生日（格式：YYYY-MM-DD）<br/>
              • <strong>member_type</strong>: guest（客人）或 member（會員），預設為 guest<br/>
              • <strong>membership_expires_at</strong>: 會員到期日（格式：YYYY-MM-DD）<br/>
              • <strong>balance</strong>: 儲值餘額（數字），預設為 0<br/>
              • <strong>boat_voucher_minutes</strong>: 船券時數（分鐘），預設為 0<br/>
              • 第一行可以是標題行（包含 name 或 姓名 會自動跳過）<br/>
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
                      <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>船券時數</th>
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
                        <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.boat_voucher_minutes || '0'}</td>
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
                      {(member.boat_voucher_minutes && member.boat_voucher_minutes !== '0') && <div>船券: {member.boat_voucher_minutes}分鐘</div>}
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
      </div>

      <Footer />
    </div>
  )
}


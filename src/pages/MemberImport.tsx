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
  email?: string
  member_type?: string
  membership_expires_at?: string
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
          email: parts[3] || undefined,
          member_type: parts[4] || undefined,
          membership_expires_at: parts[5] || undefined,
          notes: parts[6] || undefined
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
        email: member.email || null,
        member_type: (member.member_type === 'member' || member.member_type === '會員') ? 'member' : 'guest',
        membership_expires_at: member.membership_expires_at || null,
        notes: member.notes || null,
        status: 'active',
        balance: 0,
        designated_lesson_minutes: 0,
        boat_voucher_g23_minutes: 0,
        boat_voucher_g21_minutes: 0,
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
    const template = 'name,nickname,phone,email,member_type,membership_expires_at,notes\n王小明,小明,0912345678,ming@example.com,member,2025-12-31,VIP會員\n李大華,大華,0923456789,,guest,,一般客人\n'
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
              name,nickname,phone,email,member_type,membership_expires_at,notes<br/>
              王小明,小明,0912345678,ming@example.com,member,2025-12-31,VIP會員<br/>
              李大華,大華,0923456789,,guest,,一般客人
            </code>
            <p style={{ margin: 0 }}>
              • <strong>name</strong>（姓名）為必填，其他欄位選填<br/>
              • <strong>member_type</strong>: guest（客人）或 member（會員）<br/>
              • <strong>membership_expires_at</strong>: 會員到期日（格式：YYYY-MM-DD）<br/>
              • 第一行可以是標題行（會自動跳過）<br/>
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
            
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
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
                    <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>Email</th>
                    <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>類型</th>
                    <th style={{ padding: designSystem.spacing.sm, textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border}` }}>會員到期</th>
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
                      <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.email || '-'}</td>
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
                      <td style={{ padding: designSystem.spacing.sm, color: designSystem.colors.text.secondary }}>{member.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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


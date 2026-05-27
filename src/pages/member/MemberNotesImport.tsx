import { useState } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getButtonStyle, getCardStyle } from '../../styles/designSystem'
import { normalizeDate } from '../../utils/date'
import { isAdmin } from '../../utils/auth'

interface ParsedNote {
  member_name: string
  event_date: string
  event_type: string
  description: string
}

const EVENT_TYPES = ['續約', '購買', '贈送', '使用', '入會', '備註']

const getEventTypeColor = (type: string) => {
  switch (type) {
    case '續約': return '#4caf50'
    case '購買': return '#2196f3'
    case '贈送': return '#9c27b0'
    case '使用': return '#ff9800'
    case '入會': return '#e91e63'
    default: return '#607d8b'
  }
}

export function MemberNotesImport() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState<ParsedNote[]>([])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('請選擇 CSV 文件')
      return
    }

    setError('')
    setSuccess('')

    try {
      const text = await selectedFile.text()
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          const headerMap: Record<string, string> = {
            '姓名': 'member_name',
            '會員姓名': 'member_name',
            '事件日期': 'event_date',
            '日期': 'event_date',
            '事件類型': 'event_type',
            '類型': 'event_type',
            '說明': 'description',
            '備註': 'description',
            '內容': 'description'
          }
          return headerMap[header] || header
        },
        complete: (results) => {
          const notes: ParsedNote[] = results.data
            .filter((row: any) => row.member_name && row.member_name.trim() && row.description && row.description.trim())
            .map((row: any) => ({
              member_name: row.member_name.trim(),
              event_date: normalizeDate(row.event_date) || new Date().toISOString().split('T')[0],
              event_type: EVENT_TYPES.includes(row.event_type) ? row.event_type : '備註',
              description: row.description.trim()
            }))

          if (notes.length === 0) {
            setError('未找到有效的備忘錄資料')
            return
          }

          setPreview(notes)
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
      setError('沒有可匯入的資料')
      return
    }

    setImporting(true)
    setError('')
    setSuccess('')

    try {
      // 1. 獲取所有會員的姓名對應 ID
      const memberNames = [...new Set(preview.map(n => n.member_name))]
      const { data: members, error: memberError } = await supabase
        .from('members')
        .select('id, name')
        .in('name', memberNames)

      if (memberError) throw memberError

      const nameToIdMap: Record<string, string> = {}
      members?.forEach(m => {
        nameToIdMap[m.name] = m.id
      })

      // 2. 檢查哪些會員不存在
      const notFound = memberNames.filter(name => !nameToIdMap[name])
      
      // 3. 插入備忘錄
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const note of preview) {
        const memberId = nameToIdMap[note.member_name]
        if (!memberId) {
          errorCount++
          continue
        }

        // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
        const { error } = await supabase
          .from('member_notes')
          .insert([{
            member_id: memberId,
            event_date: note.event_date,
            event_type: note.event_type,
            description: note.description
          }])

        if (error) {
          errorCount++
          errors.push(`${note.member_name}: ${error.message}`)
        } else {
          successCount++
        }
      }

      // 4. 顯示結果
      let resultMsg = `✅ 成功匯入 ${successCount} 筆備忘錄`
      if (notFound.length > 0) {
        resultMsg += `\n⚠️ ${notFound.length} 位會員不存在：${notFound.slice(0, 5).join('、')}${notFound.length > 5 ? '...' : ''}`
      }
      if (errorCount > 0 && errors.length > 0) {
        resultMsg += `\n❌ ${errorCount} 筆匯入失敗`
      }

      setSuccess(resultMsg)
      setPreview([])
      
      // 重置 file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      setError('匯入失敗: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const template = '姓名,事件日期,事件類型,說明\n林敏,2024-01-01,續約,會員續約至 2025-01-01\n林敏,2023-06-15,購買,購買VIP方案贈送置板一年\n王小明,2024-03-01,入會,新會員入會\n'
    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '備忘錄匯入範本.csv'
    link.click()
  }

  return (
    <div style={{
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PageHeader title="📝 備忘錄匯入" user={user} showBaoLink={isAdmin(user)} />

        <div style={{
        ...getCardStyle(),
        marginBottom: '20px',
        padding: isMobile ? '16px' : '24px',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
          📥 匯入會員備忘錄
        </h2>

        {/* 說明區 */}
        <div style={{
          background: '#f8f9fa',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          lineHeight: '1.8',
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>
            💡 匯入說明
          </div>
          <div style={{ color: '#666' }}>
            • CSV 格式：<code style={{ background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>姓名,事件日期,事件類型,說明</code><br />
            • <strong>姓名</strong>：會員姓名（必須與系統中的會員名稱完全相符）<br />
            • <strong>事件日期</strong>：格式為 YYYY-MM-DD（如 2024-01-15）<br />
            • <strong>事件類型</strong>：續約、購買、贈送、使用、入會、備註<br />
            • <strong>說明</strong>：備忘錄內容
          </div>
        </div>

        {/* 下載範本 */}
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={handleDownloadTemplate}
            style={{
              ...getButtonStyle('outline'),
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            📄 下載範本文件
          </button>
        </div>

        {/* 選擇檔案 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            選擇 CSV 檔案 <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '10px',
              border: '2px dashed #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: '6px',
            marginBottom: '16px',
            whiteSpace: 'pre-line',
          }}>
            {error}
          </div>
        )}

        {/* 成功訊息 */}
        {success && (
          <div style={{
            padding: '12px 16px',
            background: '#e8f5e9',
            color: '#2e7d32',
            borderRadius: '6px',
            marginBottom: '16px',
            whiteSpace: 'pre-line',
          }}>
            {success}
          </div>
        )}

        {/* 預覽 */}
        {preview.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
              📋 預覽資料 ({preview.length} 筆)
            </h3>
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>姓名</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>日期</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>類型</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>說明</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((note, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '500' }}>{note.member_name}</td>
                      <td style={{ padding: '10px 12px', color: '#666' }}>{note.event_date}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: getEventTypeColor(note.event_type),
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}>
                          {note.event_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#333', maxWidth: '300px' }}>
                        {note.description.length > 50 ? note.description.substring(0, 50) + '...' : note.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 匯入按鈕 */}
        {preview.length > 0 && (
          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              ...getButtonStyle('primary'),
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              opacity: importing ? 0.7 : 1,
            }}
          >
            {importing ? '匯入中...' : `✅ 確認匯入 ${preview.length} 筆備忘錄`}
          </button>
        )}
        </div>

        <Footer />
      </div>
    </div>
  )
}


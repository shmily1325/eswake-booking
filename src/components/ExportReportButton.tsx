import { useState } from 'react'
import {
  generateCSVReport,
  downloadAsCSV
} from '../utils/reportExport'
import { useToast } from './ui'

interface ExportReportButtonProps {
  records: any[]
  dateRange: string
  isMobile?: boolean
}

export function ExportReportButton({ records, dateRange, isMobile = false }: ExportReportButtonProps) {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)

    try {
      const dateStr = dateRange.replace(/\//g, '-')
      const reportText = generateCSVReport(records)
      const filename = `回報記錄_${dateStr}.csv`
      
      downloadAsCSV(reportText, filename)
      toast.success('CSV 已下載！')
    } catch (error) {
      console.error('匯出失敗:', error)
      toast.error('匯出失敗，請稍後再試')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || records.length === 0}
      style={{
        padding: isMobile ? '10px 16px' : '10px 20px',
        background: records.length === 0 ? '#ccc' : '#4caf50',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: isMobile ? '14px' : '15px',
        fontWeight: '600',
        cursor: records.length === 0 ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: records.length > 0 ? '0 2px 8px rgba(76,175,80,0.3)' : 'none',
        transition: 'all 0.2s',
        opacity: exporting ? 0.6 : 1
      }}
    >
      📥 {exporting ? '匯出中...' : '匯出 CSV'}
    </button>
  )
}


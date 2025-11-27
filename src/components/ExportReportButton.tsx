import { useState, useRef, useEffect } from 'react'
import {
  generateAllRecordsReport,
  generateCashReport,
  generateTransferReport,
  generateCoachCashReport,
  generateCSVReport,
  copyToClipboard,
  downloadAsFile,
  downloadAsCSV
} from '../utils/reportExport'
import { useToast } from './ui'

interface ExportReportButtonProps {
  records: any[]
  dateRange: string
  isMobile?: boolean
}

// 單個選項組件
interface ExportOptionProps {
  label: string
  onCopy: () => void
  onDownload: () => void
  isLast?: boolean
  hideOnHover?: boolean // CSV 選項只能下載
}

function ExportOption({ label, onCopy, onDownload, isLast = false, hideOnHover = false }: ExportOptionProps) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        borderBottom: isLast ? 'none' : '1px solid #f0f0f0'
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={hideOnHover ? onDownload : onCopy}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'white',
          border: 'none',
          textAlign: 'left',
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'background 0.2s',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
      >
        <span>{label}</span>
        {showActions && !hideOnHover && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDownload()
            }}
            style={{
              padding: '4px 12px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            下載
          </button>
        )}
        {hideOnHover && (
          <span style={{ 
            fontSize: '12px', 
            color: '#999',
            padding: '4px 8px',
            background: '#f0f0f0',
            borderRadius: '4px'
          }}>
            點擊下載
          </span>
        )}
      </button>
    </div>
  )
}

export function ExportReportButton({ records, dateRange, isMobile = false }: ExportReportButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleExport = async (type: 'all' | 'cash' | 'transfer' | 'coach' | 'csv', action: 'copy' | 'download') => {
    setExporting(true)
    setShowDropdown(false)

    try {
      let reportText = ''
      let filename = ''
      const dateStr = dateRange.replace(/\//g, '-')

      switch (type) {
        case 'all':
          reportText = generateAllRecordsReport(records, dateRange)
          filename = `教學記錄明細_${dateStr}.txt`
          break
        case 'cash':
          reportText = generateCashReport(records, dateRange)
          filename = `現金收款明細_${dateStr}.txt`
          break
        case 'transfer':
          reportText = generateTransferReport(records, dateRange)
          filename = `匯款收款明細_${dateStr}.txt`
          break
        case 'coach':
          reportText = generateCoachCashReport(records, dateRange)
          filename = `教練收款明細_${dateStr}.txt`
          break
        case 'csv':
          reportText = generateCSVReport(records)
          filename = `教學記錄明細_${dateStr}.csv`
          break
      }

      if (action === 'download') {
        // 下載檔案
        if (type === 'csv') {
          downloadAsCSV(reportText, filename)
        } else {
          downloadAsFile(reportText, filename)
        }
        toast.success('報表已下載！')
      } else {
        // 複製到剪貼簿
        const success = await copyToClipboard(reportText)
        
        if (success) {
          toast.success('報表已複製到剪貼簿！\n\n您可以貼到 Line、Excel 或記事本')
        } else {
          // 如果複製失敗，顯示文字讓用戶手動複製
          const confirmed = window.confirm('無法自動複製，要顯示報表內容嗎？')
          if (confirmed) {
            toast.info(reportText)
          }
        }
      }
    } catch (error) {
      console.error('匯出失敗:', error)
      toast.error('匯出失敗，請稍後再試')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={exporting || records.length === 0}
        style={{
          padding: isMobile ? '10px 16px' : '10px 20px',
          background: records.length === 0 ? '#ccc' : '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: '600',
          cursor: records.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: records.length > 0 ? '0 2px 8px rgba(33,150,243,0.3)' : 'none',
          transition: 'all 0.2s',
          opacity: exporting ? 0.6 : 1
        }}
      >
        {exporting ? '匯出中...' : '匯出報表'}
        {!exporting && <span style={{ fontSize: '12px' }}>▼</span>}
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '8px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e0e0e0',
            zIndex: 1000,
            minWidth: '280px',
            overflow: 'hidden'
          }}
        >
          {/* 標題區 */}
          <div style={{
            padding: '12px 16px',
            background: '#f8f9fa',
            borderBottom: '1px solid #e0e0e0',
            fontSize: '13px',
            fontWeight: '600',
            color: '#666',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>選擇報表類型</span>
            <span style={{ fontSize: '11px', color: '#999' }}>點擊複製 / 長按下載</span>
          </div>

          {/* 選項 */}
          <ExportOption
            label="匯出所有記錄"
            onCopy={() => handleExport('all', 'copy')}
            onDownload={() => handleExport('all', 'download')}
          />
          <ExportOption
            label="只匯出現金記錄"
            onCopy={() => handleExport('cash', 'copy')}
            onDownload={() => handleExport('cash', 'download')}
          />
          <ExportOption
            label="只匯出匯款記錄"
            onCopy={() => handleExport('transfer', 'copy')}
            onDownload={() => handleExport('transfer', 'download')}
          />
          <ExportOption
            label="按教練匯出（現金/匯款）"
            onCopy={() => handleExport('coach', 'copy')}
            onDownload={() => handleExport('coach', 'download')}
          />
          
          {/* CSV 匯出（分隔線） */}
          <div style={{ 
            borderTop: '2px solid #e0e0e0', 
            margin: '4px 0',
            background: '#f8f9fa',
            padding: '8px 16px',
            fontSize: '12px',
            color: '#999',
            fontWeight: '600'
          }}>
            Excel 格式
          </div>
          
          <ExportOption
            label="匯出 CSV (Excel 可開)"
            onCopy={() => {}} // CSV 不支援複製
            onDownload={() => handleExport('csv', 'download')}
            isLast
            hideOnHover // CSV 只能下載
          />
        </div>
      )}
    </div>
  )
}


/**
 * Design thinking (docs/design.md)
 * - Primary task: 找到學生，查看剩餘時數，必要時回報／修正時數。
 * - Avoid dashboard feel: no stat-card wall, no dense table, no explanatory callouts.
 * - Hierarchy: search/list → current balance → ledger; rare edits stay in dialogs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { designSystem, getButtonStyle, getFontSize, getInputStyle, getLabelStyle } from '../../../styles/designSystem'
import { getLocalDateString } from '../../../utils/date'
import { useToast } from '../../../components/ui'
import {
  backfillCoachDesignatedReportDeductions,
  createCoachDesignatedCredit,
  fetchCoachDesignatedEligibleReports,
  fetchCoachDesignatedStudentDetail,
  fetchCoachDesignatedStudents,
  updateCoachDesignatedEntry,
  voidCoachDesignatedEntry,
} from './api'
import {
  createCoachDesignatedShareImages,
  downloadCoachDesignatedImages,
  type CoachDesignatedShareRow,
} from './shareImages'
import { buildCoachDesignatedBatches } from './fifo'
import { selectCoachDesignatedLedgerRange } from './ledgerRange'
import type {
  CoachDesignatedBatch,
  CoachDesignatedEligibleReport,
  CoachDesignatedEntry,
  CoachDesignatedStudent,
} from './types'

interface CoachDesignatedHoursProps {
  coachId: string
  isMobile: boolean
}

type ListFilter = 'active' | 'used' | 'all'
type ImageView = 'menu' | 'ledger' | 'regular' | 'gift'

function displayName(student: CoachDesignatedStudent): string {
  return student.nickname || student.name
}

function compactDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function createRequestKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getDaysAgoDateString(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return getLocalDateString(date)
}

function formatImageRange(startDate: string, endDate: string): string {
  return `${startDate.replaceAll('-', '/')}－${endDate.replaceAll('-', '/')}`
}

function entryTypeLabel(entry: CoachDesignatedEntry): string {
  const regular = entry.regular_minutes ?? entry.minutes
  const gift = entry.gift_minutes ?? 0
  if (regular > 0 && gift > 0) return `一般 ${regular}・贈送 ${gift}`
  if (gift > 0) return '贈送'
  return entry.entry_type === 'credit' ? '指定課' : ''
}

function expiryLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return `${value < getLocalDateString() ? '已逾使用期限' : '使用期限'} ${value.replaceAll('-', '/')}`
}

function studentExpirySummary(student: CoachDesignatedStudent): Array<{
  key: string
  text: string
  expired: boolean
  gift: boolean
}> {
  const regular = student.regular_expires_on || null
  const gift = student.gift_expires_on || null
  const today = getLocalDateString()
  if (regular && regular === gift) {
    const expired = regular < today
    return [{
      key: 'shared',
      text: `${expired ? '已逾使用期限' : '使用期限'} ${regular.replaceAll('-', '/')}`,
      expired,
      gift: false,
    }]
  }
  return [
    regular
      ? {
          key: 'regular',
          text: `一般｜${regular < today ? '已逾使用期限' : '使用期限'} ${regular.replaceAll('-', '/')}`,
          expired: regular < today,
          gift: false,
        }
      : null,
    gift
      ? {
          key: 'gift',
          text: `贈送｜${gift < today ? '已逾使用期限' : '使用期限'} ${gift.replaceAll('-', '/')}`,
          expired: gift < today,
          gift: true,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)
}

function dialogBackdrop(isMobile: boolean): React.CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: isMobile ? 0 : 16,
    zIndex: designSystem.zIndex.modal,
  }
}

function dialogSurface(isMobile: boolean): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    maxWidth: 520,
    maxHeight: isMobile ? '92dvh' : '85vh',
    overflowY: 'auto',
    padding: isMobile ? 18 : 24,
    borderRadius: isMobile
      ? `${designSystem.borderRadius.xl} ${designSystem.borderRadius.xl} 0 0`
      : designSystem.borderRadius.xl,
    background: designSystem.colors.background.card,
  }
}

export function CoachDesignatedHours({ coachId, isMobile }: CoachDesignatedHoursProps) {
  const toast = useToast()
  const memberSearch = useMemberSearch()
  const [students, setStudents] = useState<CoachDesignatedStudent[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [entries, setEntries] = useState<CoachDesignatedEntry[]>([])
  const [balance, setBalance] = useState(0)
  const [regularBalance, setRegularBalance] = useState(0)
  const [giftBalance, setGiftBalance] = useState(0)
  const [hasGiftEntries, setHasGiftEntries] = useState(false)
  const [regularExpiresOn, setRegularExpiresOn] = useState<string | null>(null)
  const [giftExpiresOn, setGiftExpiresOn] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filter, setFilter] = useState<ListFilter>('active')
  const [creditOpen, setCreditOpen] = useState(false)
  const [deductionOpen, setDeductionOpen] = useState(false)
  const [eligibleReportsLoading, setEligibleReportsLoading] = useState(false)
  const [eligibleReportsError, setEligibleReportsError] = useState<string | null>(null)
  const [eligibleReportsReloadKey, setEligibleReportsReloadKey] = useState(0)
  const [creditMemberId, setCreditMemberId] = useState<string | null>(null)
  const [creditDate, setCreditDate] = useState(getLocalDateString())
  const [creditRegularMinutes, setCreditRegularMinutes] = useState('')
  const [creditGiftMinutes, setCreditGiftMinutes] = useState('')
  const [creditExpiresOn, setCreditExpiresOn] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [creditRequestKey, setCreditRequestKey] = useState(createRequestKey)
  const [eligibleReports, setEligibleReports] = useState<CoachDesignatedEligibleReport[]>([])
  const [eligibleReportLimit, setEligibleReportLimit] = useState(5)
  const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set())
  const [selectedReportRegularMinutes, setSelectedReportRegularMinutes] = useState<Record<number, string>>({})
  const [selectedReportGiftMinutes, setSelectedReportGiftMinutes] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CoachDesignatedEntry | null>(null)
  const [editRegularMinutes, setEditRegularMinutes] = useState('')
  const [editGiftMinutes, setEditGiftMinutes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editExpiresOn, setEditExpiresOn] = useState('')
  const [editNote, setEditNote] = useState('')
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const [imageView, setImageView] = useState<ImageView>('menu')
  const [ledgerImageStartDate, setLedgerImageStartDate] = useState(getDaysAgoDateString(30))
  const [ledgerImageEndDate, setLedgerImageEndDate] = useState(getLocalDateString())
  const [ledgerImageError, setLedgerImageError] = useState<string | null>(null)
  const detailRequestRef = useRef(0)

  const selectedStudent = students.find((student) => student.member_id === selectedMemberId) || null
  const regularBatches = useMemo(
    () => buildCoachDesignatedBatches(entries, 'regular'),
    [entries],
  )
  const giftBatches = useMemo(
    () => buildCoachDesignatedBatches(entries, 'gift'),
    [entries],
  )
  const imageBatches = imageView === 'gift' ? giftBatches : regularBatches
  const parsedEditRegular = Number(editRegularMinutes || 0)
  const parsedEditGift = Number(editGiftMinutes || 0)
  const parsedEditMinutes = parsedEditRegular + parsedEditGift
  const isDefaultLedgerImageRange = ledgerImageStartDate === getDaysAgoDateString(30)
    && ledgerImageEndDate === getLocalDateString()
  const originalEditDelta = editingEntry?.delta_minutes ?? 0
  const originalRegularDelta = editingEntry
    ? (editingEntry.entry_type === 'credit' ? 1 : -1)
      * (editingEntry.regular_minutes ?? editingEntry.minutes)
    : 0
  const originalGiftDelta = editingEntry
    ? (editingEntry.entry_type === 'credit' ? 1 : -1)
      * (editingEntry.gift_minutes ?? 0)
    : 0
  const nextEditDelta = editingEntry
    ? (editingEntry.entry_type === 'credit' ? parsedEditMinutes : -parsedEditMinutes)
    : 0
  const nextRegularDelta = editingEntry
    ? (editingEntry.entry_type === 'credit' ? parsedEditRegular : -parsedEditRegular)
    : 0
  const nextGiftDelta = editingEntry
    ? (editingEntry.entry_type === 'credit' ? parsedEditGift : -parsedEditGift)
    : 0
  const balanceAfterEdit = Number.isFinite(parsedEditMinutes)
    ? balance - originalEditDelta + nextEditDelta
    : balance
  const balanceAfterVoid = balance - originalEditDelta
  const regularAfterEdit = regularBalance - originalRegularDelta + nextRegularDelta
  const giftAfterEdit = giftBalance - originalGiftDelta + nextGiftDelta
  const regularAfterVoid = regularBalance - originalRegularDelta
  const giftAfterVoid = giftBalance - originalGiftDelta

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchCoachDesignatedStudents(coachId)
      setStudents(next)
      if (!isMobile && next.length > 0) {
        setSelectedMemberId((current) => current || next[0].member_id)
      }
    } catch (error) {
      console.error(error)
      toast.error('無法載入指定課學生')
    } finally {
      setLoading(false)
    }
  }, [coachId, isMobile, toast])

  const loadDetail = useCallback(async (memberId: string) => {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setDetailLoading(true)
    try {
      const detail = await fetchCoachDesignatedStudentDetail(coachId, memberId)
      if (requestId !== detailRequestRef.current) return
      setEntries(detail.entries)
      setBalance(detail.balance)
      setRegularBalance(detail.regular_balance)
      setGiftBalance(detail.gift_balance)
      setHasGiftEntries(detail.has_gift_entries)
      setRegularExpiresOn(detail.regular_expires_on)
      setGiftExpiresOn(detail.gift_expires_on)
    } catch (error) {
      if (requestId !== detailRequestRef.current) return
      console.error(error)
      toast.error('無法載入指定課明細')
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }, [coachId, toast])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  useEffect(() => {
    if (selectedMemberId) {
      setEntries([])
      setBalance(0)
      setRegularBalance(0)
      setGiftBalance(0)
      setHasGiftEntries(false)
      setRegularExpiresOn(null)
      setGiftExpiresOn(null)
      void loadDetail(selectedMemberId)
    } else {
      detailRequestRef.current += 1
      setEntries([])
      setBalance(0)
      setRegularBalance(0)
      setGiftBalance(0)
      setHasGiftEntries(false)
      setRegularExpiresOn(null)
      setGiftExpiresOn(null)
    }
  }, [loadDetail, selectedMemberId])

  useEffect(() => {
    if (!deductionOpen || !selectedMemberId) {
      setEligibleReports([])
      setEligibleReportLimit(5)
      setEligibleReportsError(null)
      setEligibleReportsLoading(false)
      return
    }
    let cancelled = false
    setEligibleReportLimit(5)
    setEligibleReportsError(null)
    setEligibleReportsLoading(true)
    fetchCoachDesignatedEligibleReports(coachId, selectedMemberId)
      .then((reports) => {
        if (!cancelled) setEligibleReports(reports)
      })
      .catch((error) => {
        if (cancelled) return
        console.error(error)
        setEligibleReports([])
        setEligibleReportsError('無法載入上課紀錄')
        toast.error('無法載入上課紀錄')
      })
      .finally(() => {
        if (!cancelled) setEligibleReportsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [coachId, deductionOpen, eligibleReportsReloadKey, selectedMemberId, toast])

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const active = (student.regular_balance ?? student.balance) !== 0
        || (student.gift_balance ?? 0) !== 0
      if (filter === 'active' && !active) return false
      if (filter === 'used' && active) return false
      return true
    })
  }, [students, filter])

  const visibleEligibleReports = eligibleReports.slice(0, eligibleReportLimit)
  const selectedDeductionSummary = eligibleReports.reduce((summary, report) => {
    if (!selectedReportIds.has(report.participant_id)) return summary
    const parsedRegular = Number(selectedReportRegularMinutes[report.participant_id] || 0)
    const parsedGift = Number(selectedReportGiftMinutes[report.participant_id] || 0)
    summary.count += 1
    summary.regular += Number.isFinite(parsedRegular) ? parsedRegular : 0
    summary.gift += Number.isFinite(parsedGift) ? parsedGift : 0
    return summary
  }, { count: 0, regular: 0, gift: 0 })
  const selectedDeductionTotal = selectedDeductionSummary.regular + selectedDeductionSummary.gift
  const balanceAfterDeduction = balance - selectedDeductionTotal
  const selectedDeductionHasInvalidMinutes = eligibleReports.some((report) => {
    if (!selectedReportIds.has(report.participant_id)) return false
    const regular = Number(selectedReportRegularMinutes[report.participant_id] || 0)
    const gift = Number(selectedReportGiftMinutes[report.participant_id] || 0)
    return !Number.isFinite(regular)
      || !Number.isFinite(gift)
      || regular < 0
      || gift < 0
      || regular + gift <= 0
  })
  const selectedDeductionExceedsBalance =
    selectedDeductionSummary.regular > regularBalance
    || selectedDeductionSummary.gift > giftBalance
  const deductionSubmitDisabled =
    saving
    || eligibleReportsLoading
    || selectedReportIds.size === 0
    || selectedDeductionHasInvalidMinutes
    || selectedDeductionExceedsBalance

  const resetCreditDialog = () => {
    setCreditOpen(false)
    setCreditMemberId(null)
    setCreditDate(getLocalDateString())
    setCreditRegularMinutes('')
    setCreditGiftMinutes('')
    setCreditExpiresOn('')
    setCreditNote('')
    setCreditRequestKey(createRequestKey())
    memberSearch.reset()
  }

  const resetDeductionDialog = () => {
    setDeductionOpen(false)
    setEligibleReports([])
    setEligibleReportLimit(5)
    setEligibleReportsError(null)
    setSelectedReportIds(new Set())
    setSelectedReportRegularMinutes({})
    setSelectedReportGiftMinutes({})
  }

  const submitCredit = async () => {
    const regularMinutes = Number(creditRegularMinutes || 0)
    const giftMinutes = Number(creditGiftMinutes || 0)
    if (
      !creditMemberId
      || !creditDate
      || !Number.isFinite(regularMinutes)
      || !Number.isFinite(giftMinutes)
      || regularMinutes < 0
      || giftMinutes < 0
      || regularMinutes + giftMinutes <= 0
    ) {
      toast.warning('請選擇會員、日期並輸入正確分鐘')
      return
    }
    setSaving(true)
    try {
      await createCoachDesignatedCredit({
        coachId,
        memberId: creditMemberId,
        regularMinutes,
        giftMinutes,
        occurredAt: `${creditDate}T12:00:00+08:00`,
        expiresOn: creditExpiresOn || null,
        note: creditNote,
        requestKey: creditRequestKey,
      })
      toast.success('指定課時數已新增')
      const nextMemberId = creditMemberId
      resetCreditDialog()
      await loadStudents()
      setSelectedMemberId(nextMemberId)
      await loadDetail(nextMemberId)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '新增時數失敗')
    } finally {
      setSaving(false)
    }
  }

  const submitReportDeductions = async () => {
    if (!selectedMemberId) return
    const selectedReports = eligibleReports.filter((report) =>
      selectedReportIds.has(report.participant_id),
    )
    if (selectedReports.length === 0) {
      toast.warning('請至少選擇一筆回報')
      return
    }
    const items = selectedReports.map((report) => {
      const regularMinutes = Number(
        selectedReportRegularMinutes[report.participant_id] || 0,
      )
      const giftMinutes = Number(
        selectedReportGiftMinutes[report.participant_id] || 0,
      )
      return {
        participant_id: report.participant_id,
        deduct: true,
        minutes: regularMinutes + giftMinutes,
        regular_minutes: regularMinutes,
        gift_minutes: giftMinutes,
      }
    })
    if (items.some((item) => !Number.isFinite(item.minutes) || item.minutes <= 0)) {
      toast.warning('扣除分鐘必須大於 0')
      return
    }
    const regularTotal = items.reduce((sum, item) => sum + item.regular_minutes, 0)
    const giftTotal = items.reduce((sum, item) => sum + item.gift_minutes, 0)
    if (regularTotal > regularBalance || giftTotal > giftBalance) {
      toast.warning('扣除分鐘不能超過目前剩餘時數')
      return
    }
    setSaving(true)
    try {
      await backfillCoachDesignatedReportDeductions(coachId, selectedMemberId, items)
      toast.success('指定課已補扣')
      resetDeductionDialog()
      await loadStudents()
      await loadDetail(selectedMemberId)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '補扣失敗')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (entry: CoachDesignatedEntry) => {
    setCreditOpen(false)
    resetDeductionDialog()
    setImageMenuOpen(false)
    setImageView('menu')
    setEditingEntry(entry)
    setEditRegularMinutes(String(entry.regular_minutes ?? entry.minutes))
    setEditGiftMinutes(String(entry.gift_minutes ?? 0))
    setEditDate(entry.occurred_at.slice(0, 10))
    setEditExpiresOn(entry.expires_on || '')
    setEditNote(entry.note || '')
  }

  const saveEdit = async () => {
    if (!editingEntry) return
    const regularMinutes = Number(editRegularMinutes || 0)
    const giftMinutes = Number(editGiftMinutes || 0)
    if (
      (editingEntry.entry_type === 'credit' && !editDate)
      || !Number.isFinite(regularMinutes)
      || !Number.isFinite(giftMinutes)
      || regularMinutes < 0
      || giftMinutes < 0
      || regularMinutes + giftMinutes <= 0
    ) {
      toast.warning(
        editingEntry.entry_type === 'credit' && !editDate
          ? '請選擇日期'
          : '分鐘必須大於 0',
      )
      return
    }
    setSaving(true)
    try {
      await updateCoachDesignatedEntry({
        entryId: editingEntry.id,
        regularMinutes,
        giftMinutes,
        occurredAt: editingEntry.entry_type === 'credit'
          ? `${editDate}T12:00:00+08:00`
          : null,
        expiresOn: editingEntry.entry_type === 'credit' ? editExpiresOn || null : null,
        note: editingEntry.entry_type === 'credit' ? editNote : null,
      })
      setEditingEntry(null)
      if (selectedMemberId) await loadDetail(selectedMemberId)
      await loadStudents()
      toast.success('指定課紀錄已修改')
    } catch (error) {
      console.error(error)
      toast.error('修改失敗')
    } finally {
      setSaving(false)
    }
  }

  const voidEntry = async () => {
    if (!editingEntry || !confirm('確定取消這筆指定課紀錄？')) return
    setSaving(true)
    try {
      await voidCoachDesignatedEntry(editingEntry.id)
      setEditingEntry(null)
      if (selectedMemberId) await loadDetail(selectedMemberId)
      await loadStudents()
      toast.success('指定課紀錄已取消')
    } catch (error) {
      console.error(error)
      toast.error('取消失敗')
    } finally {
      setSaving(false)
    }
  }

  const saveImages = async (
    title: string,
    rows: CoachDesignatedShareRow[],
    remainingMinutes: number,
    openingMinutes?: number,
    headerNote?: string | null,
  ): Promise<boolean> => {
    if (!selectedStudent) return false
    setSaving(true)
    let files: File[] = []
    try {
      files = await createCoachDesignatedShareImages({
        studentName: displayName(selectedStudent),
        title,
        rows,
        remainingMinutes,
        openingMinutes,
        headerNote,
      })
      const shareData: ShareData = { files, title: `${displayName(selectedStudent)}指定課` }
      if (
        isMobile
        && typeof navigator.share === 'function'
        && (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))
      ) {
        await navigator.share(shareData)
        return true
      }
      if (isMobile) {
        downloadCoachDesignatedImages(files)
        toast.success('圖片已下載')
        return true
      } else {
        downloadCoachDesignatedImages(files)
        toast.success('圖片已下載')
        return true
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false
      console.error(error)
      if (isMobile && files.length > 0) {
        downloadCoachDesignatedImages(files)
        toast.warning('無法開啟分享選單，已改用下載圖片')
        return true
      }
      toast.error('無法開啟圖片分享，請再試一次')
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveLedgerRangeImage = async () => {
    setLedgerImageError(null)
    if (!ledgerImageStartDate || !ledgerImageEndDate) {
      setLedgerImageError('請選擇開始與結束日期')
      return
    }
    if (ledgerImageStartDate > ledgerImageEndDate) {
      setLedgerImageError('結束日期不能早於開始日期')
      return
    }
    const range = selectCoachDesignatedLedgerRange(
      entries,
      ledgerImageStartDate,
      ledgerImageEndDate,
    )
    if (range.entries.length === 0) {
      setLedgerImageError('這段期間沒有指定課流水')
      return
    }
    const rangeRows: CoachDesignatedShareRow[] = range.entries.map((entry) => ({
      date: entry.entry_type === 'credit'
        ? entry.occurred_at.slice(5, 10).replace('-', '/')
        : compactDate(entry.booking_start_at || entry.occurred_at),
      detail: entry.entry_type === 'credit'
        ? entryTypeLabel(entry)
        : [entry.boat_name || '未指定船', entryTypeLabel(entry)].filter(Boolean).join(' · '),
      minutes: entry.delta_minutes,
      note: entry.entry_type === 'credit'
        ? [entry.note, expiryLabel(entry.expires_on)].filter(Boolean).join(' · ') || null
        : entry.note,
    }))

    const saved = await saveImages(
      formatImageRange(ledgerImageStartDate, ledgerImageEndDate),
      rangeRows,
      range.balanceAtEnd,
    )
    if (saved) {
      setImageMenuOpen(false)
      setImageView('menu')
    }
  }

  const saveBatchImage = async (
    batch: CoachDesignatedBatch,
    source: 'regular' | 'gift',
  ) => {
    const label = source === 'gift' ? '贈送指定課' : '一般指定課'
    const rows: CoachDesignatedShareRow[] = batch.allocations.map((allocation) => ({
      date: compactDate(
        allocation.entry.booking_start_at || allocation.entry.occurred_at,
      ),
      detail: allocation.entry.boat_name || '未指定船',
      minutes: -allocation.minutes,
      note: allocation.entry.note,
    }))
    const saved = await saveImages(
      `${batch.credit.occurred_at.slice(0, 10).replaceAll('-', '/')} ${label}`,
      rows,
      batch.remaining,
      batch.minutes,
      [batch.credit.note, expiryLabel(batch.credit.expires_on)]
        .filter(Boolean)
        .join(' · ') || null,
    )
    if (saved) {
      setImageMenuOpen(false)
      setImageView('menu')
    }
  }

  const listPanel = (
    <section>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          type="button"
          data-track="coach_designated_add_open"
          onClick={() => {
            setEditingEntry(null)
            setImageMenuOpen(false)
            setImageView('menu')
            setCreditOpen(true)
          }}
          style={getButtonStyle('primary', 'medium', isMobile)}
        >
          新增指定課
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([
          ['active', '進行中'],
          ['used', '已用完'],
          ['all', '全部'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-track={`coach_designated_filter_${value}`}
            onClick={() => setFilter(value)}
            style={{
              ...getButtonStyle(filter === value ? 'primary' : 'outline', 'small', isMobile),
              minHeight: isMobile ? 42 : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {loading ? (
          <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>載入中...</div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>目前沒有符合的學生</div>
        ) : filteredStudents.map((student) => (
          <button
            key={student.member_id}
            type="button"
            data-track="coach_designated_student_open"
            onClick={() => setSelectedMemberId(student.member_id)}
            style={{
              width: '100%',
              minHeight: isMobile ? 64 : 58,
              padding: '14px',
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.xl,
              background: selectedMemberId === student.member_id
                ? designSystem.colors.background.hover
                : designSystem.colors.background.card,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: getFontSize('bodyLarge', isMobile) }}>
                {displayName(student)}
              </span>
              <span style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    color: (student.regular_balance ?? student.balance) === 0
                      ? designSystem.colors.text.secondary
                      : designSystem.colors.info[700],
                    fontSize: getFontSize('bodySmall', isMobile),
                  }}
                >
                  一般 {student.regular_balance ?? student.balance} 分
                </span>
                {(student.has_gift_entries || (student.gift_balance ?? 0) !== 0) && (
                  <span
                    style={{
                      color: (student.gift_balance ?? 0) === 0
                        ? designSystem.colors.text.secondary
                        : designSystem.colors.warning[700],
                      fontSize: getFontSize('bodySmall', isMobile),
                    }}
                  >
                    贈送 {student.gift_balance} 分
                  </span>
                )}
              </span>
              {studentExpirySummary(student).map((summary) => (
                <span
                  key={summary.key}
                  style={{
                    display: 'block',
                    marginTop: 5,
                    color: summary.expired
                      ? designSystem.colors.danger[700]
                      : summary.gift
                        ? designSystem.colors.warning[700]
                        : designSystem.colors.text.secondary,
                    fontSize: getFontSize('caption', isMobile),
                    fontWeight: summary.expired ? 600 : 400,
                  }}
                >
                  {summary.text}
                </span>
              ))}
            </span>
            <span
              style={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: student.balance < 0
                  ? designSystem.colors.warning[700]
                  : designSystem.colors.text.primary,
              }}
            >
              {student.balance} 分
            </span>
          </button>
        ))}
      </div>
    </section>
  )

  const detailPanel = selectedStudent ? (
    <section>
      {isMobile && (
        <button
          type="button"
          data-track="coach_designated_back_to_students"
          onClick={() => setSelectedMemberId(null)}
          style={{
            ...getButtonStyle('outline', 'small', true),
            minHeight: 44,
            marginBottom: 12,
          }}
        >
          ← 返回學生列表
        </button>
      )}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: getFontSize('h2', isMobile), fontWeight: 700 }}>
          {displayName(selectedStudent)}｜指定課
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: getFontSize('h1', isMobile),
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {balance} 分鐘
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: hasGiftEntries || giftBalance !== 0 ? '1fr 1fr' : '1fr', gap: 10, marginTop: 12 }}>
          <BalanceSummary
            label="一般指定課"
            balance={regularBalance}
            expiresOn={regularExpiresOn}
            tone="regular"
            isMobile={isMobile}
          />
          {(hasGiftEntries || giftBalance !== 0) && (
            <BalanceSummary
              label="贈送指定課"
              balance={giftBalance}
              expiresOn={giftExpiresOn}
              tone="gift"
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button type="button" data-track="coach_designated_add_open" onClick={() => {
          setEditingEntry(null)
          resetDeductionDialog()
          setImageMenuOpen(false)
          setImageView('menu')
          setCreditMemberId(selectedStudent.member_id)
          memberSearch.selectMemberById(selectedStudent.member_id, displayName(selectedStudent))
          setCreditOpen(true)
        }} style={{ ...getButtonStyle('primary', 'medium', isMobile), width: '100%' }}>
          新增指定課
        </button>
        <button
          type="button"
          data-track="coach_designated_backfill_open"
          disabled={balance <= 0}
          onClick={() => {
            setCreditOpen(false)
            setEditingEntry(null)
            setImageMenuOpen(false)
            setImageView('menu')
            setSelectedReportIds(new Set())
            setSelectedReportRegularMinutes({})
            setSelectedReportGiftMinutes({})
            setDeductionOpen(true)
          }}
          style={{
            ...getButtonStyle('outline', 'medium', isMobile),
            width: '100%',
            opacity: balance <= 0 ? 0.55 : 1,
            cursor: balance <= 0 ? 'not-allowed' : 'pointer',
          }}
        >
          補扣指定課
        </button>
        {balance <= 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('caption', isMobile),
            }}
          >
            請先新增指定課，再補扣上課紀錄
          </div>
        )}
        <button
          type="button"
          data-track="coach_designated_save_ledger_image"
          disabled={detailLoading || saving || entries.length === 0}
          onClick={() => {
            setCreditOpen(false)
            resetDeductionDialog()
            setEditingEntry(null)
            setLedgerImageStartDate(getDaysAgoDateString(30))
            setLedgerImageEndDate(getLocalDateString())
            setLedgerImageError(null)
            setImageView('menu')
            setImageMenuOpen(true)
          }}
          style={{
            ...getButtonStyle('outline', 'medium', isMobile),
            gridColumn: '1 / -1',
            width: '100%',
            opacity: detailLoading || saving || entries.length === 0 ? 0.55 : 1,
            cursor: detailLoading || saving || entries.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '產生中...' : '儲存圖片'}
        </button>
      </div>
      {detailLoading ? (
        <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>載入中...</div>
      ) : (
        <EntryList entries={entries} isMobile={isMobile} onEdit={openEdit} />
      )}
    </section>
  ) : (
    <div style={{ padding: 32, color: designSystem.colors.text.secondary, textAlign: 'center' }}>
      選擇學生查看指定課時數
    </div>
  )

  return (
    <>
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
          gap: 24,
        }}
      >
        {(!isMobile || !selectedMemberId) && listPanel}
        {(!isMobile || selectedMemberId) && detailPanel}
      </div>

      {imageMenuOpen && (
        <div
          style={dialogBackdrop(isMobile)}
          onClick={() => {
            setImageMenuOpen(false)
            setImageView('menu')
          }}
        >
          <div
            style={{
              ...dialogSurface(isMobile),
              paddingBottom: isMobile
                ? 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))'
                : 24,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {imageView === 'menu' ? (
              <>
                <ImageDialogHeader
                  title="儲存圖片"
                  isMobile={isMobile}
                  onClose={() => {
                    setImageMenuOpen(false)
                    setImageView('menu')
                  }}
                />
                <div
                  style={{
                    marginBottom: 16,
                    color: designSystem.colors.text.secondary,
                    fontSize: getFontSize('bodySmall', isMobile),
                  }}
                >
                  選擇要分享給學生的格式
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    data-track="coach_designated_image_mode_ledger"
                    onClick={() => setImageView('ledger')}
                    style={{
                      ...getButtonStyle('outline', 'medium', isMobile),
                      minHeight: 58,
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>流水明細</span>
                    <span aria-hidden>›</span>
                  </button>
                  {regularBatches.batches.length > 0 && (
                    <button
                      type="button"
                      data-track="coach_designated_image_mode_regular_batch"
                      onClick={() => setImageView('regular')}
                      style={{
                        ...getButtonStyle('outline', 'medium', isMobile),
                        minHeight: 58,
                        justifyContent: 'space-between',
                        borderColor: designSystem.colors.info[500],
                        background: designSystem.colors.info[50],
                        color: designSystem.colors.info[700],
                      }}
                    >
                      <span>一般指定課分批</span>
                      <span aria-hidden>›</span>
                    </button>
                  )}
                  {(hasGiftEntries || giftBalance !== 0)
                    && giftBatches.batches.length > 0 && (
                    <button
                      type="button"
                      data-track="coach_designated_image_mode_gift_batch"
                      onClick={() => setImageView('gift')}
                      style={{
                        ...getButtonStyle('outline', 'medium', isMobile),
                        minHeight: 58,
                        justifyContent: 'space-between',
                        borderColor: designSystem.colors.warning[500],
                        background: designSystem.colors.warning[50],
                        color: designSystem.colors.warning[700],
                      }}
                    >
                      <span>贈送指定課分批</span>
                      <span aria-hidden>›</span>
                    </button>
                  )}
                </div>
              </>
            ) : imageView === 'ledger' ? (
              <>
                <ImageDialogHeader
                  title="流水明細"
                  isMobile={isMobile}
                  onBack={() => setImageView('menu')}
                  onClose={() => {
                    setImageMenuOpen(false)
                    setImageView('menu')
                  }}
                />
                {!isDefaultLedgerImageRange && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginBottom: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerImageStartDate(getDaysAgoDateString(30))
                        setLedgerImageEndDate(getLocalDateString())
                        setLedgerImageError(null)
                      }}
                      style={getButtonStyle('outline', 'small', isMobile)}
                    >
                      重設近 30 天
                    </button>
                  </div>
                )}
                <label style={getLabelStyle(isMobile)}>開始日期</label>
                <input
                  type="date"
                  value={ledgerImageStartDate}
                  max={ledgerImageEndDate || getLocalDateString()}
                  onChange={(event) => {
                    setLedgerImageStartDate(event.target.value)
                    setLedgerImageError(null)
                  }}
                  style={getInputStyle(isMobile)}
                />
                <div style={{ height: 14 }} />
                <label style={getLabelStyle(isMobile)}>結束日期</label>
                <input
                  type="date"
                  value={ledgerImageEndDate}
                  min={ledgerImageStartDate}
                  max={getLocalDateString()}
                  onChange={(event) => {
                    setLedgerImageEndDate(event.target.value)
                    setLedgerImageError(null)
                  }}
                  style={getInputStyle(isMobile)}
                />
                {ledgerImageError && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 12,
                      color: designSystem.colors.danger[700],
                      fontSize: getFontSize('bodySmall', isMobile),
                    }}
                  >
                    {ledgerImageError}
                  </div>
                )}
                <button
                  type="button"
                  data-track="coach_designated_save_ledger_range"
                  disabled={saving}
                  onClick={() => void saveLedgerRangeImage()}
                  style={{
                    ...getButtonStyle('primary', 'medium', isMobile),
                    width: '100%',
                    minHeight: isMobile ? 50 : 44,
                    marginTop: 22,
                    opacity: saving ? 0.65 : 1,
                    cursor: saving ? 'wait' : 'pointer',
                  }}
                >
                  {saving ? '產生中...' : '產生圖片'}
                </button>
              </>
            ) : (
              <>
                <ImageDialogHeader
                  title={imageView === 'gift' ? '贈送指定課分批' : '一般指定課分批'}
                  isMobile={isMobile}
                  onBack={() => setImageView('menu')}
                  onClose={() => {
                    setImageMenuOpen(false)
                    setImageView('menu')
                  }}
                />
                {imageBatches.unallocatedDeductions.length > 0 && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 10,
                      borderRadius: designSystem.borderRadius.lg,
                      background: designSystem.colors.warning[50],
                      color: designSystem.colors.warning[700],
                      fontSize: getFontSize('bodySmall', isMobile),
                    }}
                  >
                    尚有 {imageBatches.unallocatedDeductions.reduce(
                      (sum, item) => sum + item.minutes,
                      0,
                    )} 分待補，不在以下分批內
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {imageBatches.batches.length === 0 ? (
                    <div style={{ padding: 24, color: designSystem.colors.text.secondary, textAlign: 'center' }}>
                      目前沒有可儲存的分批
                    </div>
                  ) : imageBatches.batches.map((batch) => (
                    <button
                      key={batch.credit.id}
                      type="button"
                      data-track={`coach_designated_save_${imageView}_batch_image`}
                      disabled={saving}
                      onClick={() => void saveBatchImage(batch, imageView)}
                      style={{
                        width: '100%',
                        minHeight: 72,
                        padding: '13px 14px',
                        border: `1px solid ${
                          imageView === 'gift'
                            ? designSystem.colors.warning[500]
                            : designSystem.colors.info[500]
                        }`,
                        borderRadius: designSystem.borderRadius.xl,
                        background: imageView === 'gift'
                          ? designSystem.colors.warning[50]
                          : designSystem.colors.info[50],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        textAlign: 'left',
                        cursor: saving ? 'wait' : 'pointer',
                        opacity: saving ? 0.65 : 1,
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            display: 'block',
                            color: designSystem.colors.text.primary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {batch.credit.occurred_at.slice(0, 10).replaceAll('-', '/')}
                          {batch.credit.note ? ` · ${batch.credit.note}` : ''}
                        </strong>
                        <span
                          style={{
                            display: 'block',
                            marginTop: 5,
                            color: designSystem.colors.text.secondary,
                            fontSize: getFontSize('bodySmall', isMobile),
                          }}
                        >
                          起始 {batch.minutes} 分・剩餘 {batch.remaining} 分
                        </span>
                        {batch.credit.expires_on && (
                          <span
                            style={{
                              display: 'block',
                              marginTop: 4,
                              color: batch.credit.expires_on < getLocalDateString()
                                ? designSystem.colors.danger[700]
                                : designSystem.colors.text.secondary,
                              fontSize: getFontSize('caption', isMobile),
                            }}
                          >
                            {expiryLabel(batch.credit.expires_on)}
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          color: imageView === 'gift'
                            ? designSystem.colors.warning[700]
                            : designSystem.colors.info[700],
                          fontWeight: 600,
                        }}
                      >
                        {saving ? '產生中...' : '產生 ›'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {creditOpen && (
        <div style={dialogBackdrop(isMobile)} onClick={resetCreditDialog}>
          <div style={dialogSurface(isMobile)} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ margin: '0 0 18px', fontSize: getFontSize('h2', isMobile) }}>新增指定課</h2>
            {!creditMemberId && (
              <div style={{ marginBottom: 14, position: 'relative' }}>
                <label style={getLabelStyle(isMobile)}>選擇學生</label>
                <input
                  value={memberSearch.searchTerm}
                  onChange={(event) => memberSearch.handleSearchChange(event.target.value)}
                  style={getInputStyle(isMobile)}
                  placeholder="搜尋全部會員"
                />
                {memberSearch.filteredMembers.length > 0 && (
                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: 'auto',
                      border: `1px solid ${designSystem.colors.border.light}`,
                      borderRadius: designSystem.borderRadius.md,
                    }}
                  >
                    {memberSearch.filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          memberSearch.selectMember(member)
                          setCreditMemberId(member.id)
                        }}
                        style={{
                          width: '100%',
                          padding: 12,
                          border: 0,
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        {member.nickname || member.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {creditMemberId && (
              <div style={{ marginBottom: 14, fontWeight: 600 }}>{memberSearch.searchTerm}</div>
            )}
            <label style={getLabelStyle(isMobile)}>日期</label>
            <input
              type="date"
              value={creditDate}
              onChange={(event) => setCreditDate(event.target.value)}
              style={getInputStyle(isMobile)}
            />
            <div style={{ height: 12 }} />
            <label style={getLabelStyle(isMobile)}>一般指定課分鐘</label>
            <input
              type="text"
              inputMode="numeric"
              value={creditRegularMinutes}
              onChange={(event) => setCreditRegularMinutes(event.target.value.replace(/\D/g, ''))}
              style={getInputStyle(isMobile)}
              placeholder="沒有可留空"
            />
            <div style={{ height: 12 }} />
            <label style={getLabelStyle(isMobile)}>贈送指定課分鐘 <span style={{ color: designSystem.colors.text.secondary }}>（選填）</span></label>
            <input
              type="text"
              inputMode="numeric"
              value={creditGiftMinutes}
              onChange={(event) => setCreditGiftMinutes(event.target.value.replace(/\D/g, ''))}
              style={getInputStyle(isMobile)}
              placeholder="沒有贈送可留空"
            />
            <div style={{ height: 12 }} />
            <OptionalDateField
              label="使用期限"
              hint="選填，僅提醒"
              value={creditExpiresOn}
              onChange={setCreditExpiresOn}
              isMobile={isMobile}
            />
            <div style={{ height: 12 }} />
            <label style={getLabelStyle(isMobile)}>名稱／備註 <span style={{ color: designSystem.colors.text.secondary }}>（選填）</span></label>
            <input value={creditNote} onChange={(event) => setCreditNote(event.target.value)} style={getInputStyle(isMobile)} placeholder="例如：300＋30、贈送綜合課程" />
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 20,
                padding: '12px 0',
                position: 'sticky',
                bottom: isMobile ? -18 : -24,
                zIndex: 2,
                background: designSystem.colors.background.card,
                borderTop: `1px solid ${designSystem.colors.border.light}`,
              }}
            >
              <button type="button" onClick={resetCreditDialog} style={{ ...getButtonStyle('outline', 'medium', isMobile), flex: 1 }}>取消</button>
              <button type="button" data-track="coach_designated_add_submit" disabled={saving} onClick={() => void submitCredit()} style={{ ...getButtonStyle('primary', 'medium', isMobile), flex: 1 }}>
                {saving ? '儲存中...' : '確認新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deductionOpen && selectedStudent && (
        <div style={dialogBackdrop(isMobile)} onClick={resetDeductionDialog}>
          <div style={dialogSurface(isMobile)} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ margin: '0 0 6px', fontSize: getFontSize('h2', isMobile) }}>
              補扣指定課
            </h2>
            <div
              style={{
                marginBottom: 18,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
              }}
            >
              {displayName(selectedStudent)}｜一般 {regularBalance} 分
              {(hasGiftEntries || giftBalance !== 0) && `・贈送 ${giftBalance} 分`}
            </div>

            {eligibleReportsLoading ? (
              <div style={{ padding: 24, color: designSystem.colors.text.secondary, textAlign: 'center' }}>
                載入回報中...
              </div>
            ) : eligibleReportsError ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div role="alert" style={{ color: designSystem.colors.danger[700], marginBottom: 12 }}>
                  {eligibleReportsError}
                </div>
                <button
                  type="button"
                  onClick={() => setEligibleReportsReloadKey((current) => current + 1)}
                  style={getButtonStyle('outline', 'medium', isMobile)}
                >
                  重新載入
                </button>
              </div>
            ) : visibleEligibleReports.length === 0 ? (
              <div style={{ padding: 24, color: designSystem.colors.text.secondary, textAlign: 'center' }}>
                沒有可補扣的上課紀錄
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleEligibleReports.map((report) => {
                  const selected = selectedReportIds.has(report.participant_id)
                  const reportRegular = Number(
                    selectedReportRegularMinutes[report.participant_id] || 0,
                  )
                  const reportGift = Number(
                    selectedReportGiftMinutes[report.participant_id] || 0,
                  )
                  const reportTotal = reportRegular + reportGift
                  return (
                    <div
                      key={report.participant_id}
                      style={{
                        padding: selected ? '10px 12px 12px' : '4px 12px',
                        border: `1px solid ${
                          selected
                            ? designSystem.colors.primary[500]
                            : designSystem.colors.border.light
                        }`,
                        borderRadius: designSystem.borderRadius.lg,
                        background: selected
                          ? designSystem.colors.primary[50]
                          : designSystem.colors.background.card,
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          minHeight: 44,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          data-track="coach_designated_existing_report_toggle"
                          checked={selected}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setSelectedReportIds((current) => {
                              const next = new Set(current)
                              if (checked) next.add(report.participant_id)
                              else next.delete(report.participant_id)
                              return next
                            })
                            setSelectedReportRegularMinutes((current) => {
                              const next = { ...current }
                              if (checked) {
                                next[report.participant_id] = regularBalance === 0 && giftBalance > 0
                                  ? '0'
                                  : String(report.duration_min)
                              }
                              else delete next[report.participant_id]
                              return next
                            })
                            setSelectedReportGiftMinutes((current) => {
                              const next = { ...current }
                              if (checked) {
                                next[report.participant_id] = regularBalance === 0 && giftBalance > 0
                                  ? String(report.duration_min)
                                  : '0'
                              } else {
                                delete next[report.participant_id]
                              }
                              return next
                            })
                          }}
                          style={{ width: 20, height: 20, flex: '0 0 auto' }}
                        />
                        <span style={{ lineHeight: 1.45 }}>
                          {report.booking_start_at.slice(0, 16).replace('T', ' ')} · {report.boat_name || '上課'} · {report.duration_min} 分
                        </span>
                      </label>
                      {selected && (
                        <div
                          style={{
                            marginLeft: 30,
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: hasGiftEntries || giftBalance !== 0
                                ? 'repeat(2, minmax(0, 1fr))'
                                : '1fr',
                              gap: 8,
                            }}
                          >
                            <label style={{ fontSize: getFontSize('bodySmall', isMobile) }}>
                              一般
                              <input
                                aria-label={`一般指定課扣除分鐘，預約 ${report.duration_min} 分`}
                                type="text"
                                inputMode="numeric"
                                value={selectedReportRegularMinutes[report.participant_id] ?? ''}
                                onChange={(event) => {
                                  const value = event.target.value.replace(/\D/g, '')
                                  setSelectedReportRegularMinutes((current) => ({
                                    ...current,
                                    [report.participant_id]: value,
                                  }))
                                }}
                                style={{
                                  ...getInputStyle(isMobile),
                                  minHeight: 44,
                                  marginTop: 4,
                                  padding: '8px 10px',
                                }}
                              />
                            </label>
                            {(hasGiftEntries || giftBalance !== 0) && (
                              <label style={{ fontSize: getFontSize('bodySmall', isMobile) }}>
                                贈送
                                <input
                                  aria-label={`贈送指定課扣除分鐘，預約 ${report.duration_min} 分`}
                                  type="text"
                                  inputMode="numeric"
                                  value={selectedReportGiftMinutes[report.participant_id] ?? ''}
                                  onChange={(event) => {
                                    const value = event.target.value.replace(/\D/g, '')
                                    setSelectedReportGiftMinutes((current) => ({
                                      ...current,
                                      [report.participant_id]: value,
                                    }))
                                  }}
                                  style={{
                                    ...getInputStyle(isMobile),
                                    minHeight: 44,
                                    marginTop: 4,
                                    padding: '8px 10px',
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          <span
                            style={{
                              display: 'block',
                              marginTop: 6,
                              color: designSystem.colors.text.secondary,
                              fontSize: getFontSize('bodySmall', isMobile),
                            }}
                          >
                            本次共扣 {reportTotal} 分（預約 {report.duration_min}）
                          </span>
                          {reportTotal > report.duration_min && (
                            <span
                              style={{
                                display: 'block',
                                marginTop: 4,
                                width: '100%',
                                color: designSystem.colors.warning[700],
                                fontSize: getFontSize('bodySmall', isMobile),
                              }}
                            >
                              預約 {report.duration_min} 分，本次扣除 {reportTotal} 分
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {eligibleReportLimit < eligibleReports.length && (
                  <button
                    type="button"
                    data-track="coach_designated_load_older_reports"
                    onClick={() => setEligibleReportLimit((current) => current + 5)}
                    style={{
                      ...getButtonStyle('outline', 'medium', isMobile),
                      width: '100%',
                      minHeight: 44,
                    }}
                  >
                    顯示更早回報（尚有 {eligibleReports.length - eligibleReportLimit} 筆）
                  </button>
                )}
              </div>
            )}
            {selectedDeductionSummary.count > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  borderRadius: designSystem.borderRadius.lg,
                  background: designSystem.colors.background.hover,
                  color: designSystem.colors.text.primary,
                  fontSize: getFontSize('bodySmall', isMobile),
                  lineHeight: 1.6,
                }}
              >
                <div>
                  已選 {selectedDeductionSummary.count} 堂・共扣 {selectedDeductionTotal} 分
                </div>
                {selectedDeductionExceedsBalance ? (
                  <strong
                    role="alert"
                    style={{
                      display: 'block',
                      marginTop: 2,
                      color: designSystem.colors.danger[700],
                    }}
                  >
                    扣除超過目前餘額
                  </strong>
                ) : (
                  <>
                    <strong style={{ display: 'block', marginTop: 2 }}>
                      扣後剩餘 {balanceAfterDeduction} 分
                    </strong>
                    {(hasGiftEntries || giftBalance !== 0) && (
                      <div style={{ color: designSystem.colors.text.secondary }}>
                        一般 {regularBalance - selectedDeductionSummary.regular} 分・贈送 {giftBalance - selectedDeductionSummary.gift} 分
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 20,
                padding: '12px 0',
                position: 'sticky',
                bottom: isMobile ? -18 : -24,
                zIndex: 2,
                background: designSystem.colors.background.card,
                borderTop: `1px solid ${designSystem.colors.border.light}`,
              }}
            >
              <button type="button" onClick={resetDeductionDialog} style={{ ...getButtonStyle('outline', 'medium', isMobile), flex: 1 }}>
                取消
              </button>
              <button
                type="button"
                data-track="coach_designated_backfill_submit"
                disabled={deductionSubmitDisabled}
                onClick={() => void submitReportDeductions()}
                style={{
                  ...getButtonStyle('primary', 'medium', isMobile),
                  flex: 1,
                  opacity: deductionSubmitDisabled ? 0.55 : 1,
                }}
              >
                {saving ? '儲存中...' : '確認扣除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEntry && (
        <div style={dialogBackdrop(isMobile)} onClick={() => setEditingEntry(null)}>
          <div style={dialogSurface(isMobile)} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ margin: '0 0 18px', fontSize: getFontSize('h2', isMobile) }}>
              {editingEntry.entry_type === 'credit' ? '修改指定課' : '修改本次扣除'}
            </h2>
            {editingEntry.entry_type === 'credit' && (
              <>
                <label style={getLabelStyle(isMobile)}>日期</label>
                <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} style={getInputStyle(isMobile)} />
                <div style={{ height: 12 }} />
              </>
            )}
            <label style={getLabelStyle(isMobile)}>一般指定課分鐘</label>
            <input
              inputMode="numeric"
              value={editRegularMinutes}
              onChange={(event) => setEditRegularMinutes(event.target.value.replace(/\D/g, ''))}
              style={getInputStyle(isMobile)}
            />
            <div style={{ height: 12 }} />
            <label style={getLabelStyle(isMobile)}>贈送指定課分鐘</label>
            <input
              inputMode="numeric"
              value={editGiftMinutes}
              onChange={(event) => setEditGiftMinutes(event.target.value.replace(/\D/g, ''))}
              style={getInputStyle(isMobile)}
            />
            {editingEntry.entry_type === 'credit' && (
              <>
                <div style={{ height: 12 }} />
                <OptionalDateField
                  label="使用期限"
                  hint="選填"
                  value={editExpiresOn}
                  onChange={setEditExpiresOn}
                  isMobile={isMobile}
                />
                <div style={{ height: 12 }} />
                <label style={getLabelStyle(isMobile)}>備註</label>
                <input value={editNote} onChange={(event) => setEditNote(event.target.value)} style={getInputStyle(isMobile)} />
              </>
            )}
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: designSystem.borderRadius.lg,
                background: designSystem.colors.background.main,
                color: designSystem.colors.text.secondary,
              }}
            >
              修改後剩餘：<strong style={{ color: designSystem.colors.text.primary }}>{balanceAfterEdit} 分</strong>
              <div style={{ marginTop: 4, fontSize: getFontSize('bodySmall', isMobile) }}>
                一般 {regularAfterEdit} 分・贈送 {giftAfterEdit} 分
              </div>
              <div style={{ marginTop: 4, fontSize: getFontSize('bodySmall', isMobile) }}>
                若取消此筆，總剩餘為 {balanceAfterVoid} 分
                （一般 {regularAfterVoid}・贈送 {giftAfterVoid}）
              </div>
              {editingEntry.entry_type === 'report_deduction'
                && editingEntry.duration_min
                && parsedEditMinutes > editingEntry.duration_min && (
                <div
                  style={{
                    marginTop: 4,
                    color: designSystem.colors.warning[700],
                    fontSize: getFontSize('bodySmall', isMobile),
                  }}
                >
                  預約 {editingEntry.duration_min} 分，本次扣除 {parsedEditMinutes} 分
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button" data-track="coach_designated_entry_void" onClick={() => void voidEntry()} style={getButtonStyle('danger', 'medium', isMobile)}>取消此筆</button>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={() => setEditingEntry(null)} style={getButtonStyle('outline', 'medium', isMobile)}>返回</button>
              <button type="button" data-track="coach_designated_entry_save" disabled={saving} onClick={() => void saveEdit()} style={getButtonStyle('primary', 'medium', isMobile)}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function OptionalDateField({
  label,
  hint,
  value,
  onChange,
  isMobile,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  isMobile: boolean
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: designSystem.spacing.sm,
        }}
      >
        <label style={{ ...getLabelStyle(isMobile), marginBottom: 0 }}>
          {label}{' '}
          <span style={{ color: designSystem.colors.text.secondary }}>（{hint}）</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              minHeight: 36,
              padding: '6px 10px',
              border: `1px solid ${designSystem.colors.border.main}`,
              borderRadius: designSystem.borderRadius.md,
              background: designSystem.colors.background.card,
              color: designSystem.colors.text.secondary,
              cursor: 'pointer',
              fontSize: getFontSize('bodySmall', isMobile),
            }}
          >
            清除
          </button>
        )}
      </div>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={getInputStyle(isMobile)}
      />
    </>
  )
}

function ImageDialogHeader({
  title,
  isMobile,
  onBack,
  onClose,
}: {
  title: string
  isMobile: boolean
  onBack?: () => void
  onClose: () => void
}) {
  const controlStyle: React.CSSProperties = {
    height: 44,
    padding: 0,
    border: `1px solid ${designSystem.colors.border.light}`,
    borderRadius: designSystem.borderRadius.lg,
    background: designSystem.colors.background.card,
    color: designSystem.colors.text.secondary,
    cursor: 'pointer',
    fontSize: getFontSize('bodyLarge', isMobile),
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: onBack
          ? '72px minmax(0, 1fr) 44px'
          : '44px minmax(0, 1fr) 44px',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}
    >
      {onBack ? (
        <button
          type="button"
          aria-label="返回選擇格式"
          data-track="coach_designated_image_back"
          onClick={onBack}
          style={{ ...controlStyle, width: 72 }}
        >
          ← 返回
        </button>
      ) : <span />}
      <h2
        style={{
          margin: 0,
          textAlign: 'center',
          fontSize: getFontSize('h2', isMobile),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </h2>
      <button
        type="button"
        aria-label="關閉"
        data-track="coach_designated_image_close"
        onClick={onClose}
        style={{ ...controlStyle, width: 44 }}
      >
        ×
      </button>
    </div>
  )
}

function BalanceSummary({
  label,
  balance,
  expiresOn,
  tone,
  isMobile,
}: {
  label: string
  balance: number
  expiresOn: string | null
  tone: 'regular' | 'gift'
  isMobile: boolean
}) {
  const expired = !!expiresOn && expiresOn < getLocalDateString()
  const palette = tone === 'gift'
    ? {
        background: designSystem.colors.warning[50],
        border: designSystem.colors.warning[500],
        text: designSystem.colors.warning[700],
      }
    : {
        background: designSystem.colors.info[50],
        border: designSystem.colors.info[500],
        text: designSystem.colors.info[700],
      }
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: designSystem.borderRadius.lg,
        borderLeft: `4px solid ${balance === 0 ? designSystem.colors.border.main : palette.border}`,
        background: balance === 0 ? designSystem.colors.background.main : palette.background,
      }}
    >
      <div style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
        {label}
      </div>
      <div style={{ marginTop: 4, color: balance < 0 ? designSystem.colors.danger[700] : palette.text, fontWeight: 700 }}>
        {balance} 分
      </div>
      {expiresOn && (
        <div
          style={{
            marginTop: 5,
            color: expired ? designSystem.colors.danger[700] : designSystem.colors.text.secondary,
            fontSize: getFontSize('caption', isMobile),
            fontWeight: expired ? 600 : 400,
          }}
        >
          最近一筆｜{expired ? '已逾使用期限' : '使用期限'} {expiresOn.replaceAll('-', '/')}
        </div>
      )}
    </div>
  )
}

function EntryList({
  entries,
  isMobile,
  onEdit,
}: {
  entries: CoachDesignatedEntry[]
  isMobile: boolean
  onEdit: (entry: CoachDesignatedEntry) => void
}) {
  return (
    <div
      style={{
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.xl,
        overflow: 'hidden',
        background: designSystem.colors.background.card,
      }}
    >
      {entries.length === 0 ? (
        <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>尚無時數紀錄</div>
      ) : entries.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          data-track="coach_designated_entry_open"
          onClick={() => onEdit(entry)}
          style={{
            width: '100%',
            minHeight: isMobile ? 62 : 56,
            padding: '11px 14px',
            border: 0,
            borderBottom: index < entries.length - 1
              ? `1px solid ${designSystem.colors.border.light}`
              : 0,
            background: designSystem.colors.background.card,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <span style={{ display: 'block', color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
              {entry.entry_type === 'credit'
                ? entry.occurred_at.slice(5, 10).replace('-', '/')
                : compactDate(entry.booking_start_at || entry.occurred_at)}
            </span>
            <span>
              {entry.entry_type === 'credit'
                ? (entry.note || '新增指定課')
                : (entry.boat_name || '未指定船')}
            </span>
            <span style={{ display: 'block', marginTop: 3, color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile) }}>
              {entryTypeLabel(entry)}
              {entry.entry_type === 'credit' && entry.expires_on
                ? ` · ${expiryLabel(entry.expires_on)}`
                : ''}
            </span>
          </span>
          <span
            style={{
              flexShrink: 0,
              marginLeft: 12,
              fontWeight: 700,
              color: entry.delta_minutes >= 0
                ? designSystem.colors.success[700]
                : designSystem.colors.danger[700],
            }}
          >
            {entry.delta_minutes >= 0 ? '+' : '−'}{Math.abs(entry.delta_minutes)} 分
          </span>
        </button>
      ))}
    </div>
  )
}

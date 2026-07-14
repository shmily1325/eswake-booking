import { useState, useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import type { Boat, BoatUnavailableDate } from '../../types/booking'
import { Button, useToast, ToastContainer } from '../../components/ui'
import {
  designSystem,
  getFontSize,
  getPageContentShellStyle,
} from '../../styles/designSystem'
import { hasEditorFeatureAsync, isAdmin } from '../../utils/auth'
import { sortBoatsByDisplayOrder } from '../../utils/boatUtils'
import { isFacility, isLandCourse } from '../../utils/facility'
import {
  AdminModal,
  AdminModalHeader,
  adminTextInputStyle,
  DateRangeFields,
  FormFieldLabel,
  HintBox,
  TimeSelectField,
} from '../../components/admin/AdminFormUi'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]
const defaultBoatColor = designSystem.colors.info[500]

export function BoatManagement() {
    const user = useAuthUser()
    const navigate = useNavigate()
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [hasAccess, setHasAccess] = useState(false)
    const [boats, setBoats] = useState<Boat[]>([])
    const [unavailableDates, setUnavailableDates] = useState<BoatUnavailableDate[]>([])
    const [activeTab, setActiveTab] = useState<'boats' | 'pricing'>('boats') // Tab 切換
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [newBoatName, setNewBoatName] = useState('')
    const [newBoatColor, setNewBoatColor] = useState(defaultBoatColor)
    const [addLoading, setAddLoading] = useState(false)
    const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false)
    const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [reason, setReason] = useState('')
    const [unavailableLoading, setUnavailableLoading] = useState(false)
    const [editingUnavailableId, setEditingUnavailableId] = useState<number | null>(null)
    const [unavailableMultiDay, setUnavailableMultiDay] = useState(false)
    const { isMobile } = useResponsive()
    
    // 月份篩選
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const [selectedMonth, setSelectedMonth] = useState(currentMonth)
    
    // 價格設定狀態
    const [editingPrices, setEditingPrices] = useState<{[key: string]: {balance: string, vip: string}}>({})
    const [savingPrices, setSavingPrices] = useState<{[key: string]: boolean}>({})
    const [pricePreviewOpen, setPricePreviewOpen] = useState<Set<number>>(() => new Set())
    
    // 說明展開狀態
    const [showHelp, setShowHelp] = useState(false)

    // 權限檢查
    useEffect(() => {
        const checkAccess = async () => {
            if (!user) return
            
            const canAccess = await hasEditorFeatureAsync(user, 'can_boats')
            if (!canAccess) {
                toast.error('您沒有權限訪問此頁面')
                navigate('/')
                return
            }
            
            setHasAccess(true)
            loadData()
        }
        
        checkAccess()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    const loadData = async () => {
        try {
            const { data: boatsData } = await supabase
                .from('boats')
                .select('*')
                .order('id')

            // 查詢所有維修記錄（包括歷史記錄）
            const { data: unavailableData } = await supabase
                .from('boat_unavailable_dates')
                .select('*')
                .eq('is_active', true)
                .order('start_date', { ascending: false })

            if (boatsData) {
                setBoats(sortBoatsByDisplayOrder(boatsData))
            }
            if (unavailableData) setUnavailableDates(unavailableData)
        } catch (error) {
            console.error('載入失敗:', error)
        } finally {
            setLoading(false)
        }
    }

    const filterUnavailableByMonth = (unavailables: BoatUnavailableDate[], month: string): BoatUnavailableDate[] => {
        const [year, monthNum] = month.split('-').map(Number)
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
        const lastDay = new Date(year, monthNum, 0).getDate()
        const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        return unavailables.filter(unavailable => {
            // 如果維修的開始或結束日期在該月份內，就顯示
            return (unavailable.start_date <= endDate && unavailable.end_date >= startDate)
        })
    }

    const handleAddBoat = async () => {
        if (!newBoatName.trim()) {
            toast.warning('請輸入船隻名稱')
            return
        }

        setAddLoading(true)
        try {
            const { error } = await supabase
                .from('boats')
                .insert([{
                    name: newBoatName.trim(),
                    color: newBoatColor,
                    is_active: true,
                    created_at: getLocalTimestamp()
                }])

            if (error) throw error

            toast.success('船隻新增成功！')
            setNewBoatName('')
            setNewBoatColor(defaultBoatColor)
            setAddDialogOpen(false)
            loadData()
        } catch (error) {
            toast.error('新增船隻失敗：' + (error as Error).message)
        } finally {
            setAddLoading(false)
        }
    }

    const handleToggleStatus = async (boat: Boat) => {
        try {
            const { error } = await supabase
                .from('boats')
                .update({ is_active: !boat.is_active })
                .eq('id', boat.id)

            if (error) throw error

            toast.success(boat.is_active ? '船隻已燒毀' : '船隻已啟用')
            loadData()
        } catch (error) {
            toast.error('更新狀態失敗：' + (error as Error).message)
        }
    }

    const handleAddUnavailable = async () => {
        if (!selectedBoat) return
        if (!startDate || !endDate) {
            toast.warning('請選擇日期')
            return
        }

        if (endDate < startDate) {
            toast.warning('結束日期不能早於開始日期')
            return
        }

        // 如果有填時間，必須兩個都填
        if ((startTime && !endTime) || (!startTime && endTime)) {
            toast.warning('請完整填寫開始與結束時間，或兩者皆留空(代表全天)')
            return
        }

        if (startTime && endTime && startDate === endDate && endTime <= startTime) {
            toast.warning('結束時間必須晚於開始時間')
            return
        }

        setUnavailableLoading(true)
        try {
            if (editingUnavailableId != null) {
                const { error } = await supabase
                    .from('boat_unavailable_dates')
                    .update({
                        boat_id: selectedBoat.id,
                        start_date: startDate,
                        end_date: endDate,
                        start_time: startTime || null,
                        end_time: endTime || null,
                        reason: reason || '維修保養',
                        updated_at: getLocalTimestamp(),
                    })
                    .eq('id', editingUnavailableId)

                if (error) throw error
                toast.success('維修/停用時段已更新')
            } else {
                const { error } = await supabase
                    .from('boat_unavailable_dates')
                    .insert([{
                        boat_id: selectedBoat.id,
                        start_date: startDate,
                        end_date: endDate,
                        start_time: startTime || null,
                        end_time: endTime || null,
                        reason: reason || '維修保養',
                        created_by: user?.id || null,
                        created_at: getLocalTimestamp()
                    }])

                if (error) throw error
                toast.success('維修/停用時段已設定')
            }

            setUnavailableDialogOpen(false)
            setEditingUnavailableId(null)
            setSelectedBoat(null)
            setStartDate('')
            setEndDate('')
            setStartTime('')
            setEndTime('')
            setReason('')
            loadData()
        } catch (error) {
            toast.error(
                editingUnavailableId != null
                    ? '更新維修/停用失敗：' + (error as Error).message
                    : '設定維修/停用失敗：' + (error as Error).message
            )
        } finally {
            setUnavailableLoading(false)
        }
    }

    const handleDeleteUnavailable = async (record: BoatUnavailableDate) => {
        if (!confirm('確定要刪除這個維修/停用記錄嗎？')) return

        try {
            const { error } = await supabase
                .from('boat_unavailable_dates')
                .delete()
                .eq('id', record.id)

            if (error) throw error

            toast.success('記錄已刪除')
            loadData()
        } catch (error) {
            toast.error('刪除記錄失敗：' + (error as Error).message)
        }
    }

    const unavailableTimeToForm = (t: string | null | undefined): string => {
        if (!t) return ''
        const m = t.match(/^(\d{1,2}):(\d{2})/)
        if (!m) return ''
        return `${m[1].padStart(2, '0')}:${m[2]}`
    }

    const openUnavailableDialog = (boat: Boat) => {
        setEditingUnavailableId(null)
        setSelectedBoat(boat)
        setUnavailableMultiDay(false)
        const dateStr = getLocalDateString()
        setStartDate(dateStr)
        setEndDate(dateStr)
        setStartTime('')
        setEndTime('')
        setReason('')
        setUnavailableDialogOpen(true)
    }

    const openEditUnavailableDialog = (boat: Boat, record: BoatUnavailableDate) => {
        setEditingUnavailableId(record.id)
        setSelectedBoat(boat)
        setUnavailableMultiDay(record.start_date !== record.end_date)
        setStartDate(record.start_date)
        setEndDate(record.end_date)
        setStartTime(unavailableTimeToForm(record.start_time))
        setEndTime(unavailableTimeToForm(record.end_time))
        setReason(record.reason || '')
        setUnavailableDialogOpen(true)
    }

    const closeUnavailableDialog = () => {
        setUnavailableDialogOpen(false)
        setEditingUnavailableId(null)
        setSelectedBoat(null)
        setUnavailableMultiDay(false)
        setStartDate('')
        setEndDate('')
        setStartTime('')
        setEndTime('')
        setReason('')
    }

    const isUnavailableSingleDay = startDate === endDate

    const handleUnavailableStartChange = (v: string) => {
        setStartDate(v)
        if (!unavailableMultiDay) setEndDate(v)
        else if (endDate < v) setEndDate(v)
    }

    const handleUnavailableEndChange = (v: string) => {
        setEndDate(v)
    }

    const handleUnavailableMultiDayChange = (v: boolean) => {
        setUnavailableMultiDay(v)
        if (!v && startDate) setEndDate(startDate)
    }

    // 初始化編輯價格
    const initEditingPrice = (boat: Boat) => {
        if (!editingPrices[boat.id]) {
            setEditingPrices(prev => ({
                ...prev,
                [boat.id]: {
                    balance: String(boat.balance_price_per_hour || ''),
                    vip: String(boat.vip_price_per_hour || '')
                }
            }))
        }
    }

    // 更新船隻價格
    const handleUpdatePrice = async (boat: Boat) => {
        const prices = editingPrices[boat.id]
        if (!prices) return

        const balancePrice = prices.balance ? parseInt(prices.balance) : null
        const vipPrice = prices.vip ? parseInt(prices.vip) : null

        // 驗證
        if (balancePrice && balancePrice < 0) {
            toast.warning('價格不能為負數')
            return
        }
        if (vipPrice && vipPrice < 0) {
            toast.warning('價格不能為負數')
            return
        }

        setSavingPrices(prev => ({ ...prev, [boat.id]: true }))
        try {
            const { error } = await supabase
                .from('boats')
                .update({
                    balance_price_per_hour: balancePrice,
                    vip_price_per_hour: vipPrice
                })
                .eq('id', boat.id)

            if (error) throw error

            toast.success('價格更新成功！')
            loadData()
        } catch (error) {
            toast.error('更新價格失敗：' + (error as Error).message)
        } finally {
            setSavingPrices(prev => ({ ...prev, [boat.id]: false }))
        }
    }

    // 計算預覽價格（無條件捨去）
    const calculatePrice = (pricePerHour: number | null, minutes: number): string => {
        if (!pricePerHour) return '-'
        return `$${Math.floor(pricePerHour * minutes / 60).toLocaleString()}`
    }

    if (loading || !hasAccess) {
        return (
            <div style={{
                padding: isMobile ? '12px 16px' : '20px',
                minHeight: '100dvh',
                background: pageBg,
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }}>
                <div style={getPageContentShellStyle(isMobile)}>
                    <PageHeader user={user!} title="船隻" showBaoLink={isAdmin(user)} />
                    <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        fontSize: '15px',
                        color: designSystem.colors.text.secondary,
                    }}>
                        載入中...
                    </div>
                    <Footer />
                </div>
            </div>
        )
    }

    return (
        <div style={{
            padding: isMobile ? '12px 16px' : '20px',
            minHeight: '100dvh',
            background: pageBg,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}>
            <div style={getPageContentShellStyle(isMobile)}>
                <PageHeader user={user!} title="船隻" showBaoLink={isAdmin(user)} />

                {/* Tab + primary action */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '4px',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        background: designSystem.colors.secondary[100],
                        borderRadius: designSystem.borderRadius.lg,
                        padding: '4px',
                        width: 'fit-content',
                        maxWidth: '100%',
                    }}>
                        <button
                            data-track="boat_tab_list"
                            onClick={() => setActiveTab('boats')}
                            style={{
                                padding: isMobile ? '9px 16px' : '10px 20px',
                                background: activeTab === 'boats' ? designSystem.colors.background.card : 'transparent',
                                border: 'none',
                                borderRadius: designSystem.borderRadius.md,
                                boxShadow: activeTab === 'boats' ? designSystem.shadows.xs : 'none',
                                color: activeTab === 'boats' ? designSystem.colors.text.primary : designSystem.colors.text.secondary,
                                fontWeight: activeTab === 'boats' ? 600 : 500,
                                fontSize: getFontSize('bodySmall', isMobile),
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            船隻列表
                        </button>
                        <button
                            data-track="boat_tab_pricing"
                            onClick={() => setActiveTab('pricing')}
                            style={{
                                padding: isMobile ? '9px 16px' : '10px 20px',
                                background: activeTab === 'pricing' ? designSystem.colors.background.card : 'transparent',
                                border: 'none',
                                borderRadius: designSystem.borderRadius.md,
                                boxShadow: activeTab === 'pricing' ? designSystem.shadows.xs : 'none',
                                color: activeTab === 'pricing' ? designSystem.colors.text.primary : designSystem.colors.text.secondary,
                                fontWeight: activeTab === 'pricing' ? 600 : 500,
                                fontSize: getFontSize('bodySmall', isMobile),
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            價格設定
                        </button>
                    </div>
                    <div style={{ flex: 1 }} />
                    {activeTab === 'boats' && (
                        <Button
                            variant="primary"
                            size="medium"
                            data-track="boat_add"
                            onClick={() => setAddDialogOpen(true)}
                        >
                            新增船隻
                        </Button>
                    )}
                </div>

                {/* 船隻列表 Tab */}
                {activeTab === 'boats' && (
                    <>
                        <div
                            style={{
                                marginBottom: designSystem.spacing.md,
                                cursor: 'pointer',
                            }}
                            data-track="boat_help_toggle"
                            onClick={() => setShowHelp(!showHelp)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{
                                    fontWeight: 500,
                                    fontSize: getFontSize('bodySmall', isMobile),
                                    color: designSystem.colors.text.disabled,
                                }}>
                                    {showHelp ? '功能說明' : '說明'}
                                </span>
                                <span style={{
                                    fontSize: getFontSize('caption', isMobile),
                                    color: designSystem.colors.text.disabled,
                                }}>
                                    {showHelp ? '收起' : '展開'}
                                </span>
                            </div>
                            {showHelp && (
                                <div style={{
                                    marginTop: designSystem.spacing.sm,
                                    fontSize: getFontSize('bodySmall', isMobile),
                                    color: designSystem.colors.text.secondary,
                                    lineHeight: 1.7,
                                }}>
                                    <div>維修/停用：設定特定日期或時段船隻不可預約。</div>
                                    <div style={{ marginTop: '4px', color: designSystem.colors.text.disabled }}>
                                        若不指定時間，則視為全天停用。若指定時間（例如 10:00–12:00），則該時段外仍可預約。
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{
                            marginBottom: designSystem.spacing.md,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flexWrap: 'wrap',
                        }}>
                            <span style={{
                                fontSize: getFontSize('bodySmall', isMobile),
                                color: designSystem.colors.text.secondary,
                            }}>
                                維修月份
                            </span>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    maxWidth: isMobile ? '100%' : '180px',
                                    padding: '10px 12px',
                                    border: cardBorder,
                                    borderRadius: designSystem.borderRadius.lg,
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    background: designSystem.colors.background.card,
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{
                            background: designSystem.colors.background.card,
                            borderRadius: designSystem.borderRadius.lg,
                            border: cardBorder,
                            boxShadow: cardShadow,
                            overflow: 'hidden',
                        }}>
                            {boats.length === 0 ? (
                                <div style={{
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    fontSize: getFontSize('body', isMobile),
                                    color: designSystem.colors.text.disabled,
                                }}>
                                    尚無船隻
                                </div>
                            ) : boats.map((boat, index) => {
                                const boatAllUnavailable = unavailableDates.filter(d => d.boat_id === boat.id)
                                const boatUnavailable = filterUnavailableByMonth(boatAllUnavailable, selectedMonth)
                                const isActive = boat.is_active
                                const showMaintenance = !isLandCourse(boat.name)
                                const isLast = index === boats.length - 1

                                return (
                                    <div
                                        key={boat.id}
                                        style={{
                                            padding: isMobile ? '16px' : '18px 20px',
                                            borderBottom: isLast ? 'none' : `1px solid ${designSystem.colors.border.light}`,
                                            opacity: isActive ? 1 : 0.72,
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: isMobile ? 'stretch' : 'center',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            gap: '12px',
                                        }}>
                                            <div style={{
                                                minWidth: 0,
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                            }}>
                                                <span
                                                    aria-hidden
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: boat.color || defaultBoatColor,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: getFontSize('h3', isMobile),
                                                        fontWeight: 600,
                                                        color: designSystem.colors.text.primary,
                                                        lineHeight: 1.3,
                                                    }}>
                                                        {boat.name}
                                                    </div>
                                                    {!isActive && (
                                                        <div style={{
                                                            marginTop: '4px',
                                                            fontSize: getFontSize('caption', isMobile),
                                                            color: designSystem.colors.text.disabled,
                                                        }}>
                                                            已燒毀
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                gap: '8px',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                flexShrink: 0,
                                            }}>
                                                {showMaintenance && (
                                                    <Button
                                                        variant="outline"
                                                        size="small"
                                                        data-track="boat_unavailable_dialog"
                                                        onClick={() => openUnavailableDialog(boat)}
                                                    >
                                                        設定維修
                                                    </Button>
                                                )}
                                                <Button
                                                    variant={isActive ? 'ghost' : 'primary'}
                                                    size="small"
                                                    data-track="boat_toggle_status"
                                                    onClick={() => handleToggleStatus(boat)}
                                                    style={isActive ? {
                                                        color: designSystem.colors.danger[700],
                                                    } : undefined}
                                                >
                                                    {isActive ? '燒毀' : '啟用'}
                                                </Button>
                                            </div>
                                        </div>

                                        {showMaintenance && boatUnavailable.length > 0 && (
                                            <div style={{
                                                marginTop: designSystem.spacing.md,
                                                paddingTop: designSystem.spacing.sm,
                                                borderTop: `1px solid ${designSystem.colors.border.light}`,
                                            }}>
                                                {boatUnavailable.map((record, idx) => (
                                                    <div
                                                        key={record.id}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: isMobile ? 'flex-start' : 'center',
                                                            flexDirection: isMobile ? 'column' : 'row',
                                                            padding: '10px 0',
                                                            gap: isMobile ? '8px' : '12px',
                                                            borderBottom:
                                                                idx === boatUnavailable.length - 1
                                                                    ? 'none'
                                                                    : `1px solid ${designSystem.colors.border.light}`,
                                                        }}
                                                    >
                                                        <div style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                            lineHeight: 1.45,
                                                        }}>
                                                            <span style={{
                                                                fontSize: getFontSize('body', isMobile),
                                                                fontWeight: 500,
                                                                color: designSystem.colors.text.primary,
                                                            }}>
                                                                {record.start_date === record.end_date ? (
                                                                    <>
                                                                        {record.start_date}
                                                                        {record.start_time && record.end_time && (
                                                                            <> {record.start_time}-{record.end_time}</>
                                                                        )}
                                                                    </>
                                                                ) : record.start_time ? (
                                                                    <>
                                                                        {record.start_date} {record.start_time}
                                                                        <span style={{ margin: '0 4px', fontWeight: 400, color: designSystem.colors.text.disabled }}>~</span>
                                                                        {record.end_date} {record.end_time}
                                                                    </>
                                                                ) : (
                                                                    `${record.start_date} ~ ${record.end_date}`
                                                                )}
                                                            </span>
                                                            {record.reason && (
                                                                <span style={{
                                                                    marginLeft: '8px',
                                                                    fontSize: getFontSize('bodySmall', isMobile),
                                                                    color: designSystem.colors.text.disabled,
                                                                }}>
                                                                    {record.reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{
                                                            display: 'flex',
                                                            gap: '8px',
                                                            flexShrink: 0,
                                                        }}>
                                                            <Button
                                                                variant="outline"
                                                                size="small"
                                                                data-track="boat_edit_unavailable"
                                                                onClick={() => openEditUnavailableDialog(boat, record)}
                                                            >
                                                                編輯
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="small"
                                                                data-track="boat_delete_unavailable"
                                                                onClick={() => handleDeleteUnavailable(record)}
                                                                style={{ color: designSystem.colors.danger[700] }}
                                                            >
                                                                刪除
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* 價格設定 Tab */}
                {activeTab === 'pricing' && (
                    <>
                        <div style={{
                            marginBottom: designSystem.spacing.lg,
                            fontSize: getFontSize('bodySmall', isMobile),
                            color: designSystem.colors.text.secondary,
                            lineHeight: 1.6,
                        }}>
                            <div style={{ marginBottom: '4px' }}>
                                實際金額 = 每小時價格 × 分鐘數 ÷ 60（無條件捨去）
                            </div>
                            <div style={{ color: designSystem.colors.text.disabled }}>
                                例如：$10800/小時 × 30 分 ÷ 60 = $5400。儲值與 VIP 票券各自獨立。
                            </div>
                        </div>

                        <div style={{
                            background: designSystem.colors.background.card,
                            borderRadius: designSystem.borderRadius.lg,
                            border: cardBorder,
                            boxShadow: cardShadow,
                            overflow: 'hidden',
                        }}>
                            {boats.length === 0 ? (
                                <div style={{
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    fontSize: getFontSize('body', isMobile),
                                    color: designSystem.colors.text.disabled,
                                }}>
                                    尚無船隻
                                </div>
                            ) : boats.map((boat, index) => {
                                initEditingPrice(boat)
                                const editing = editingPrices[boat.id] || { balance: '', vip: '' }
                                const saving = savingPrices[boat.id] || false
                                const balancePrice = editing.balance ? parseInt(editing.balance) : null
                                const vipPrice = editing.vip ? parseInt(editing.vip) : null
                                const isLast = index === boats.length - 1
                                const facility = isFacility(boat.name)
                                const previewOpen = pricePreviewOpen.has(boat.id)

                                const priceInputStyle: CSSProperties = {
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: designSystem.borderRadius.lg,
                                    border: cardBorder,
                                    fontSize: '16px',
                                    outline: 'none',
                                    background: designSystem.colors.background.card,
                                    boxSizing: 'border-box',
                                }

                                return (
                                    <div
                                        key={boat.id}
                                        style={{
                                            padding: isMobile ? '16px' : '18px 20px',
                                            borderBottom: isLast ? 'none' : `1px solid ${designSystem.colors.border.light}`,
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            marginBottom: designSystem.spacing.md,
                                        }}>
                                            <span
                                                aria-hidden
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    background: boat.color || defaultBoatColor,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <div style={{
                                                fontSize: getFontSize('h3', isMobile),
                                                fontWeight: 600,
                                                color: designSystem.colors.text.primary,
                                                lineHeight: 1.3,
                                            }}>
                                                {boat.name}
                                            </div>
                                            {facility && (
                                                <span style={{
                                                    fontSize: getFontSize('caption', isMobile),
                                                    color: designSystem.colors.text.disabled,
                                                }}>
                                                    不收船費
                                                </span>
                                            )}
                                        </div>

                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                            gap: '12px',
                                            marginBottom: designSystem.spacing.md,
                                        }}>
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    marginBottom: '6px',
                                                    fontSize: getFontSize('bodySmall', isMobile),
                                                    fontWeight: 500,
                                                    color: designSystem.colors.text.secondary,
                                                }}>
                                                    儲值（每小時）
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        fontSize: getFontSize('body', isMobile),
                                                        color: designSystem.colors.text.disabled,
                                                    }}>$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={editing.balance}
                                                        onChange={(e) => {
                                                            const numValue = e.target.value.replace(/\D/g, '')
                                                            setEditingPrices(prev => ({
                                                                ...prev,
                                                                [boat.id]: { ...editing, balance: numValue },
                                                            }))
                                                        }}
                                                        placeholder="未設定"
                                                        style={priceInputStyle}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    marginBottom: '6px',
                                                    fontSize: getFontSize('bodySmall', isMobile),
                                                    fontWeight: 500,
                                                    color: designSystem.colors.text.secondary,
                                                }}>
                                                    VIP 票券（每小時）
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        fontSize: getFontSize('body', isMobile),
                                                        color: designSystem.colors.text.disabled,
                                                    }}>$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={editing.vip}
                                                        onChange={(e) => {
                                                            const numValue = e.target.value.replace(/\D/g, '')
                                                            setEditingPrices(prev => ({
                                                                ...prev,
                                                                [boat.id]: { ...editing, vip: numValue },
                                                            }))
                                                        }}
                                                        placeholder="未設定"
                                                        style={priceInputStyle}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            flexWrap: 'wrap',
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPricePreviewOpen(prev => {
                                                        const next = new Set(prev)
                                                        if (next.has(boat.id)) next.delete(boat.id)
                                                        else next.add(boat.id)
                                                        return next
                                                    })
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    fontSize: getFontSize('bodySmall', isMobile),
                                                    color: designSystem.colors.text.disabled,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {previewOpen ? '收起預覽' : '價格預覽'}
                                            </button>
                                            <div style={{ flex: 1 }} />
                                            <Button
                                                variant="primary"
                                                size="small"
                                                data-track="boat_save_price"
                                                onClick={() => handleUpdatePrice(boat)}
                                                disabled={saving}
                                            >
                                                {saving ? '儲存中...' : '儲存'}
                                            </Button>
                                        </div>

                                        {previewOpen && (
                                            <div style={{
                                                marginTop: designSystem.spacing.md,
                                                paddingTop: designSystem.spacing.sm,
                                                borderTop: `1px solid ${designSystem.colors.border.light}`,
                                                display: 'grid',
                                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                                gap: '12px',
                                                fontSize: getFontSize('bodySmall', isMobile),
                                                color: designSystem.colors.text.secondary,
                                            }}>
                                                <div>
                                                    <div style={{
                                                        marginBottom: '4px',
                                                        color: designSystem.colors.text.disabled,
                                                    }}>
                                                        儲值
                                                    </div>
                                                    <div>20分 {calculatePrice(balancePrice, 20)}</div>
                                                    <div>30分 {calculatePrice(balancePrice, 30)}</div>
                                                    <div>40分 {calculatePrice(balancePrice, 40)}</div>
                                                    <div>60分 {calculatePrice(balancePrice, 60)}</div>
                                                    <div>90分 {calculatePrice(balancePrice, 90)}</div>
                                                </div>
                                                <div>
                                                    <div style={{
                                                        marginBottom: '4px',
                                                        color: designSystem.colors.text.disabled,
                                                    }}>
                                                        VIP 票券
                                                    </div>
                                                    <div>20分 {calculatePrice(vipPrice, 20)}</div>
                                                    <div>30分 {calculatePrice(vipPrice, 30)}</div>
                                                    <div>40分 {calculatePrice(vipPrice, 40)}</div>
                                                    <div>60分 {calculatePrice(vipPrice, 60)}</div>
                                                    <div>90分 {calculatePrice(vipPrice, 90)}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                <Footer />
            </div>

            {/* 新增船隻彈窗 */}
            {addDialogOpen && (
                <AdminModal
                    isMobile={isMobile}
                    maxWidth={400}
                    onClose={() => { if (!addLoading) setAddDialogOpen(false) }}
                >
                    <AdminModalHeader title="新增船隻" accent="blue" />
                    <div style={{ marginBottom: '16px' }}>
                        <FormFieldLabel>船隻名稱</FormFieldLabel>
                        <input
                            type="text"
                            value={newBoatName}
                            onChange={(e) => setNewBoatName(e.target.value)}
                            placeholder="例如：G23"
                            style={adminTextInputStyle}
                        />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <FormFieldLabel>代表色</FormFieldLabel>
                        <input
                            type="color"
                            value={newBoatColor}
                            onChange={(e) => setNewBoatColor(e.target.value)}
                            style={{
                                width: '100%',
                                height: '44px',
                                padding: '4px',
                                border: cardBorder,
                                borderRadius: designSystem.borderRadius.lg,
                                background: designSystem.colors.secondary[50],
                                cursor: 'pointer',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)} style={{ flex: 1 }}>取消</Button>
                        <Button variant="primary" data-track="boat_add_confirm" onClick={handleAddBoat} disabled={addLoading} style={{ flex: 1 }}>
                            {addLoading ? '新增中…' : '確定'}
                        </Button>
                    </div>
                </AdminModal>
            )}

            {/* 設定維修彈窗 */}
            {unavailableDialogOpen && (
                <AdminModal
                    isMobile={isMobile}
                    maxWidth={420}
                    onClose={() => { if (!unavailableLoading) closeUnavailableDialog() }}
                >
                    <AdminModalHeader
                        title={editingUnavailableId != null ? '編輯維修/停用' : '新增維修/停用'}
                        subtitle={selectedBoat?.name}
                        accent="orange"
                    />

                    <DateRangeFields
                        startDate={startDate}
                        endDate={endDate}
                        onStartChange={handleUnavailableStartChange}
                        onEndChange={handleUnavailableEndChange}
                        multiDay={unavailableMultiDay}
                        onMultiDayChange={handleUnavailableMultiDayChange}
                        trackPrefix="boat_unavailable"
                    />

                    <div style={{ marginBottom: '16px' }}>
                        <FormFieldLabel>時段（留空＝整天停用）</FormFieldLabel>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <TimeSelectField
                                value={startTime}
                                onChange={setStartTime}
                                label={isUnavailableSingleDay ? '開始時間' : '第一天時間'}
                            />
                            <TimeSelectField
                                value={endTime}
                                onChange={setEndTime}
                                label={isUnavailableSingleDay ? '結束時間' : '最後一天時間'}
                            />
                        </div>
                        <HintBox>
                            {isUnavailableSingleDay ? (
                                <>單日：時間留空表示全天停用；例如 13:30–15:00 表示當天該時段不可用。</>
                            ) : (
                                <>跨日：時間留空表示這幾天全天停用；中間日期亦視為全天。</>
                            )}
                        </HintBox>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <FormFieldLabel optional>原因</FormFieldLabel>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="例如：引擎保養"
                            style={adminTextInputStyle}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button variant="outline" onClick={closeUnavailableDialog} style={{ flex: 1 }}>取消</Button>
                        <Button
                            variant="warning"
                            data-track="boat_unavailable_confirm"
                            onClick={handleAddUnavailable}
                            disabled={unavailableLoading}
                            style={{ flex: 1 }}
                        >
                            {unavailableLoading
                                ? (editingUnavailableId != null ? '儲存中…' : '新增中…')
                                : (editingUnavailableId != null ? '儲存' : '新增')}
                        </Button>
                    </div>
                </AdminModal>
            )}
            
            <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
        </div>
    )
}

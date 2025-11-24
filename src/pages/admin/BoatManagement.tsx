import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import type { Boat, BoatUnavailableDate } from '../../types/booking'
import { Button, Badge, useToast, ToastContainer } from '../../components/ui'
import { designSystem } from '../../styles/designSystem'

export function BoatManagement() {
    const user = useAuthUser()
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [boats, setBoats] = useState<Boat[]>([])
    const [unavailableDates, setUnavailableDates] = useState<BoatUnavailableDate[]>([])
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [newBoatName, setNewBoatName] = useState('')
    const [newBoatColor, setNewBoatColor] = useState('#1976d2')
    const [addLoading, setAddLoading] = useState(false)
    const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false)
    const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [reason, setReason] = useState('')
    const [unavailableLoading, setUnavailableLoading] = useState(false)
    const { isMobile } = useResponsive()

    useEffect(() => {
        if (user) loadData()
    }, [user])

    const loadData = async () => {
        try {
            const { data: boatsData } = await supabase
                .from('boats')
                .select('*')
                .order('created_at')

            const { data: unavailableData } = await supabase
                .from('boat_unavailable_dates')
                .select('*')
                .eq('is_active', true)
                .gte('end_date', getLocalDateString())

            if (boatsData) setBoats(boatsData)
            if (unavailableData) setUnavailableDates(unavailableData)
        } catch (error) {
            console.error('載入失敗:', error)
        } finally {
            setLoading(false)
        }
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
            setNewBoatColor('#1976d2')
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

            toast.success(boat.is_active ? '船隻已停用' : '船隻已啟用')
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

            setUnavailableDialogOpen(false)
            setSelectedBoat(null)
            setStartDate('')
            setEndDate('')
            setStartTime('')
            setEndTime('')
            setReason('')
            toast.success('維修/停用時段已設定')
            loadData()
        } catch (error) {
            toast.error('設定維修/停用失敗：' + (error as Error).message)
        } finally {
            setUnavailableLoading(false)
        }
    }

    const handleDeleteUnavailable = async (record: BoatUnavailableDate) => {
        if (!confirm('確定要刪除這個維修/停用記錄嗎？')) return

        try {
            const { error } = await supabase
                .from('boat_unavailable_dates')
                .update({ is_active: false }) // 軟刪除
                .eq('id', record.id)

            if (error) throw error

            toast.success('記錄已刪除')
            loadData()
        } catch (error) {
            toast.error('刪除記錄失敗：' + (error as Error).message)
        }
    }

    const openUnavailableDialog = (boat: Boat) => {
        setSelectedBoat(boat)
        const dateStr = getLocalDateString()
        setStartDate(dateStr)
        setEndDate(dateStr)
        setStartTime('')
        setEndTime('')
        setReason('')
        setUnavailableDialogOpen(true)
    }

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                載入中...
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
            <PageHeader user={user!} title="船隻管理" />

            <div style={{
                maxWidth: '1000px',
                margin: '0 auto',
                padding: isMobile ? '20px 16px' : '40px 20px'
            }}>
                {/* 標題與操作按鈕 */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: '16px',
                    marginBottom: '30px'
                }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: isMobile ? '24px' : '32px',
                        color: '#333',
                        fontWeight: 'bold'
                    }}>
                        🚤 船隻管理
                    </h1>

                    <Button
                        variant="outline"
                        size="medium"
                        onClick={() => setAddDialogOpen(true)}
                        icon={<span>➕</span>}
                    >
                        新增船隻
                    </Button>
                </div>

                {/* 說明提示 */}
                <div style={{
                    background: '#e3f2fd',
                    padding: isMobile ? '12px 16px' : '14px 20px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    color: '#0d47a1',
                    border: '1px solid #bbdefb',
                    lineHeight: '1.6'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ flexShrink: 0 }}>💡</span>
                        <div>
                            <div style={{ marginBottom: '4px' }}>
                                <strong>維修/停用</strong>：設定特定日期或時段船隻不可預約。
                            </div>
                            <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                若不指定時間，則視為<strong>全天停用</strong>。若指定時間（例如 10:00-12:00），則該時段外仍可預約。
                            </div>
                        </div>
                    </div>
                </div>

                {/* 船隻列表 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                    gap: '15px'
                }}>
                    {boats.map(boat => {
                        const boatUnavailable = unavailableDates.filter(d => d.boat_id === boat.id)
                        const isActive = boat.is_active

                        return (
                            <div
                                key={boat.id}
                                style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: isMobile ? '16px' : '20px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    borderTop: `4px solid ${boat.color}`,
                                    opacity: isActive ? 1 : 0.8,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* 船隻名稱 + 狀態 */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '16px',
                                    gap: '12px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{
                                            margin: 0,
                                            fontSize: isMobile ? '20px' : '22px',
                                            fontWeight: 'bold',
                                            color: '#333',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            {boat.name}
                                            {!isActive && (
                                                <Badge variant="danger" size="small">
                                                    已停用
                                                </Badge>
                                            )}
                                        </h3>
                                    </div>

                                    {/* 操作按鈕 */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Button
                                            variant={isActive ? 'danger' : 'success'}
                                            size="small"
                                            onClick={() => handleToggleStatus(boat)}
                                            style={isActive ? { background: '#fff', color: designSystem.colors.danger[500], border: `1px solid ${designSystem.colors.danger[500]}` } : {}}
                                        >
                                            {isActive ? '停用' : '啟用'}
                                        </Button>
                                    </div>
                                </div>

                                {/* 維修/停用記錄 */}
                                {boatUnavailable.length > 0 && (
                                    <div style={{
                                        marginBottom: '14px',
                                        padding: isMobile ? '12px' : '14px',
                                        background: '#fff3e0',
                                        borderRadius: '10px',
                                        border: '1px solid #ffe0b2'
                                    }}>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            marginBottom: '10px',
                                            color: '#e65100'
                                        }}>
                                            維修/停用排程
                                        </div>
                                        {boatUnavailable.map(record => (
                                            <div
                                                key={record.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: isMobile ? 'flex-start' : 'center',
                                                    flexDirection: isMobile ? 'column' : 'row',
                                                    padding: '8px 0',
                                                    fontSize: '13px',
                                                    gap: isMobile ? '8px' : '12px',
                                                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                <span style={{
                                                    flex: 1,
                                                    color: '#555',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {record.start_date === record.end_date ? record.start_date : `${record.start_date} ~ ${record.end_date}`}
                                                    {record.start_time && record.end_time && (
                                                        <span style={{ fontWeight: 'bold', marginLeft: '6px', color: '#d84315' }}>
                                                            {record.start_time}-{record.end_time}
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        marginLeft: '8px',
                                                        padding: '2px 8px',
                                                        background: '#fff',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        color: '#666'
                                                    }}>
                                                        {record.reason}
                                                    </span>
                                                </span>
                                                <Button
                                                    variant="danger"
                                                    size="small"
                                                    onClick={() => handleDeleteUnavailable(record)}
                                                    style={{ alignSelf: isMobile ? 'flex-start' : 'center' }}
                                                >
                                                    刪除
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 設定維修按鈕 */}
                                <Button
                                    variant="outline"
                                    size="medium"
                                    onClick={() => openUnavailableDialog(boat)}
                                    fullWidth
                                    style={{
                                        background: '#f3e5f5',
                                        color: '#7b1fa2',
                                        border: '2px solid #e1bee7',
                                    }}
                                >
                                    設定維修/停用
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 新增船隻彈窗 */}
            {addDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '12px', padding: '30px',
                        maxWidth: '400px', width: '100%'
                    }}>
                        <h2 style={{ marginTop: 0 }}>新增船隻</h2>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>船隻名稱</label>
                            <input
                                type="text"
                                value={newBoatName}
                                onChange={(e) => setNewBoatName(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>代表色</label>
                            <input
                                type="color"
                                value={newBoatColor}
                                onChange={(e) => setNewBoatColor(e.target.value)}
                                style={{ width: '100%', height: '40px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <Button variant="outline" onClick={() => setAddDialogOpen(false)} style={{ flex: 1 }}>取消</Button>
                            <Button variant="primary" onClick={handleAddBoat} disabled={addLoading} style={{ flex: 1 }}>確定</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 設定維修彈窗 */}
            {unavailableDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '12px', padding: '30px',
                        maxWidth: '400px', width: '100%'
                    }}>
                        <h2 style={{ marginTop: 0 }}>設定維修/停用</h2>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>開始日期</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>結束日期</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>開始時間 (選填)</label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <select
                                        value={startTime ? startTime.split(':')[0] : ''}
                                        onChange={(e) => {
                                            const hour = e.target.value
                                            if (!hour) {
                                                setStartTime('')
                                            } else {
                                                const minute = startTime ? startTime.split(':')[1] : '00'
                                                setStartTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        {Array.from({ length: 24 }, (_, i) => {
                                            const hour = String(i).padStart(2, '0')
                                            return <option key={hour} value={hour}>{hour}</option>
                                        })}
                                    </select>
                                    <select
                                        value={startTime ? startTime.split(':')[1] : ''}
                                        onChange={(e) => {
                                            const minute = e.target.value
                                            if (!minute) {
                                                setStartTime('')
                                            } else {
                                                const hour = startTime ? startTime.split(':')[0] : '08'
                                                setStartTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        <option value="00">00</option>
                                        <option value="15">15</option>
                                        <option value="30">30</option>
                                        <option value="45">45</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>結束時間 (選填)</label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <select
                                        value={endTime ? endTime.split(':')[0] : ''}
                                        onChange={(e) => {
                                            const hour = e.target.value
                                            if (!hour) {
                                                setEndTime('')
                                            } else {
                                                const minute = endTime ? endTime.split(':')[1] : '00'
                                                setEndTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        {Array.from({ length: 24 }, (_, i) => {
                                            const hour = String(i).padStart(2, '0')
                                            return <option key={hour} value={hour}>{hour}</option>
                                        })}
                                    </select>
                                    <select
                                        value={endTime ? endTime.split(':')[1] : ''}
                                        onChange={(e) => {
                                            const minute = e.target.value
                                            if (!minute) {
                                                setEndTime('')
                                            } else {
                                                const hour = endTime ? endTime.split(':')[0] : '08'
                                                setEndTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        <option value="00">00</option>
                                        <option value="15">15</option>
                                        <option value="30">30</option>
                                        <option value="45">45</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                            * 時間留空表示全天停用
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>原因</label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="例如：引擎保養"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <Button variant="outline" onClick={() => setUnavailableDialogOpen(false)} style={{ flex: 1 }}>取消</Button>
                            <Button variant="warning" onClick={handleAddUnavailable} disabled={unavailableLoading} style={{ flex: 1, background: '#e65100' }}>確定</Button>
                        </div>
                    </div>
                </div>
            )}
            
            <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
        </div>
    )
}

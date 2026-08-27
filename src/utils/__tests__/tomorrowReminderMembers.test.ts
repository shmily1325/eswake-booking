import { describe, it, expect } from 'vitest'
import { resolveContactNamesWithMembers } from '../tomorrowReminderMembers'

describe('resolveContactNamesWithMembers', () => {
  it('沒有會員資料時保留原始 contact_name', () => {
    const result = resolveContactNamesWithMembers('路人甲, 路人乙', [])
    expect(result.contactName).toBe('路人甲, 路人乙')
    expect(result.memberIdByDisplayName.size).toBe(0)
  })

  it('純會員預約：全部換成最新暱稱並記錄 member id', () => {
    const result = resolveContactNamesWithMembers('舊名A, 舊名B', [
      { id: 'm1', name: 'A本名', nickname: 'Dexter' },
      { id: 'm2', name: 'B本名', nickname: null },
    ])
    expect(result.contactName).toBe('Dexter, B本名')
    expect(result.memberIdByDisplayName.get('Dexter')).toBe('m1')
    expect(result.memberIdByDisplayName.get('B本名')).toBe('m2')
  })

  it('混合預約：會員換暱稱、訪客保留原名且不列入 member 對應', () => {
    const result = resolveContactNamesWithMembers('Fish, 路人甲', [
      { id: 'm1', name: 'Fish', nickname: 'Fishy' },
    ])
    expect(result.contactName).toBe('Fishy, 路人甲')
    expect(result.memberIdByDisplayName.get('Fishy')).toBe('m1')
    expect(result.memberIdByDisplayName.has('路人甲')).toBe(false)
  })

  it('複合名稱以 / 拆開比對會員', () => {
    const result = resolveContactNamesWithMembers('Ingrid/Joanna, 路人甲', [
      { id: 'm1', name: 'Ingrid', nickname: null },
    ])
    expect(result.contactName).toBe('Ingrid, 路人甲')
    expect(result.memberIdByDisplayName.get('Ingrid')).toBe('m1')
  })

  it('未被比對到的會員仍會補進名單', () => {
    const result = resolveContactNamesWithMembers('路人甲, 路人乙, 路人丙', [
      { id: 'm1', name: 'Dexter', nickname: null },
    ])
    expect(result.contactName).toBe('路人甲, 路人乙, 路人丙, Dexter')
    expect(result.memberIdByDisplayName.get('Dexter')).toBe('m1')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminCoachReportWorkspace } from '../AdminCoachReportWorkspace'

vi.mock('../../../contexts/AuthContext', () => ({
  useAuthUser: () => ({
    id: 'admin-id',
    email: 'minlin1325@gmail.com',
  }),
}))

vi.mock('../CoachReport', () => ({
  CoachReport: () => <div>管理員回報內容</div>,
}))

vi.mock('../designatedHours/AdminCoachDesignatedHours', () => ({
  AdminCoachDesignatedHours: () => <div>管理員指定課總覽</div>,
}))

vi.mock('../../../components/PageHeader', () => ({
  PageHeader: () => <div>回報頁首</div>,
}))

vi.mock('../../../components/Footer', () => ({
  Footer: () => <div>頁尾</div>,
}))

describe('AdminCoachReportWorkspace', () => {
  it('lets the admin open the designated overview from the BAO report route', () => {
    render(<AdminCoachReportWorkspace />)

    expect(screen.getByText('管理員回報內容')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '指定課' }))
    expect(screen.getByText('管理員指定課總覽')).toBeInTheDocument()
    expect(screen.queryByText('管理員回報內容')).not.toBeInTheDocument()
  })
})

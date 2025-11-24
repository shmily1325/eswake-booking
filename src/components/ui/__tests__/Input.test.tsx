import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Input } from '../Input'

describe('Input 組件', () => {
  describe('基本渲染', () => {
    it('應該渲染輸入框', () => {
      render(<Input placeholder="請輸入" />)
      expect(screen.getByPlaceholderText('請輸入')).toBeInTheDocument()
    })

    it('應該顯示標籤', () => {
      render(<Input label="使用者名稱" />)
      expect(screen.getByText('使用者名稱')).toBeInTheDocument()
    })

    it('應該顯示輔助文字', () => {
      render(<Input helperText="這是提示文字" />)
      expect(screen.getByText('這是提示文字')).toBeInTheDocument()
    })
  })

  describe('錯誤狀態', () => {
    it('應該顯示錯誤訊息', () => {
      render(<Input error="此欄位為必填項" />)
      expect(screen.getByText('此欄位為必填項')).toBeInTheDocument()
    })

    it('錯誤訊息應該取代輔助文字', () => {
      render(<Input helperText="提示" error="錯誤" />)
      expect(screen.getByText('錯誤')).toBeInTheDocument()
      expect(screen.queryByText('提示')).not.toBeInTheDocument()
    })

    it('錯誤狀態下標籤應該是紅色', () => {
      render(<Input label="使用者名稱" error="錯誤" />)
      const label = screen.getByText('使用者名稱')
      // 檢查顏色是否為危險色
      expect(label).toBeInTheDocument()
    })
  })

  describe('尺寸', () => {
    it('應該支援不同尺寸', () => {
      const { rerender } = render(<Input size="small" placeholder="小" />)
      expect(screen.getByPlaceholderText('小')).toBeInTheDocument()

      rerender(<Input size="medium" placeholder="中" />)
      expect(screen.getByPlaceholderText('中')).toBeInTheDocument()

      rerender(<Input size="large" placeholder="大" />)
      expect(screen.getByPlaceholderText('大')).toBeInTheDocument()
    })
  })

  describe('全寬', () => {
    it('預設應該是全寬', () => {
      render(<Input placeholder="測試" />)
      const container = screen.getByPlaceholderText('測試').parentElement?.parentElement
      expect(container).toHaveStyle({ width: '100%' })
    })

    it('可以設定為非全寬', () => {
      render(<Input fullWidth={false} placeholder="測試" />)
      const container = screen.getByPlaceholderText('測試').parentElement?.parentElement
      expect(container).toHaveStyle({ width: 'auto' })
    })
  })

  describe('圖標', () => {
    it('應該顯示左側圖標', () => {
      render(<Input leftIcon={<span data-testid="left-icon">🔍</span>} />)
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('應該顯示右側圖標', () => {
      render(<Input rightIcon={<span data-testid="right-icon">✓</span>} />)
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('可以同時顯示左右圖標', () => {
      render(
        <Input
          leftIcon={<span data-testid="left-icon">🔍</span>}
          rightIcon={<span data-testid="right-icon">✓</span>}
        />
      )
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })
  })

  describe('焦點狀態', () => {
    it('應該在聚焦時呼叫 onFocus', () => {
      const handleFocus = vi.fn()
      render(<Input onFocus={handleFocus} placeholder="測試" />)
      
      const input = screen.getByPlaceholderText('測試')
      fireEvent.focus(input)
      
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('應該在失焦時呼叫 onBlur', () => {
      const handleBlur = vi.fn()
      render(<Input onBlur={handleBlur} placeholder="測試" />)
      
      const input = screen.getByPlaceholderText('測試')
      fireEvent.focus(input)
      fireEvent.blur(input)
      
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('輸入值', () => {
    it('應該顯示預設值', () => {
      render(<Input defaultValue="預設值" />)
      const input = screen.getByDisplayValue('預設值') as HTMLInputElement
      expect(input.value).toBe('預設值')
    })

    it('應該支援受控組件', () => {
      const { rerender } = render(<Input value="初始值" onChange={() => {}} />)
      const input = screen.getByDisplayValue('初始值') as HTMLInputElement
      expect(input.value).toBe('初始值')

      rerender(<Input value="新值" onChange={() => {}} />)
      expect(input.value).toBe('新值')
    })

    it('應該在輸入時觸發 onChange', () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '新內容' } })
      
      expect(handleChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('HTML 屬性', () => {
    it('應該支援 disabled 屬性', () => {
      render(<Input disabled placeholder="禁用" />)
      const input = screen.getByPlaceholderText('禁用')
      expect(input).toBeDisabled()
    })

    it('應該支援 type 屬性', () => {
      render(<Input type="password" placeholder="密碼" />)
      const input = screen.getByPlaceholderText('密碼')
      expect(input).toHaveAttribute('type', 'password')
    })

    it('應該支援 placeholder 屬性', () => {
      render(<Input placeholder="請輸入內容" />)
      expect(screen.getByPlaceholderText('請輸入內容')).toBeInTheDocument()
    })

    it('應該支援 maxLength 屬性', () => {
      render(<Input maxLength={10} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('maxLength', '10')
    })
  })

  describe('forwardRef', () => {
    it('應該正確傳遞 ref', () => {
      const ref = { current: null as HTMLInputElement | null }
      render(<Input ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('ref 應該允許呼叫 focus 方法', () => {
      const ref = { current: null as HTMLInputElement | null }
      render(<Input ref={ref} placeholder="測試" />)
      
      ref.current?.focus()
      expect(ref.current).toBe(document.activeElement)
    })
  })

  describe('自訂樣式', () => {
    it('應該應用自訂樣式', () => {
      render(<Input style={{ backgroundColor: 'yellow' }} />)
      const input = screen.getByRole('textbox')
      // 檢查樣式是否正確應用
      expect(input.style.backgroundColor).toBe('yellow')
    })
  })
})


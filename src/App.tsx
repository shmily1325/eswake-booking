import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [supabaseVersion, setSupabaseVersion] = useState<string>('')

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      // Test connection by querying a test table
      const { error } = await supabase
        .from('_supabase_test_connection')
        .select('*')
        .limit(1)
      
      if (error) {
        // If query fails but we can reach the API, it's still a successful connection
        // 404 error means table doesn't exist, but connection is working
        if (error.message.includes('does not exist') || 
            error.message.includes('Could not find') ||
            error.code === 'PGRST116' ||
            error.code === '42P01') {
          setConnectionStatus('connected')
          setSupabaseVersion('Connected (no test table)')
        } else {
          throw error
        }
      } else {
        setConnectionStatus('connected')
        setSupabaseVersion('Connected successfully!')
      }
    } catch (error: any) {
      setConnectionStatus('error')
      setErrorMessage(error.message || 'Connection failed')
    }
  }

  return (
    <div className="App">
      <h1>Supabase 連接測試</h1>
      
      <div className="card">
        <h2>連接狀態</h2>
        <div style={{ 
          padding: '20px', 
          borderRadius: '8px', 
          backgroundColor: connectionStatus === 'connected' ? '#22c55e20' : 
                          connectionStatus === 'error' ? '#ef444420' : '#3b82f620',
          border: `2px solid ${connectionStatus === 'connected' ? '#22c55e' : 
                               connectionStatus === 'error' ? '#ef4444' : '#3b82f6'}`
        }}>
          {connectionStatus === 'checking' && (
            <p>🔄 正在檢查連接...</p>
          )}
          {connectionStatus === 'connected' && (
            <>
              <p style={{ color: '#22c55e', fontSize: '24px', margin: '10px 0' }}>
                ✅ 已成功連接到 Supabase!
              </p>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>
                {supabaseVersion}
              </p>
              <div style={{ marginTop: '20px', textAlign: 'left', padding: '15px', backgroundColor: '#00000020', borderRadius: '4px' }}>
                <p><strong>環境變數檢查:</strong></p>
                <p>📡 URL: {import.meta.env.VITE_SUPABASE_URL ? '✓ 已設定' : '✗ 未設定'}</p>
                <p>🔑 Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ 已設定' : '✗ 未設定'}</p>
              </div>
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <p style={{ color: '#ef4444', fontSize: '24px', margin: '10px 0' }}>
                ❌ 連接失敗
              </p>
              <p style={{ fontSize: '14px', color: '#ef4444' }}>
                {errorMessage}
              </p>
              <div style={{ marginTop: '20px', textAlign: 'left', padding: '15px', backgroundColor: '#00000020', borderRadius: '4px' }}>
                <p><strong>檢查清單:</strong></p>
                <p>1. 確認 .env 檔案存在</p>
                <p>2. 確認 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 已設定</p>
                <p>3. 重新啟動開發伺服器 (npm run dev)</p>
              </div>
            </>
          )}
        </div>

        <button 
          onClick={checkConnection} 
          style={{ marginTop: '20px' }}
        >
          重新測試連接
        </button>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3>設定說明</h3>
        <ol style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
          <li>在專案根目錄建立 <code>.env</code> 檔案</li>
          <li>加入你的 Supabase 憑證:
            <pre style={{ textAlign: 'left', backgroundColor: '#1a1a1a', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
VITE_SUPABASE_URL=your-url{'\n'}VITE_SUPABASE_ANON_KEY=your-key
            </pre>
          </li>
          <li>重新啟動開發伺服器: <code>npm run dev</code></li>
        </ol>
      </div>
    </div>
  )
}

export default App

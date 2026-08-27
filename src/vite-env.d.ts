/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 逗號分隔；可維護會員電話專用畫面的登入 email */
  readonly VITE_MEMBER_PHONE_ONLY_EDITORS?: string
  /** 正式會員專區 LIFF App ID */
  readonly VITE_LIFF_ID?: string
  /** Provider 搬移期間並行測試的新會員專區 LIFF App ID */
  readonly VITE_LIFF_MIGRATION_ID?: string
  /** 線上預約 LIFF App ID */
  readonly VITE_LIFF_BOOK_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


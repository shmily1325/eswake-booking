/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 逗號分隔；可維護會員電話專用畫面的登入 email */
  readonly VITE_MEMBER_PHONE_ONLY_EDITORS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


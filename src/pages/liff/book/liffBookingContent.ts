/**
 * 預約表單內嵌文案（來源：官方 Google Sites / 小編提供）
 * 目的：讓客人在表單內閱讀，不必再點 reurl 連結
 */

export interface FaqItem {
  id: string
  question: string
  answer: string
}

/** 活動差異（小編原文） */
export const ACTIVITY_COMPARISON_INTRO =
  '不確定選哪個？先看下面兩項差異，選定後可播放起滑影片。'

/** Step 1 內嵌：兩項差異（濃縮自 FAQ activity-diff） */
export const STEP1_ACTIVITY_DIFF_LINES = [
  '快艇衝浪：腳不固定，穩定後可放繩，節奏像衝浪',
  '寬板滑水：雙腳固定、全程抓繩，速度較快',
] as const

/** Step 1 頂部價格區間（決策用，非卡片大字） */
export const STEP1_PRICE_RANGE_SUFFIX = '已含裝備、教練、船'

/** Step 1 選 WB 時船型提示（詳情區一行） */
export const STEP1_WB_BOAT_NOTE = '寬板可選小船或大船；衝浪與混合梯次需大船'

/** Step 1 各選項玩法 */
export const STEP1_PLAY_MODE: Record<'WS' | 'WB' | 'BOTH', string> = {
  WS: '全部人都玩快艇衝浪',
  WB: '全部都玩寬板滑水',
  BOTH: '同一梯次，部分寬板、部分衝浪（固定大船）',
}

/** Step 1：只選單項但有人想玩另一項 → 改選「兩個一起」 */
export const STEP1_SPLIT_ACTIVITY_HINT =
  '只選衝浪或寬板，但有人想玩另一項？→ 改選「兩個一起」'

/** Step 2：體驗＋已滑過混合，費用小編報價 */
export const STEP2_MIXED_SKILL_HINT =
  '體驗與已滑過混合，參考價供估算，實際費用小編確認。'

/** Step 2 跟船（濃縮自 FAQ follow-boat） */
export const STEP2_FOLLOW_BOAT_NOTE =
  '親友不滑可跟船：第 1 位免費，第 2 位起每位 $300（請在備註告知人數）'

/** Step 3 時段說明 */
export const STEP3_SCHEDULE_NOTE = '時段為偏好，小編回覆後才確認'

/** Step 4 確認頁固定說明（一行） */
export const STEP4_CONFIRM_NOTE =
  '參考價以小編回覆為準 · 跟船第 2 位起 $300 · 已含裝備教練'

/** @deprecated 請改用 STEP4_CONFIRM_NOTE */
export const STEP4_CONFIRM_NOTES = [STEP4_CONFIRM_NOTE] as const

export const NOTES_PLACEHOLDER = '跟船人數、特殊需求（選填）'

/** 官網（穿著、交通等詳細須知） */
export const OFFICIAL_INFO_URL = 'https://eswakeschool.com'

/** 交通資訊（sites.google.com/.../交通方式） */
export const TRANSPORT_INFO = {
  title: '交通方式',
  address: '249 新北市八里區龍米路一段 170 號',
  entranceNote: '出入口位於大橋遊艇公司右側，7-11 神州門市正對面',
  sections: [
    {
      heading: '開車／騎車',
      lines: [
        '大度路前往 ES（路線影片 0:00–1:25，詳見官網）',
        '成泰路前往 ES（路線影片 1:26–結束，詳見官網）',
      ],
    },
    {
      heading: '停車',
      lines: [
        '汽車：停畫有 ES WAKE 1～15 的車格',
        '機車：可直接騎至廠房內停車',
      ],
    },
    {
      heading: '大眾運輸',
      lines: [
        '捷運至「關渡站」→ 轉乘紅 13 或紅 22 →「關渡大橋站」下車',
      ],
    },
  ],
}

/** 收費說明（2026 官方價目 + FAQ 補充） */
export const PRICING_CONTENT = {
  includesNote: '所有費用已含：基本裝備、教練、船、保險、停車費、冬季防寒衣。',
  boatTypes: [
    {
      name: '基本型（小船）',
      detail: '用於寬板滑水，單艘最多 6 人；7 人以上可兩艘小船。',
    },
    {
      name: '豪華型、頂級型（大船）',
      detail: '用於寬板滑水及快艇衝浪，單艘最多 10 人（8 人以下較舒適）；11 人以上可兩艘大船。',
    },
  ],
  boatTypeNote: '同一梯次有人寬板、有人衝浪（混合梯次）需預約大船。價格依下方官方價目表。',
  followBoat: {
    title: '跟船（親友不滑水）',
    detail: '第一位跟船乘客免費；第二位起每位 $300。',
  },
}

/** 常見 QA（sites.google.com/.../常見qa） */
export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'activity-diff',
    question: '快艇衝浪跟寬板滑水有什麼差異？',
    answer:
      '快艇衝浪（Wakesurf）：在造浪船尾浪滑行，腳未固定，穩定後無需抓繩，船速較慢，類似海洋衝浪。\n\n' +
      '寬板滑水（Wakeboard）：雙腳固定在板上，全程抓繩，速度較快，適合追求速度與跳躍，類似單板滑雪。',
  },
  {
    id: 'boats',
    question: '船型有什麼不同？',
    answer:
      '基本型（小船）：寬板滑水，單艘最多 6 人；7 人以上可兩艘小船。\n\n' +
      '豪華型、頂級型（大船）：寬板滑水及快艇衝浪，單艘最多 10 人（8 人以下較舒適）；11 人以上可兩艘大船。\n\n' +
      '同一梯次有人寬板、有人衝浪（混合梯次）需預約大船。',
  },
  {
    id: 'clothing',
    question: '服裝穿著要注意什麼？',
    answer:
      '建議：背心、短袖、泳裝、衝浪褲、防曬衣等。不建議 T 恤、牛仔褲等吸水材質下水。\n\n' +
      '請自備：防曬乳、毛巾、換洗衣物。\n\n' +
      '現場提供：NAMUA 沐浴露、Panasonic 吹風機、脫水機；冬季防寒衣可租借（單次／免費）。\n\n' +
      '✖ 不可帶下水：泳鏡、眼鏡、飾品',
  },
  {
    id: 'follow-boat',
    question: '親友不滑可以跟船嗎？',
    answer:
      '可以。第一位跟船乘客免費；第二位起每位 $300。\n\n' +
      '跟船人數受船型限制，請預約時告知。如需取消跟船請提前通知。',
  },
]

/** Step 3 優先顯示的 QA（跟預約決策最相關） */
export const FAQ_FOR_PRICING_STEP = ['activity-diff', 'boats', 'follow-boat'] as const

/** Step 5 顯示交通 */
export const SHOW_TRANSPORT_ON_STEP = 5

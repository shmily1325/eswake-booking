/** 預約前／當日須知（原 LINE 自動回覆 + 小編常用說明） */
export const BOOKING_REMINDERS = [
  {
    id: 'weather',
    icon: '🌦️',
    text: '預約當日如降雨機率較高，建議出門前可先詢問我們當地的天氣狀況！',
    /** 建議出現時機 */
    when: 'date' as const,
  },
  {
    id: 'early-coach',
    icon: '✨',
    text: '如欲預約 8 點前時段，需指定教練課程。',
    when: 'morning-or-coach' as const,
  },
] as const

/** 船型介紹影片（LINE 客服常用） */
export const BOAT_INTRO_VIDEO_ID = 'nHYWwOX3rpY'

export const BOAT_COMFORT_NOTE = '大船單艘最多 10 人，8 人以下較為舒適。'

export const BOAT_DUAL_BIG_NOTE = '11 人以上需 2 艘大船，實際安排以小編回覆為準。'

export const BOAT_BOTH_ACTIVITIES_NOTE =
  '不同活動可同時預約；若同一時段想體驗 Wakeboard 與 Wakesurf，需預約大船。'

import type { ActivityChoice, ActivityCode } from './types'

export type BookLocale = 'zh' | 'en'

const STORAGE_KEY = 'liff_book_locale'

export function readInitialBookLocale(): BookLocale {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch { /* ignore */ }
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
    return 'en'
  }
  return 'zh'
}

export function persistBookLocale(locale: BookLocale): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, locale)
  } catch { /* ignore */ }
}

export interface BookI18nStrings {
  header: { brand: string; title: string; memberRateHint: string }
  localeToggle: { zh: string; en: string }
  steps: readonly { id: number; title: string; pill: string; subtitle: string }[]
  common: { priceIncludes: string }
  boot: { chunk: string; init: string; login: string; slow: string; stuck: string; retry: string; loginFallback: string; openInLine: string }
  notEnabled: { title: string; body: string }
  step1: {
    priceSuffix: string
    priceBannerRange: (low: number, high: number) => string
    pickPrompt: string
    activities: Record<'WS' | 'WB' | 'BOTH', { labelZh: string; labelEn: string }>
    diffWS: string
    diffWB: string
    priceWS: (amount: string) => string
    priceWBFrom: (amount: string) => string
    priceWBDual: (small: string, big: string) => string
    bothLabel: string
    bothSub: string
    bothPrice: (amount: string) => string
    bothShort: string
    mixedToggle: string
    bothNote: string
    videoMandarinNote: string
    memberRateApplied: string
  }
  step2: {
    optionalLabel: string
    headcount: string
    experienceSingle: string
    experienceMulti: string
    allFirstTime: string
    allExperienced: string
    partialFirstTime: string
    mixedExperienceToggle: string
    partialCountLabel: string
    firstTime: string
    firstTimeLand: string
    firstTimeWater: string
    firstTimeDetail: string
    experienced: string
    experiencedNote: string
    firstTimeUnitPrice: (amount: string) => string
    firstTimeUnitPricePerActivity: (amount: string) => string
    sessionDualPrice: (guest: number, member: number) => string
    pricingLegendFirstTimeWB: (small: number, big: number) => string
    pricingLegendFirstTimeBig: (price: number) => string
    pricingLegendExperiencedWB: (
      blockMin: number,
      smallGuest: number,
      smallMember: number,
      bigGuest: number,
      bigMember: number,
    ) => string
    pricingLegendExperiencedBig: (blockMin: number, guest: number, member: number) => string
    estimateExperiencedDetail: (count: number, guest: number, member: number) => string
    partialDetail: (beginners: number, headcount: number) => string
    nFirstTime: (n: number) => string
    experienceSummary: (headcount: number, beginnerCount: number | null) => string
    summaryPeople: (n: number) => string
    summaryEstimate: (total: string) => string
    followBoat: {
      toggle: string
      countLabel: string
      none: string
      nFollowers: (n: number) => string
      selected: (n: number) => string
      aboardLine: (riders: number, follow: number, fee: string | null) => string
    }
  }
  step3: {
    date: string
    timeSlot: string
    morning: string
    afternoon: string
    scheduleNote: string
    schedulePendingNote: string
    addCoach: string
    designateCoach: string
    coachNone: string
    coachYes: string
    calendar: {
      notOpen: string
      bookUntil: (date: string) => string
      past: string
      blocked: string
      closed: string
      prevMonth: string
      nextMonth: string
      monthLabel: (year: number, month: number) => string
    }
    coachPicker: {
      empty: string
      askStaff: string
    }
    selectedLabel: string
    addAlternateDates: string
    preferredDates: string
    maxDates: string
    removeDate: string
    earlyCoachNote: string
    addCoachShort: string
    addCoachMorningShort: string
  }
  step4: {
    summaryTitle: string
    labelActivity: string
    labelPeople: string
    labelBoat: string
    labelDates: string
    labelCoach: string
    confirmNote: string
    submitHint: string
    messageTooLong: string
    contact: string
    namePh: string
    phonePh: string
    notesPh: string
    notesPhBoth: string
    attireLink: string
    desktopCopy: string
    boat: string
    coach: string
    coachNone: string
    coachDesignated: string
    people: string
    followBoat: string
    followBoatSummary: (n: number) => string
    onBoatTotal: string
    onBoatTotalSummary: (riders: number, follow: number) => string
    memberPrefill: string
  }
  binding: {
    title: string
    subtitle: string
    phone: string
    phonePh: string
    birthday: string
    year: string
    month: string
    day: string
    monthUnit: (n: number) => string
    dayUnit: (n: number) => string
    submit: string
    submitting: string
    skip: string
    contactOfficial: string
    errorHelp: string
  }
  footer: {
    back: string
    next: string
    /** Step 1–3 primary CTA: guided label for the next step */
    nextByStep: readonly [string, string, string]
    confirm: string
    submitLine: string
    submitConfirm: string
  }
  validation: {
    pickActivity: string
    pickExperience: string
    pickBoat: string
    pickDate: string
    pickCoach: string
    fillName: string
    fillPhone: string
    connectingLine: string
  }
  staff: {
    unsure: string
    needHelp: string
    askStaff: string
    helpOpener: string
    helpPrompt: string
    splitActivity: string
    formHelp: string
    splitActivityMsg: string
  }
  estimate: {
    title: string
    about: string
    reference: string
    expand: string
    collapse: string
    referenceNote: string
  }
  pricing: {
    member: string
    guest: string
    firstTime: string
    bothActivities: string
    waterAbout: (minutes: number) => string
    designatedCoach: (name: string, count: number, unitAmount: string) => string
    followBoatLine: (count: number, fee: string) => string
    coachBothEstimate: string
  }
  lineMessage: {
    submitTitle: string
    coachLine: (name: string) => string
    coachNone: string
    coachMissing: string
    contactLine: (name: string, phone: string) => string
    estimateLine: (total: string) => string
    notesPrefix: string
    skillFirstTime: string
    skillExperienced: string
  }
  boat: {
    activityChip: Record<'WS' | 'WB' | 'BOTH', string>
    step1Title: string
    groupContext: (aboard: number) => string
    small: string
    big: string
    smallSeatingSingle: string
    smallSeatingDual: string
    bigSeatingSingle: string
    bigSeatingDual: string
    segmentFirstTimePrice: (firstTime: number) => string
    segmentReturningLine: (guestSession: number) => string
    segmentMemberNote: (memberSession: number) => string
    /** @deprecated large-group variant removed */
    largeGroupTitle: string
    twoSmallBoats: string
    twoBigBoats: string
    largeGroupSmallMax: string
    largeGroupSmallRange: string
    largeGroupBigDual: string
    largeGroupBigSingle: string
    capacityNote: string
    perPerson: string
    introVideoLabel: string
  }
  reminders: {
    title: string
    earlyCoach: string
    dualBig: string
    dualSmall: string
    comfort: string
  }
  video: {
    playLabel: string
    playAria: (title: string) => string
    cantPlay: string
    close: string
  }
}

export const BOOK_I18N: Record<BookLocale, BookI18nStrings> = {
  zh: {
    header: { brand: 'ES WAKE', title: '線上預約', memberRateHint: '會員價估算' },
    localeToggle: { zh: '中文', en: 'EN' },
    common: { priceIncludes: '已含裝備、教練、船、保險' },
    steps: [
      { id: 1, title: '選項目', pill: '項目', subtitle: '快艇衝浪？寬板滑水？都要？' },
      { id: 2, title: '填人數', pill: '人數', subtitle: '幾位下水、第一次嗎、船型偏好' },
      { id: 3, title: '選時間', pill: '時間', subtitle: '偏好日期與時段（尚未保留）' },
      { id: 4, title: '預約摘要', pill: '摘要', subtitle: '確認內容後送出' },
    ],
    boot: {
      chunk: '載入預約表單…',
      init: '正在啟動…',
      login: '正在連接 LINE…',
      slow: '網路較慢，請稍候…',
      stuck: '載入時間較久。請重新整理，或關閉後再點一次連結。',
      retry: '重新整理',
      loginFallback: '若登入畫面出現錯誤，請改從 LINE 重新開啟：',
      openInLine: '在 LINE 中開啟',
    },
    notEnabled: { title: '預約表單尚未開放', body: '請繼續使用 LINE 官方帳號填寫預約資訊。' },
    step1: {
      priceSuffix: '已含裝備、教練、船、保險',
      priceBannerRange: (low, high) =>
        `體驗 $${low.toLocaleString()}～$${high.toLocaleString()}／人 · 已含裝備、教練、船、保險`,
      pickPrompt: '請選擇想體驗的項目',
      activities: {
        WS: { labelZh: '快艇衝浪', labelEn: 'Wakesurfing' },
        WB: { labelZh: '寬板滑水', labelEn: 'Wakeboarding' },
        BOTH: { labelZh: '快艇衝浪＋寬板滑水', labelEn: 'Wakesurf + wakeboard' },
      },
      diffWS: '腳不固定 · 像衝浪',
      diffWB: '雙腳固定 · 速度較快',
      priceWS: amount => `${amount}／人`,
      priceWBFrom: amount => `${amount}起／人`,
      priceWBDual: (small, big) => `小船 ${small} · 大船 ${big}／人`,
      bothLabel: '有人快艇衝浪、有人寬板滑水',
      bothSub: '同一趟船 · 大船',
      bothPrice: amount => `每項 ${amount}／人`,
      bothShort: '快艇衝浪＋寬板滑水',
      mixedToggle: '有人衝浪、有人滑水？',
      bothNote: '同一梯次可混搭 · 自己兩項都玩也行，每項各算 · 點項目可改選單一種',
      videoMandarinNote: '影片為中文解說',
      memberRateApplied: '已滑過已套用會員價',
    },
    step2: {
      optionalLabel: '選填',
      headcount: '幾位要下水？',
      experienceSingle: '第一次玩嗎？',
      experienceMulti: '第一次玩嗎？',
      allFirstTime: '都是第一次',
      allExperienced: '都滑過了',
      partialFirstTime: '有人第一次、有人滑過',
      mixedExperienceToggle: '有人第一次、有人滑過？',
      partialCountLabel: '幾位第一次？',
      firstTime: '體驗',
      firstTimeLand: '陸上教學 10 分鐘',
      firstTimeWater: '水上每人 20 分鐘',
      firstTimeDetail: '陸上教學 10 分鐘 · 水上每人 20 分鐘',
      experienced: '已經滑過',
      experiencedNote: '水上每人 20 分鐘計價',
      firstTimeUnitPrice: amount => `體驗 ${amount}／人`,
      firstTimeUnitPricePerActivity: amount => `體驗 每項 ${amount}／人`,
      sessionDualPrice: (guest, member) =>
        `$${guest.toLocaleString()}（會員 $${member.toLocaleString()}）`,
      pricingLegendFirstTimeWB: (small, big) =>
        `體驗 小船 $${small.toLocaleString()} · 大船 $${big.toLocaleString()} · 陸上 10 分 + 水上每人 20 分`,
      pricingLegendFirstTimeBig: price =>
        `體驗 $${price.toLocaleString()} · 陸上 10 分 + 水上每人 20 分`,
      pricingLegendExperiencedWB: (blockMin, smallGuest, smallMember, bigGuest, bigMember) => {
        const dual = (g: number, m: number) => `$${g.toLocaleString()}（會員 $${m.toLocaleString()}）`
        return `已滑過 ${blockMin} 分鐘 · 小船 ${dual(smallGuest, smallMember)} · 大船 ${dual(bigGuest, bigMember)}`
      },
      pricingLegendExperiencedBig: (blockMin, guest, member) =>
        `已滑過 ${blockMin} 分鐘 · $${guest.toLocaleString()}（會員 $${member.toLocaleString()}）`,
      estimateExperiencedDetail: (count, guest, member) =>
        `${count} 已滑過 × $${guest.toLocaleString()}（會員 $${member.toLocaleString()}）`,
      partialDetail: (beginners, headcount) =>
        `${beginners} 位體驗 · ${headcount - beginners} 位已滑過`,
      nFirstTime: n => `${n} 位第一次`,
      experienceSummary: (headcount, beginnerCount) => {
        if (beginnerCount == null) return '—'
        if (beginnerCount === headcount) return '全部體驗'
        if (beginnerCount === 0) return '皆已滑過'
        return `${beginnerCount} 位體驗`
      },
      summaryPeople: n => `${n} 人`,
      summaryEstimate: total => `約 ${total}`,
      followBoat: {
        toggle: '有人不玩、想跟船？',
        countLabel: '幾位跟船',
        none: '不需要',
        nFollowers: n => `${n} 位`,
        selected: n => `跟船 ${n} 位`,
        aboardLine: (riders, follow, fee) =>
          fee ? `船上 ${riders + follow} 人 · ${fee}` : `船上 ${riders + follow} 人 · 跟船免費`,
      },
    },
    step3: {
      date: '日期',
      timeSlot: '時段',
      morning: '上午',
      afternoon: '下午',
      scheduleNote: '偏好時段，小編 LINE 回覆後才確認',
      schedulePendingNote: '送出後由小編確認梯次與船位，尚未保留',
      addCoach: '＋ 指定教練（選填 · 8 點前需指定）',
      addCoachShort: '指定教練（選填）',
      addCoachMorningShort: '指定教練（8 點前需指定）',
      earlyCoachNote: '如欲預約 8 點前時段，需指定教練。',
      designateCoach: '指定教練',
      coachNone: '不指定',
      coachYes: '指定',
      calendar: {
        notOpen: '尚未開放預約',
        bookUntil: d => `可預約至 ${d}`,
        past: '已過期',
        blocked: '不可預約',
        closed: '尚未開放',
        prevMonth: '上個月',
        nextMonth: '下個月',
        monthLabel: (y, m) => `${y} 年 ${m + 1} 月`,
      },
      coachPicker: {
        empty: '目前無可指定的教練，請選「不指定」或聯繫小編。',
        askStaff: '請洽小編',
      },
      selectedLabel: '已選',
      addAlternateDates: '＋ 再加備選日（最多 3 個）',
      preferredDates: '備選日期',
      maxDates: '最多 3 個備選日',
      removeDate: '移除',
    },
    step4: {
      summaryTitle: '你的預約內容',
      labelActivity: '項目',
      labelPeople: '人數',
      labelBoat: '船型',
      labelDates: '日期',
      labelCoach: '教練',
      confirmNote: '參考價以小編回覆為準',
      submitHint: '小編回信後才確認時段與價格',
      messageTooLong: '訊息過長，請精簡備註後再試',
      contact: '姓名與電話',
      namePh: '姓名',
      phonePh: '電話',
      notesPh: '特殊需求（選填）',
      notesPhBoth: '各幾人玩什麼（例：2 寬板、3 衝浪）· 特殊需求',
      attireLink: '穿著建議與交通方式 →',
      desktopCopy: '請複製訊息到 LINE 官方帳號：',
      boat: '船型',
      coach: '教練',
      coachNone: '不指定',
      coachDesignated: '指定',
      people: '人',
      followBoat: '跟船',
      followBoatSummary: n => `跟船 ${n} 位`,
      onBoatTotal: '船上共',
      onBoatTotalSummary: (riders, follow) => `${riders + follow} 人（${riders} 滑 + ${follow} 跟）`,
      memberPrefill: '已帶入會員資料，可修改',
    },
    binding: {
      title: 'ES WAKE 預約',
      subtitle: '綁定會員可自動帶入姓名與電話；也可略過以訪客身份填寫',
      phone: '手機號碼',
      phonePh: '請輸入您的手機號碼',
      birthday: '生日',
      year: '年',
      month: '月',
      day: '日',
      monthUnit: n => `${n}月`,
      dayUnit: n => `${n}日`,
      submit: '綁定並繼續',
      submitting: '綁定中...',
      skip: '略過，以訪客身份填寫',
      contactOfficial: '私訊官方帳號',
      errorHelp: '若確定資料正確，請私訊官方帳號協助綁定。',
    },
    footer: {
      back: '返回',
      next: '下一步',
      nextByStep: ['填人數', '選時間', '看摘要'],
      confirm: '確認',
      submitLine: '用 LINE 送出',
      submitConfirm: '送出預約需求',
    },
    validation: {
      pickActivity: '請先選擇項目',
      pickExperience: '請選擇體驗人數',
      pickBoat: '請先選擇船型',
      pickDate: '請選擇至少一個偏好日期',
      pickCoach: '請選擇教練，或改為不指定',
      fillName: '請填寫姓名',
      fillPhone: '請填寫有效電話（至少 8 碼）',
      connectingLine: '正在連接 LINE…',
    },
    staff: {
      unsure: '還是選不出來？',
      needHelp: '還是有問題？',
      askStaff: '問小編',
      helpOpener: '嗨，預約想請教～',
      helpPrompt: '想請教：',
      splitActivity: '大家想玩不一樣？→ 選「有人快艇衝浪、有人寬板滑水」',
      formHelp: '小編可協助',
      splitActivityMsg: '有人寬板、有人衝浪，人數不同，請協助安排與報價',
    },
    estimate: {
      title: '費用估算',
      about: '約',
      reference: '參考價',
      expand: '看明細',
      collapse: '收合明細',
      referenceNote: '參考價以小編回覆為準',
    },
    pricing: {
      member: '會員',
      guest: '非會員',
      firstTime: '初次體驗',
      bothActivities: '快艇衝浪＋寬板滑水',
      waterAbout: m => `水上約 ${m} 分`,
      designatedCoach: (name, count, unit) =>
        count === 1 ? `教練 ${name} ${unit}` : `教練 ${name} ${count}×${unit}`,
      followBoatLine: (_count, fee) => (fee === '$0' ? '跟船免費' : `跟船 ${fee}`),
      coachBothEstimate: '快艇衝浪＋寬板滑水教練價以較高計',
    },
    lineMessage: {
      submitTitle: '【預約】',
      coachLine: name => `教練 ${name}`,
      coachNone: '教練 不指定',
      coachMissing: '教練 待指定',
      contactLine: (name, phone) => `${name} · ${phone}`,
      estimateLine: total => `約 ${total}（參考）`,
      notesPrefix: '備註：',
      skillFirstTime: '第一次體驗',
      skillExperienced: '已經滑過',
    },
    boat: {
      activityChip: {
        WS: '大船',
        BOTH: '大船',
        WB: '小船/大船',
      },
      step1Title: '偏好哪種船？',
      groupContext: aboard =>
        aboard >= 11
          ? `船上 ${aboard} 人 · 小船或大船皆可能需 2 艘`
          : `船上 ${aboard} 人 · 選小船會安排 2 艘`,
      small: '小船',
      big: '大船',
      smallSeatingSingle: '6 人/艘',
      smallSeatingDual: '需 2 艘 · 6 人/艘',
      bigSeatingSingle: '10 人/艘',
      bigSeatingDual: '需 2 艘 · 10 人/艘',
      segmentFirstTimePrice: firstTime => `體驗 $${firstTime.toLocaleString()}`,
      segmentReturningLine: guestSession =>
        `已滑過 $${guestSession.toLocaleString()}`,
      segmentMemberNote: memberSession => `（會員 $${memberSession.toLocaleString()}）`,
      largeGroupTitle: '7 人以上怎麼安排？',
      twoSmallBoats: '2 艘小船',
      twoBigBoats: '2 艘大船',
      largeGroupSmallMax: '2 艘 · 最多 12 人',
      largeGroupSmallRange: '7～10 人',
      largeGroupBigDual: '2 艘 · 11+ 人',
      largeGroupBigSingle: '單艘即可',
      capacityNote: '小船 6 人/艘 · 7+ 兩艘 · 大船 10 人/艘 · 11+ 兩艘',
      perPerson: '／人',
      introVideoLabel: '船型介紹',
    },
    reminders: {
      title: '本梯次提醒',
      earlyCoach: '如欲預約 8 點前時段，需指定教練。',
      dualBig: '船上 11 人以上需 2 艘大船，實際安排以小編回覆為準。',
      dualSmall: '船上 7 人以上選小船，需 2 艘小船安排座位。',
      comfort: '大船單艘最多 10 人，船上 8 人以下較為舒適。',
    },
    video: {
      playLabel: '影片',
      playAria: title => `播放${title}`,
      cantPlay: '若無法播放，改在 YouTube 開啟',
      close: '關閉',
    },
  },
  en: {
    header: { brand: 'ES WAKE', title: 'Book Online', memberRateHint: 'Member rate estimate' },
    localeToggle: { zh: '中文', en: 'EN' },
    common: { priceIncludes: 'Gear, coach, boat & insurance included' },
    steps: [
      { id: 1, title: 'Activity', pill: 'Activity', subtitle: 'Wakesurf, wakeboard, or both' },
      { id: 2, title: 'Group', pill: 'Group', subtitle: 'Headcount, experience & boat preference' },
      { id: 3, title: 'Schedule', pill: 'Time', subtitle: 'Preferred date & time (not held yet)' },
      { id: 4, title: 'Summary', pill: 'Review', subtitle: 'Review & submit' },
    ],
    boot: {
      chunk: 'Loading booking form…',
      init: 'Starting…',
      login: 'Connecting to LINE…',
      slow: 'Slow network, please wait…',
      stuck: 'Taking longer than usual. Refresh or reopen the link.',
      retry: 'Refresh',
      loginFallback: 'If sign-in fails, reopen from LINE:',
      openInLine: 'Open in LINE',
    },
    notEnabled: { title: 'Booking not available yet', body: 'Please book via our LINE official account.' },
    step1: {
      priceSuffix: 'Gear, coach, boat & insurance included',
      priceBannerRange: (low, high) =>
        `First-time $${low.toLocaleString()}–$${high.toLocaleString()}/person · Gear, coach, boat & insurance included`,
      pickPrompt: 'Choose an activity',
      activities: {
        WS: { labelZh: 'Wakesurfing', labelEn: 'Wakesurfing' },
        WB: { labelZh: 'Wakeboarding', labelEn: 'Wakeboarding' },
        BOTH: { labelZh: 'Wakesurf + wakeboard', labelEn: 'Wakesurf + wakeboard' },
      },
      diffWS: 'Feet free · surf feel',
      diffWB: 'Boots fixed · faster',
      priceWS: amount => `${amount}/person`,
      priceWBFrom: amount => `from ${amount}/person`,
      priceWBDual: (small, big) => `Small ${small} · Big ${big}/person`,
      bothLabel: 'Some wakesurf, some wakeboard',
      bothSub: 'Same boat trip · big boat',
      bothPrice: amount => `${amount}/activity/person`,
      bothShort: 'Wakesurf + wakeboard',
      mixedToggle: 'Some wakesurf, some wakeboard?',
      bothNote: 'Mixed group on same trip · Or play both yourself — each priced separately · Tap an activity to pick just one',
      videoMandarinNote: 'Video in Mandarin',
      memberRateApplied: 'Member rate applied (returning riders)',
    },
    step2: {
      optionalLabel: 'Optional',
      headcount: 'How many riding?',
      experienceSingle: 'First time?',
      experienceMulti: 'First time?',
      allFirstTime: 'All first-timers',
      allExperienced: 'All experienced',
      partialFirstTime: 'Mix of both',
      mixedExperienceToggle: 'Mix of first-timers and experienced?',
      partialCountLabel: 'How many first-timers?',
      firstTime: 'First time',
      firstTimeLand: '10 min land lesson',
      firstTimeWater: '20 min water each',
      firstTimeDetail: '10 min land · 20 min water each',
      experienced: 'Experienced',
      experiencedNote: '20 min water, time-based rate',
      firstTimeUnitPrice: amount => `First-timer ${amount}/person`,
      firstTimeUnitPricePerActivity: amount => `First-timer ${amount}/activity/person`,
      sessionDualPrice: (guest, member) =>
        `$${guest.toLocaleString()} (member $${member.toLocaleString()})`,
      pricingLegendFirstTimeWB: (small, big) =>
        `First-timer small boat $${small.toLocaleString()} · big boat $${big.toLocaleString()} · 10 min land + 20 min water each`,
      pricingLegendFirstTimeBig: price =>
        `First-timer $${price.toLocaleString()} · 10 min land + 20 min water each`,
      pricingLegendExperiencedWB: (blockMin, smallGuest, smallMember, bigGuest, bigMember) => {
        const dual = (g: number, m: number) => `$${g.toLocaleString()} (member $${m.toLocaleString()})`
        return `Returning ${blockMin} min · small ${dual(smallGuest, smallMember)} · big ${dual(bigGuest, bigMember)}`
      },
      pricingLegendExperiencedBig: (blockMin, guest, member) =>
        `Returning ${blockMin} min · $${guest.toLocaleString()} (member $${member.toLocaleString()})`,
      estimateExperiencedDetail: (count, guest, member) =>
        `${count} returning × $${guest.toLocaleString()} (member $${member.toLocaleString()})`,
      partialDetail: (beginners, headcount) =>
        `${beginners} first-timer${beginners > 1 ? 's' : ''} · ${headcount - beginners} experienced`,
      nFirstTime: n => `${n} first-timer${n > 1 ? 's' : ''}`,
      experienceSummary: (headcount, beginnerCount) => {
        if (beginnerCount == null) return '—'
        if (beginnerCount === headcount) return 'All first-timers'
        if (beginnerCount === 0) return 'All experienced'
        return `${beginnerCount} first-timer${beginnerCount > 1 ? 's' : ''}`
      },
      summaryPeople: n => `${n} rider${n > 1 ? 's' : ''}`,
      summaryEstimate: total => `~${total}`,
      followBoat: {
        toggle: 'Someone not riding but coming along?',
        countLabel: 'How many non-riders',
        none: 'None',
        nFollowers: n => `${n}`,
        selected: n => `${n} non-rider${n > 1 ? 's' : ''}`,
        aboardLine: (riders, follow, fee) =>
          fee ? `${riders + follow} on board · ${fee}` : `${riders + follow} on board · 1st free`,
      },
    },
    step3: {
      date: 'Date',
      timeSlot: 'Time preference',
      morning: 'Morning',
      afternoon: 'Afternoon',
      scheduleNote: 'Preference only — staff confirms on LINE',
      schedulePendingNote: 'Not reserved yet — staff will confirm slot & boat after you submit',
      addCoach: '+ Request a coach (optional · required before 8 AM)',
      addCoachShort: 'Request a coach (optional)',
      addCoachMorningShort: 'Request a coach (required before 8 AM)',
      earlyCoachNote: 'Sessions before 8 AM require a designated coach.',
      designateCoach: 'Coach preference',
      coachNone: 'No preference',
      coachYes: 'Request coach',
      calendar: {
        notOpen: 'Not open for booking yet',
        bookUntil: d => `Book through ${d}`,
        past: 'Past',
        blocked: 'Unavailable',
        closed: 'Not open yet',
        prevMonth: 'Previous month',
        nextMonth: 'Next month',
        monthLabel: (y, m) => `${new Date(y, m, 1).toLocaleString('en', { month: 'long' })} ${y}`,
      },
      coachPicker: {
        empty: 'No coaches listed — choose no preference or contact us.',
        askStaff: 'Contact us',
      },
      selectedLabel: 'Selected',
      addAlternateDates: '+ Add alternate date (up to 3)',
      preferredDates: 'Alternate dates',
      maxDates: 'Up to 3 preferred dates',
      removeDate: 'Remove',
    },
    step4: {
      summaryTitle: 'Your request',
      labelActivity: 'Activity',
      labelPeople: 'Riders',
      labelBoat: 'Boat',
      labelDates: 'Dates',
      labelCoach: 'Coach',
      confirmNote: 'Estimate only — staff will confirm',
      submitHint: 'Date and price confirmed after we reply',
      messageTooLong: 'Message too long — shorten notes and try again.',
      contact: 'Name & phone',
      namePh: 'Name',
      phonePh: 'Phone',
      notesPh: 'Special requests (optional)',
      notesPhBoth: 'Headcount per activity (e.g. 2 WB, 3 WS) · special requests',
      attireLink: 'What to wear & directions →',
      desktopCopy: 'Copy this message to our LINE account:',
      boat: 'Boat',
      coach: 'Coach',
      coachNone: 'No preference',
      coachDesignated: 'Requested',
      people: 'riders',
      followBoat: 'Non-riders',
      followBoatSummary: n => `${n} non-rider${n > 1 ? 's' : ''}`,
      onBoatTotal: 'On board',
      onBoatTotalSummary: (riders, follow) => `${riders + follow} (${riders} riding + ${follow} non-riding)`,
      memberPrefill: 'Member info pre-filled — you can edit',
    },
    binding: {
      title: 'ES WAKE Booking',
      subtitle: 'Link your membership to auto-fill name & phone, or skip as guest',
      phone: 'Mobile number',
      phonePh: 'Your mobile number',
      birthday: 'Date of birth',
      year: 'Year',
      month: 'Month',
      day: 'Day',
      monthUnit: n => String(n),
      dayUnit: n => String(n),
      submit: 'Link & continue',
      submitting: 'Linking...',
      skip: 'Skip — continue as guest',
      contactOfficial: 'Message us on LINE',
      errorHelp: 'If your details are correct, message us to link your account.',
    },
    footer: {
      back: 'Back',
      next: 'Next',
      nextByStep: ['Group size', 'Pick dates', 'Review'],
      confirm: 'Review',
      submitLine: 'Send via LINE',
      submitConfirm: 'Submit request',
    },
    validation: {
      pickActivity: 'Choose an activity first',
      pickExperience: 'Select how many are first-timers',
      pickBoat: 'Choose a boat preference',
      pickDate: 'Add at least one preferred date',
      pickCoach: 'Pick a coach or choose no preference',
      fillName: 'Enter your name',
      fillPhone: 'Enter a valid phone (at least 8 digits)',
      connectingLine: 'Connecting to LINE…',
    },
    staff: {
      unsure: 'Still can\'t decide?',
      needHelp: 'Still have questions?',
      askStaff: 'Ask us',
      helpOpener: 'Hi — booking question:',
      helpPrompt: 'Question: ',
      splitActivity: 'Mixed group? → pick “Some wakesurf, some wakeboard”',
      formHelp: 'Need help?',
      splitActivityMsg: 'Split group (wakeboard + wakesurf) — please help arrange & quote',
    },
    estimate: {
      title: 'Price estimate',
      about: 'Est.',
      reference: 'Reference only',
      expand: 'Details',
      collapse: 'Hide details',
      referenceNote: 'Estimate only — staff will confirm',
    },
    pricing: {
      member: 'member',
      guest: 'non-member',
      firstTime: 'First-time package',
      bothActivities: 'Wakesurf + wakeboard',
      waterAbout: m => `~${m} min on water`,
      designatedCoach: (name, count, unit) =>
        count === 1 ? `Coach ${name} ${unit}` : `Coach ${name} ${count}×${unit}`,
      followBoatLine: (_count, fee) => (fee === '$0' ? 'Non-rider free' : `Non-riders ${fee}`),
      coachBothEstimate: 'Wakesurf + wakeboard coach uses higher rate',
    },
    lineMessage: {
      submitTitle: '[Booking]',
      coachLine: name => `Coach ${name}`,
      coachNone: 'Coach: no preference',
      coachMissing: 'Coach: TBD',
      contactLine: (name, phone) => `${name} · ${phone}`,
      estimateLine: total => `~${total} (estimate)`,
      notesPrefix: 'Notes: ',
      skillFirstTime: 'First time',
      skillExperienced: 'Experienced',
    },
    boat: {
      activityChip: {
        WS: 'Big boat',
        BOTH: 'Big boat',
        WB: 'Small/Big boat',
      },
      step1Title: 'Boat preference',
      groupContext: aboard =>
        aboard >= 11
          ? `${aboard} on board · small or big may need 2 boats`
          : `${aboard} on board · small boat = 2 boats`,
      small: 'Small boat',
      big: 'Big boat',
      smallSeatingSingle: '6 per boat',
      smallSeatingDual: '2 boats · 6 each',
      bigSeatingSingle: '10 per boat',
      bigSeatingDual: '2 boats · 10 each',
      segmentFirstTimePrice: firstTime => `First-timer $${firstTime.toLocaleString()}`,
      segmentReturningLine: guestSession =>
        `Returning $${guestSession.toLocaleString()}`,
      segmentMemberNote: memberSession => `(member $${memberSession.toLocaleString()})`,
      largeGroupTitle: '7+ riders — boat setup',
      twoSmallBoats: '2 small boats',
      twoBigBoats: '2 big boats',
      largeGroupSmallMax: '2 boats · up to 12',
      largeGroupSmallRange: '7–10 riders',
      largeGroupBigDual: '2 boats · 11+',
      largeGroupBigSingle: 'Single boat OK',
      capacityNote: 'Small 6/boat · 7+ needs 2 · Big 10/boat · 11+ needs 2',
      perPerson: '/person',
      introVideoLabel: 'Boat intro',
    },
    reminders: {
      title: 'Session notes',
      earlyCoach: 'Sessions before 8 AM require a designated coach.',
      dualBig: '11+ on board may need 2 big boats — staff will confirm.',
      dualSmall: '7+ on board with small boats needs 2 boats for seating.',
      comfort: 'Big boat fits up to 10; 8 or fewer on board is more comfortable.',
    },
    video: {
      playLabel: 'Video',
      playAria: title => `Play ${title}`,
      cantPlay: 'Open in YouTube if playback fails',
      close: 'Close',
    },
  },
}

/** Footer CTA for steps 1–3: guided label toward the next step (not generic「下一步」). */
export function getStepNextLabel(step: number, footer: BookI18nStrings['footer']): string {
  if (step >= 1 && step <= 3) return footer.nextByStep[step - 1]
  return footer.next
}

export function activityDisplayLabel(code: ActivityChoice, locale: BookLocale): string {
  return activityDetailTitle(code, locale)
}

/** Step 1 segment：中文主標+英文副標；EN 主標+船型提示（activityChip） */
export function activitySegmentLabels(
  code: 'WS' | 'WB' | 'BOTH',
  locale: BookLocale,
): { primary: string; secondary: string } {
  const current = BOOK_I18N[locale].step1.activities[code]
  const segmentEnLabel =
    code === 'WB' ? 'Wakeboard' : code === 'WS' ? 'Wakesurf' : current.labelEn
  return locale === 'en'
    ? { primary: segmentEnLabel, secondary: BOOK_I18N.en.boat.activityChip[code] }
    : { primary: current.labelZh, secondary: segmentEnLabel }
}

/** Step 1 詳情標題：中文（English）；EN 僅主標 */
export function activityDetailTitle(code: ActivityChoice, locale: BookLocale): string {
  const current = BOOK_I18N[locale].step1.activities[code]
  return locale === 'en'
    ? current.labelEn
    : `${current.labelZh}（${current.labelEn}）`
}

export function activityTitleLabel(code: ActivityCode, locale: BookLocale): string {
  return BOOK_I18N[locale].step1.activities[code][locale === 'en' ? 'labelEn' : 'labelZh']
}

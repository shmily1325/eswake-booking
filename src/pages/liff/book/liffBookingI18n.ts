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
  steps: readonly { id: number; title: string; pill: string }[]
  boot: { chunk: string; init: string; login: string; slow: string; stuck: string; retry: string }
  notEnabled: { title: string; body: string }
  step1: {
    priceSuffix: string
    pickPrompt: string
    playMode: Record<'WS' | 'WB' | 'BOTH', string>
    activities: Record<'WS' | 'WB' | 'BOTH', { labelZh: string; labelEn: string }>
    bothShort: string
    bothNote: string
    videoMandarinNote: string
    memberRateApplied: string
  }
  step2: {
    headcount: string
    experienceSingle: string
    experienceMulti: string
    firstTime: string
    firstTimeNote: string
    experienced: string
    experiencedNote: string
    allFirstTime: string
    noneFirstTime: string
    nFirstTime: (n: number) => string
    experienceSummary: (headcount: number, beginnerCount: number | null) => string
    mixedSkillHint: string
    followBoat: {
      toggle: string
      rule: string
      countLabel: string
      none: string
      nFollowers: (n: number) => string
      selected: (n: number) => string
      freeHint: string
      feeHint: (n: number, fee: string) => string
      onBoatSummary: (riders: number, follow: number) => string
      capacityNote: string
    }
  }
  step3: {
    date: string
    timeSlot: string
    morning: string
    afternoon: string
    scheduleNote: string
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
  }
  step4: {
    confirmNote: string
    submitHint: string
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
  }
  footer: { back: string; next: string; confirm: string; submitLine: string }
  staff: {
    unsure: string
    askStaff: string
    splitActivity: string
    formHelp: string
    step4Hint: string
    splitActivityMsg: string
  }
  estimate: { about: string; expand: string; collapse: string }
  pricing: {
    member: string
    guest: string
    firstTime: string
    bothActivities: string
    mixedSkill: string
    waterAbout: (minutes: number) => string
    designatedCoach: (name: string, amount: string) => string
    followBoatLine: (count: number, fee: string) => string
  }
  lineMessage: {
    title: string
    headcount: string
    followBoat: string
    onBoatTotal: string
    firstTimeCount: string
    activity: string
    boat: string
    firstTimeSkill: string
    datesTitle: string
    noDates: string
    coachDesignated: (name: string) => string
    coachDesignatedMissing: string
    coachNone: string
    name: string
    phone: string
    estimate: string
    notes: string
    footer: string
    skillFirstTime: string
    skillExperienced: string
  }
  boat: {
    step1Title: string
    step1Hint: string
    small: string
    big: string
    smallSub: string
    bigSub: string
    largeGroupTitle: string
  }
  reminders: {
    earlyCoach: string
    dualBig: string
    dualSmall: string
    comfort: string
  }
  video: {
    playLabel: string
    cantPlay: string
    close: string
  }
}

export const BOOK_I18N: Record<BookLocale, BookI18nStrings> = {
  zh: {
    header: { brand: 'ES WAKE', title: '線上預約', memberRateHint: '會員價估算' },
    localeToggle: { zh: '中文', en: 'EN' },
    steps: [
      { id: 1, title: '選項目', pill: '項目' },
      { id: 2, title: '幾人玩', pill: '人數' },
      { id: 3, title: '選時間', pill: '時間' },
      { id: 4, title: '確認送出', pill: '送出' },
    ],
    boot: {
      chunk: '載入預約表單…',
      init: '正在啟動…',
      login: '正在連接 LINE…',
      slow: '網路較慢，請稍候…',
      stuck: '載入時間較久。請重新整理，或關閉後再點一次連結。',
      retry: '重新整理',
    },
    notEnabled: { title: '預約表單尚未開放', body: '請繼續使用 LINE 官方帳號填寫預約資訊。' },
    step1: {
      priceSuffix: '已含裝備、教練、船',
      pickPrompt: '請選擇想體驗的項目',
      playMode: {
        WS: '全部人都玩快艇衝浪',
        WB: '全部都玩寬板滑水',
        BOTH: '同一梯次，部分寬板、部分衝浪（固定大船）',
      },
      activities: {
        WS: { labelZh: '快艇衝浪', labelEn: 'Wakesurfing' },
        WB: { labelZh: '寬板滑水', labelEn: 'Wakeboarding' },
        BOTH: { labelZh: '兩個一起', labelEn: 'WB + WS mix' },
      },
      bothShort: '兩個一起',
      bothNote: '請在備註寫各幾人（例：2 寬板、3 衝浪）',
      videoMandarinNote: '影片為中文解說',
      memberRateApplied: '已滑過已套用會員價',
    },
    step2: {
      headcount: '幾人',
      experienceSingle: '是否為體驗／第一次',
      experienceMulti: '其中幾位是體驗／第一次',
      firstTime: '體驗',
      firstTimeNote: '陸上一起上課 · 水上每人20分',
      experienced: '已經滑過',
      experiencedNote: '20 分鐘計價',
      allFirstTime: '全部體驗',
      noneFirstTime: '無體驗',
      nFirstTime: n => `${n} 位體驗`,
      experienceSummary: (headcount, beginnerCount) => {
        if (beginnerCount == null) return '—'
        if (beginnerCount === headcount) return '全部體驗'
        if (beginnerCount === 0) return '無體驗'
        return `${beginnerCount} 位體驗`
      },
      mixedSkillHint: '體驗與已滑過混合，參考價供估算，實際費用小編確認。',
      followBoat: {
        toggle: '有人不玩、想跟船？',
        rule: '親友不滑水可跟船：第 1 位免費，第 2 位起每位 $300。跟船也占船上座位。',
        countLabel: '幾位跟船',
        none: '不需要',
        nFollowers: n => `${n} 位`,
        selected: n => `跟船 ${n} 位`,
        freeHint: '第 1 位跟船免費',
        feeHint: (n, fee) => `跟船 ${n} 位（第 1 位免費）· 估計 +${fee}`,
        onBoatSummary: (riders, follow) => `船上共 ${riders + follow} 人（${riders} 滑水 + ${follow} 跟船）`,
        capacityNote: '跟船計入船上總人數，影響船型與座位安排。',
      },
    },
    step3: {
      date: '日期',
      timeSlot: '時段',
      morning: '上午',
      afternoon: '下午',
      scheduleNote: '時段為偏好，小編回覆後才確認',
      addCoach: '＋ 指定教練（選填 · 8 點前需指定）',
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
    },
    step4: {
      confirmNote: '參考價以小編回覆為準 · 跟船第 2 位起 $300 · 已含裝備教練',
      submitHint: '送出後小編會在 LINE 回覆確認，尚未保留時段',
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
    },
    footer: { back: '返回', next: '下一步', confirm: '確認', submitLine: '用 LINE 送出' },
    staff: {
      unsure: '還是不確定選哪個？',
      askStaff: '問小編',
      splitActivity: '只選衝浪或寬板，但有人想玩另一項？→ 改選「兩個一起」',
      formHelp: '小編可協助',
      step4Hint: '特殊需求可寫備註；表單沒涵蓋的情況再問小編。',
      splitActivityMsg: '我們有人想玩寬板、有人想衝浪（人數各不同，例如 5 人裡 2 位寬板、3 位衝浪），請協助安排與報價。',
    },
    estimate: { about: '約', expand: '看明細', collapse: '收合明細' },
    pricing: {
      member: '會員',
      guest: '非會員',
      firstTime: '初次體驗',
      bothActivities: '混合梯次',
      mixedSkill: '混合（體驗＋已滑過）',
      waterAbout: m => `水上約 ${m} 分`,
      designatedCoach: (name, amount) => `指定 ${name} +${amount}（20 分）`,
      followBoatLine: (count, fee) =>
        count <= 1
          ? `跟船 ${count} 位（第 1 位免費）`
          : `跟船 ${count} 位（第 1 位免費）· +${fee}`,
    },
    lineMessage: {
      title: '🏄 預約需求',
      headcount: '預約人數',
      followBoat: '跟船人數',
      onBoatTotal: '船上共',
      firstTimeCount: '幾位體驗',
      activity: '預約項目',
      boat: '船型',
      firstTimeSkill: '是否是第一次滑',
      datesTitle: '希望預約的日期及時間',
      noDates: '（尚未選擇）',
      coachDesignated: name => `是否指定教練：希望指定 ${name}`,
      coachDesignatedMissing: '是否指定教練：希望指定（未選教練）',
      coachNone: '是否指定教練：不指定，依排班',
      name: '姓名',
      phone: '電話',
      estimate: '費用估算',
      notes: '備註',
      footer: '（此訊息由 ES WAKE 預約表單產生）',
      skillFirstTime: '第一次體驗',
      skillExperienced: '已經滑過',
    },
    boat: {
      step1Title: '偏好哪種船？',
      step1Hint: '1 人也可約',
      small: '小船',
      big: '大船',
      smallSub: '基本型 · 僅寬板',
      bigSub: '空間較大',
      largeGroupTitle: '7 人以上怎麼安排？',
    },
    reminders: {
      earlyCoach: '如欲預約 8 點前時段，需指定教練課程。',
      dualBig: '船上 11 人以上需 2 艘大船，實際安排以小編回覆為準。',
      dualSmall: '船上 7 人以上選小船，需 2 艘小船安排座位。',
      comfort: '大船單艘最多 10 人，船上 8 人以下較為舒適。',
    },
    video: {
      playLabel: '影片',
      cantPlay: '若無法播放，改在 YouTube 開啟',
      close: '關閉',
    },
  },
  en: {
    header: { brand: 'ES WAKE', title: 'Book Online', memberRateHint: 'Member rate estimate' },
    localeToggle: { zh: '中文', en: 'EN' },
    steps: [
      { id: 1, title: 'Activity', pill: 'Activity' },
      { id: 2, title: 'Group', pill: 'Group' },
      { id: 3, title: 'Schedule', pill: 'Time' },
      { id: 4, title: 'Confirm', pill: 'Send' },
    ],
    boot: {
      chunk: 'Loading booking form…',
      init: 'Starting…',
      login: 'Connecting to LINE…',
      slow: 'Slow network, please wait…',
      stuck: 'Taking longer than usual. Refresh or reopen the link.',
      retry: 'Refresh',
    },
    notEnabled: { title: 'Booking not available yet', body: 'Please book via our LINE official account.' },
    step1: {
      priceSuffix: 'Gear, coach & boat included',
      pickPrompt: 'Choose an activity',
      playMode: {
        WS: 'Everyone does wakesurfing',
        WB: 'Everyone does wakeboarding',
        BOTH: 'Same session — some wakeboard, some wakesurf (big boat)',
      },
      activities: {
        WS: { labelZh: 'Wakesurfing', labelEn: 'Wakesurfing' },
        WB: { labelZh: 'Wakeboarding', labelEn: 'Wakeboarding' },
        BOTH: { labelZh: 'Mixed', labelEn: 'WB + WS mix' },
      },
      bothShort: 'Mixed group',
      bothNote: 'Note how many per activity (e.g. 2 WB, 3 WS)',
      videoMandarinNote: 'Video in Mandarin',
      memberRateApplied: 'Member rate applied (returning riders)',
    },
    step2: {
      headcount: 'How many riders',
      experienceSingle: 'First time or experienced?',
      experienceMulti: 'How many first-timers?',
      firstTime: 'First time',
      firstTimeNote: 'Land lesson together · 20 min water each',
      experienced: 'Experienced',
      experiencedNote: 'Priced per 20 min',
      allFirstTime: 'All first-timers',
      noneFirstTime: 'None',
      nFirstTime: n => `${n} first-timer${n > 1 ? 's' : ''}`,
      experienceSummary: (headcount, beginnerCount) => {
        if (beginnerCount == null) return '—'
        if (beginnerCount === headcount) return 'All first-timers'
        if (beginnerCount === 0) return 'All experienced'
        return `${beginnerCount} first-timer${beginnerCount > 1 ? 's' : ''}`
      },
      mixedSkillHint: 'Mixed first-timers & experienced — estimate only; staff will confirm final price.',
      followBoat: {
        toggle: 'Someone not riding but coming along?',
        rule: 'Non-riders may join: 1st free, $300 each from the 2nd. They count toward boat seats.',
        countLabel: 'How many non-riders',
        none: 'None',
        nFollowers: n => `${n}`,
        selected: n => `${n} non-rider${n > 1 ? 's' : ''}`,
        freeHint: 'First non-rider is free',
        feeHint: (n, fee) => `${n} non-rider${n > 1 ? 's' : ''} (1st free) · est. +${fee}`,
        onBoatSummary: (riders, follow) => `${riders + follow} on board (${riders} riding + ${follow} non-riding)`,
        capacityNote: 'Non-riders count toward total seats and may affect boat layout.',
      },
    },
    step3: {
      date: 'Date',
      timeSlot: 'Time preference',
      morning: 'Morning',
      afternoon: 'Afternoon',
      scheduleNote: 'Preference only — confirmed after staff replies',
      addCoach: '+ Request a coach (optional · required before 8 AM)',
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
    },
    step4: {
      confirmNote: 'Estimate only · Extra rider $300 from 2nd · Gear & coach included',
      submitHint: 'Staff will confirm on LINE — slot not held until then',
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
    },
    footer: { back: 'Back', next: 'Next', confirm: 'Review', submitLine: 'Send via LINE' },
    staff: {
      unsure: 'Not sure which to pick?',
      askStaff: 'Ask us',
      splitActivity: 'Group wants both activities? → pick “Mixed” above',
      formHelp: 'Need help?',
      step4Hint: 'Use notes for special requests; ask us if the form does not cover your case.',
      splitActivityMsg: 'We have a split group (e.g. some wakeboard, some wakesurf) — please help arrange and quote.',
    },
    estimate: { about: 'Est.', expand: 'Details', collapse: 'Hide details' },
    pricing: {
      member: 'member',
      guest: 'non-member',
      firstTime: 'First-time package',
      bothActivities: 'Mixed session',
      mixedSkill: 'Mixed (first-timers + experienced)',
      waterAbout: m => `~${m} min on water`,
      designatedCoach: (name, amount) => `Coach ${name} +${amount} (20 min)`,
      followBoatLine: (count, fee) =>
        count <= 1
          ? `Non-riders ${count} (1st free)`
          : `Non-riders ${count} (1st free) · +${fee}`,
    },
    lineMessage: {
      title: '🏄 Booking request',
      headcount: 'Riders',
      followBoat: 'Non-riders',
      onBoatTotal: 'On board',
      firstTimeCount: 'First-timers',
      activity: 'Activity',
      boat: 'Boat',
      firstTimeSkill: 'Experience level',
      datesTitle: 'Preferred date & time',
      noDates: '(not selected)',
      coachDesignated: name => `Coach: request ${name}`,
      coachDesignatedMissing: 'Coach: requested (not selected)',
      coachNone: 'Coach: no preference',
      name: 'Name',
      phone: 'Phone',
      estimate: 'Price estimate',
      notes: 'Notes',
      footer: '(Sent from ES WAKE booking form)',
      skillFirstTime: 'First time',
      skillExperienced: 'Experienced',
    },
    boat: {
      step1Title: 'Boat preference',
      step1Hint: 'Solo riders welcome',
      small: 'Small boat',
      big: 'Big boat',
      smallSub: 'Basic · wakeboard only',
      bigSub: 'More space',
      largeGroupTitle: '7+ riders — boat setup',
    },
    reminders: {
      earlyCoach: 'Sessions before 8 AM require a designated coach.',
      dualBig: '11+ on board may need 2 big boats — staff will confirm.',
      dualSmall: '7+ on board with small boats needs 2 boats for seating.',
      comfort: 'Big boat fits up to 10; 8 or fewer on board is more comfortable.',
    },
    video: {
      playLabel: 'Video',
      cantPlay: 'Open in YouTube if playback fails',
      close: 'Close',
    },
  },
}

export function activityDisplayLabel(code: ActivityChoice, locale: BookLocale): string {
  const a = BOOK_I18N[locale].step1.activities[code]
  return locale === 'en' ? a.labelEn : `${a.labelZh}（${a.labelEn}）`
}

export function activityTitleLabel(code: ActivityCode, locale: BookLocale): string {
  const a = BOOK_I18N[locale].step1.activities[code]
  return locale === 'en' ? a.labelEn : a.labelZh
}

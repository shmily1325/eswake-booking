import type { ActivityChoice, ActivityCode } from './types'
import { ES_BRAND } from '../../../lib/esBrandTokens'

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
    bothCardTitle: string
    bothPrice: (amount: string) => string
    bothShort: string
    mixedToggle: string
    bothNote: string
    bothNoteAction: string
    cardPriceWS: (amount: string) => string
    cardPriceWB: (small: string, big: string) => string
    cardPriceBoth: (amount: string) => string
    videoSectionHeading: string
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
    bothPricingNote: string
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
    estimateExperiencedDetail: (count: number, guest: number) => string
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
    submitHint: string
    messageTooLong: string
    contact: string
    namePh: string
    phonePh: string
    notesPh: string
    notesPhBoth: string
    messagePreviewExpand: string
    messagePreviewCollapse: string
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
    /** Step 1–3 when the step is complete */
    nextByStepReady: readonly [string, string, string]
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
    labelHeadcount: string
    labelActivity: string
    labelDates: string
    labelCoach: string
    labelExperience: string
    labelContact: string
    labelEstimate: string
    labelNotes: string
    experienceLine: (headcount: number, beginnerCount: number | null) => string
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
    earlyCoach: string
    dualSmall: string
    bigBoatDual: string
    bigBoatComfort: string
  }
  video: {
    playLabel: string
    playAria: (title: string) => string
    cantPlay: string
    close: string
  }
  guide: {
    headerTitle: string
    intro: string
    copyAddress: string
    copyAddressDone: string
    lineContact: string
    afterBooking: { title: string; items: readonly string[] }
    cancelPolicy: { title: string; items: readonly string[] }
    whatToBring: {
      title: string
      clothing: { heading: string; items: readonly string[]; avoid: string }
      wetsuit: { heading: string; text: string }
      personal: { heading: string; items: readonly string[] }
      facilities: { heading: string; items: readonly string[] }
    }
    directions: {
      title: string
      addressLabel: string
      address: string
      mapQuery: string
      gateNote: string
      landmark: string
      driving: {
        heading: string
        note: string
        videoLabel: string
      }
      parking: { heading: string; car: string; scooter: string }
      transit: { heading: string; lines: readonly string[]; videoLabel: string }
    }
  }
}

export const BOOK_I18N: Record<BookLocale, BookI18nStrings> = {
  zh: {
    header: { brand: ES_BRAND.name, title: ES_BRAND.bookingAreaLabel, memberRateHint: '會員價估算' },
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
      bothCardTitle: '混搭兩項',
      bothPrice: amount => `每項 ${amount}／人`,
      bothShort: '快艇衝浪＋寬板滑水',
      mixedToggle: '有人衝浪、有人滑水？',
      bothNote: '同一梯次可混搭 · 自己兩項都玩也行',
      bothNoteAction: '點上方項目可改回選單一種',
      cardPriceWS: amount => `初次 ${amount}`,
      cardPriceWB: (small, big) => `初次 ${small}～${big}`,
      cardPriceBoth: amount => `每項 ${amount}`,
      videoSectionHeading: '不確定？先看起滑影片',
      videoMandarinNote: '點擊播放（中文）',
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
      bothPricingNote: '混搭梯次：依各人實際玩的項目計價',
      experienced: '已經滑過',
      experiencedNote: '水上每人 20 分鐘計價',
      firstTimeUnitPrice: amount => `體驗 ${amount}／人`,
      firstTimeUnitPricePerActivity: amount => `體驗 每項 ${amount}／人`,
      sessionDualPrice: (guest, member) =>
        `$${guest.toLocaleString()}（會員 $${member.toLocaleString()}）`,
      pricingLegendFirstTimeWB: (small, big) =>
        `體驗 小船 $${small.toLocaleString()} · 大船 $${big.toLocaleString()}`,
      pricingLegendFirstTimeBig: price =>
        `體驗 $${price.toLocaleString()}／人`,
      pricingLegendExperiencedWB: (_blockMin, smallGuest, smallMember, bigGuest, bigMember) => {
        const dual = (g: number, m: number) => `$${g.toLocaleString()}（會員 $${m.toLocaleString()}）`
        return `已滑過 小船 ${dual(smallGuest, smallMember)} · 大船 ${dual(bigGuest, bigMember)}`
      },
      pricingLegendExperiencedBig: (_blockMin, guest, member) =>
        `已滑過 $${guest.toLocaleString()}（會員 $${member.toLocaleString()}）`,
      estimateExperiencedDetail: (count, guest) =>
        `${count} 已滑過 × $${guest.toLocaleString()}`,
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
      removeDate: '移除',
    },
    step4: {
      summaryTitle: '你的預約內容',
      labelActivity: '項目',
      labelPeople: '人數',
      labelBoat: '船型',
      labelDates: '日期',
      labelCoach: '教練',
      submitHint: '小編回信後才確認時段與價格',
      messageTooLong: '訊息過長，請精簡備註後再試',
      contact: '姓名與電話',
      namePh: '姓名',
      phonePh: '電話',
      notesPh: '特殊需求（選填）',
      notesPhBoth: '各幾人玩什麼（例：2 人寬板滑水、3 人快艇衝浪）· 特殊需求',
      messagePreviewExpand: '預覽將傳給小編的訊息',
      messagePreviewCollapse: '收合預覽',
      attireLink: '行前須知（預約提醒、改期、穿著、交通）→',
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
      title: `${ES_BRAND.name} 預約`,
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
      nextByStepReady: ['下一步：填人數', '下一步：選時間', '下一步：看摘要'],
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
      labelHeadcount: '預約人數：',
      labelActivity: '預約項目：',
      labelDates: '希望預約的日期及時間：',
      labelCoach: '是否指定教練：',
      labelExperience: '是否是第一次滑：',
      labelContact: '聯絡人：',
      labelEstimate: '參考價：',
      labelNotes: '備註：',
      experienceLine: (headcount, beginnerCount) => {
        if (beginnerCount == null) return '—'
        if (beginnerCount >= headcount) {
          return headcount === 1 ? '是' : '是（全部）'
        }
        if (beginnerCount === 0) {
          return headcount === 1 ? '否（已滑過）' : '否（全部已滑過）'
        }
        return `${beginnerCount} 位第一次、${headcount - beginnerCount} 位已滑過`
      },
      coachLine: name => `教練 ${name}`,
      coachNone: '不指定',
      coachMissing: '待指定',
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
      earlyCoach: '如欲預約 8 點前時段，需指定教練。',
      dualSmall: '船上 7 人以上選小船，需 2 艘小船安排座位。',
      bigBoatDual: '大船每艘最多 10 人，11 人以上需 2 艘，實際安排以小編回覆為準。',
      bigBoatComfort: '9～10 人較擠，8 人以下較舒適。',
    },
    video: {
      playLabel: '影片',
      playAria: title => `播放${title}`,
      cantPlay: '若無法播放，改在 YouTube 開啟',
      close: '關閉',
    },
    guide: {
      headerTitle: ES_BRAND.guideAreaLabel,
      intro: '出發前請先看這裡：預約提醒、改期規則、穿著準備與交通方式。',
      copyAddress: '複製地址',
      copyAddressDone: '已複製',
      lineContact: '有疑問？官方 LINE 詢問',
      afterBooking: {
        title: '預約完成注意事項',
        items: [
          '請記得預約的日期和時間。',
          '請準時抵達，以免影響活動時間及下組客人。預約日前一天，官方會再發送提醒通知。',
          '現場販售水上相關用品（衝浪褲、防曬帽、防曬乳、拖鞋等）與啤酒，若有需要請直接告知客服小幫手。',
        ],
      },
      cancelPolicy: {
        title: '取消與更改預約',
        items: [
          '出發日 4～6 天前（不含出發日）可改期一次；改期後恕不接受取消。',
          '出發日 3 天內（含當日）不接受改期。',
          '遇天候不佳請先來訊確認。八里臨海，天氣常與市區不同，市區下雨但八里可能是晴天。',
        ],
      },
      whatToBring: {
        title: '服裝與隨身物品建議',
        clothing: {
          heading: '衣物',
          items: ['背心、短袖上衣、泳裝、衝浪褲、短褲（不吸水材質皆可）'],
          avoid: '✖ 不建議攜帶下水：泳鏡、眼鏡、飾品',
        },
        wetsuit: { heading: '冬季', text: '現場提供防寒衣。' },
        personal: {
          heading: '個人用品',
          items: ['防曬乳、浴（毛）巾、換洗衣物（請自行攜帶）'],
        },
        facilities: {
          heading: '設施提供',
          items: ['廠房內有沐浴乳、洗髮精、吹風機、脫水機'],
        },
      },
      directions: {
        title: '地址與交通資訊',
        addressLabel: '地址',
        address: '新北市八里區龍米路一段170號之1',
        mapQuery: '新北市八里區龍米路一段170號之1',
        gateNote: '請注意！出入口為停車場鐵門，抵達後請透過官方 LINE 通知，將為你開啟鐵門。',
        landmark: '出入口位於大橋遊艇公司右側，7-11 神州門市正對面。',
        driving: {
          heading: '開車或騎車',
          note: '同一支影片：大度路 0:00–1:25 · 成泰路 1:26–',
          videoLabel: '路線影片',
        },
        parking: {
          heading: '停車',
          car: `汽車：請停畫有 ${ES_BRAND.name} 1～15 的車格`,
          scooter: '機車：請直接騎至廠房內停車',
        },
        transit: {
          heading: '公車',
          lines: ['捷運至「關渡站」→ 轉乘紅 13 或紅 22 →「關渡大橋站」下車'],
          videoLabel: '公車路線短片',
        },
      },
    },
  },
  en: {
    header: { brand: ES_BRAND.name, title: 'Book Online', memberRateHint: 'Member rate estimate' },
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
      bothCardTitle: 'Mix both',
      bothPrice: amount => `${amount}/activity/person`,
      bothShort: 'Wakesurf + wakeboard',
      mixedToggle: 'Some wakesurf, some wakeboard?',
      bothNote: 'Mixed group on same trip · Or play both yourself',
      bothNoteAction: 'Tap an activity above to pick just one',
      cardPriceWS: amount => `First-time ${amount}`,
      cardPriceWB: (small, big) => `First-time ${small}–${big}`,
      cardPriceBoth: amount => `${amount} per activity`,
      videoSectionHeading: 'Not sure? Watch demo videos',
      videoMandarinNote: 'Tap to play (Mandarin)',
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
      bothPricingNote: 'Mixed trip: priced per activity each rider plays',
      experienced: 'Experienced',
      experiencedNote: '20 min water, time-based rate',
      firstTimeUnitPrice: amount => `First-timer ${amount}/person`,
      firstTimeUnitPricePerActivity: amount => `First-timer ${amount}/activity/person`,
      sessionDualPrice: (guest, member) =>
        `$${guest.toLocaleString()} (member $${member.toLocaleString()})`,
      pricingLegendFirstTimeWB: (small, big) =>
        `First-timer small boat $${small.toLocaleString()} · big boat $${big.toLocaleString()}`,
      pricingLegendFirstTimeBig: price =>
        `First-timer $${price.toLocaleString()}/person`,
      pricingLegendExperiencedWB: (_blockMin, smallGuest, smallMember, bigGuest, bigMember) => {
        const dual = (g: number, m: number) => `$${g.toLocaleString()} (member $${m.toLocaleString()})`
        return `Returning small ${dual(smallGuest, smallMember)} · big ${dual(bigGuest, bigMember)}`
      },
      pricingLegendExperiencedBig: (_blockMin, guest, member) =>
        `Returning $${guest.toLocaleString()} (member $${member.toLocaleString()})`,
      estimateExperiencedDetail: (count, guest) =>
        `${count} returning × $${guest.toLocaleString()}`,
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
      removeDate: 'Remove',
    },
    step4: {
      summaryTitle: 'Your request',
      labelActivity: 'Activity',
      labelPeople: 'Riders',
      labelBoat: 'Boat',
      labelDates: 'Dates',
      labelCoach: 'Coach',
      submitHint: 'Date and price confirmed after we reply',
      messageTooLong: 'Message too long — shorten notes and try again.',
      contact: 'Name & phone',
      namePh: 'Name',
      phonePh: 'Phone',
      notesPh: 'Special requests (optional)',
      notesPhBoth: 'Headcount per activity (e.g. 2 wakeboard, 3 wakesurf) · special requests',
      messagePreviewExpand: 'Preview LINE message to staff',
      messagePreviewCollapse: 'Hide preview',
      attireLink: 'Visit guide (booking, changes, attire, directions) →',
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
      title: `${ES_BRAND.name} Booking`,
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
      nextByStepReady: ['Next: Group size', 'Next: Pick dates', 'Next: Review'],
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
      labelHeadcount: 'Riders: ',
      labelActivity: 'Activity: ',
      labelDates: 'Preferred date & time: ',
      labelCoach: 'Coach preference: ',
      labelExperience: 'First time?: ',
      labelContact: 'Contact: ',
      labelEstimate: 'Estimate: ',
      labelNotes: 'Notes: ',
      experienceLine: (headcount, beginnerCount) => {
        if (beginnerCount == null) return '—'
        if (beginnerCount >= headcount) {
          return headcount === 1 ? 'Yes' : 'Yes (all)'
        }
        if (beginnerCount === 0) {
          return headcount === 1 ? 'No (experienced)' : 'No (all experienced)'
        }
        return `${beginnerCount} first-timer${beginnerCount > 1 ? 's' : ''}, ${headcount - beginnerCount} experienced`
      },
      coachLine: name => `Coach ${name}`,
      coachNone: 'No preference',
      coachMissing: 'TBD',
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
      earlyCoach: 'Sessions before 8 AM require a designated coach.',
      dualSmall: '7+ on board with small boats needs 2 boats for seating.',
      bigBoatDual: 'Big boat holds up to 10; 11+ may need 2 boats — staff will confirm.',
      bigBoatComfort: '9–10 can feel tight; 8 or fewer is more comfortable.',
    },
    video: {
      playLabel: 'Video',
      playAria: title => `Play ${title}`,
      cantPlay: 'Open in YouTube if playback fails',
      close: 'Close',
    },
    guide: {
      headerTitle: 'Visit guide',
      intro: 'Before you go: booking reminders, changes/cancel, what to wear, and directions.',
      copyAddress: 'Copy address',
      copyAddressDone: 'Copied',
      lineContact: 'Questions? Message us on LINE',
      afterBooking: {
        title: 'After you book',
        items: [
          'Remember your confirmed date and time.',
          'Please arrive on time so we can run on schedule for you and the next group. We send a reminder the day before.',
          'We sell watersports gear (board shorts, hats, sunscreen, flip-flops) and beer on site — ask staff if you need anything.',
        ],
      },
      cancelPolicy: {
        title: 'Changes & cancellation',
        items: [
          '4–6 days before (not counting session day): one date change; no cancellation after a change.',
          '3 days before through session day: no date changes.',
          'If weather looks uncertain, message us first. Bali’s coast often differs from Taipei — sunny here while it rains in the city.',
        ],
      },
      whatToBring: {
        title: 'What to wear & bring',
        clothing: {
          heading: 'Clothing',
          items: ['Tank top, tee, swimsuit, board shorts, quick-dry shorts — non-absorbent fabrics'],
          avoid: '✖ Do not bring in the water: goggles, glasses, jewelry',
        },
        wetsuit: { heading: 'Winter', text: 'Wetsuits available on site.' },
        personal: {
          heading: 'Personal items',
          items: ['Sunscreen, towel, change of clothes (bring your own)'],
        },
        facilities: {
          heading: 'On site',
          items: ['Body wash, shampoo, hair dryers, spin dryer in the facility'],
        },
      },
      directions: {
        title: 'Address & directions',
        addressLabel: 'Address',
        address: 'No. 170-1, Sec. 1, Longmi Rd., Bali Dist., New Taipei City',
        mapQuery: '新北市八里區龍米路一段170號之1',
        gateNote: 'Entrance is a parking-lot gate. Message us on LINE when you arrive and we will open it.',
        landmark: 'Entrance is to the right of Daqiao Yacht, across from 7-Eleven Shenzhou.',
        driving: {
          heading: 'By car or scooter',
          note: 'One video: Dadu Rd 0:00–1:25 · Chengtai Rd 1:26–',
          videoLabel: 'Driving directions',
        },
        parking: {
          heading: 'Parking',
          car: `Cars: spaces marked ${ES_BRAND.name} 1–15`,
          scooter: 'Scooters: ride into the facility to park',
        },
        transit: {
          heading: 'Bus',
          lines: ['MRT Guandu → bus R13 or R22 → Guandu Bridge stop'],
          videoLabel: 'Bus route (short video)',
        },
      },
    },
  },
}

/** Footer CTA for steps 1–3: guided label toward the next step (not generic「下一步」). */
export function getStepNextLabel(
  step: number,
  footer: BookI18nStrings['footer'],
  stepReady = false,
): string {
  if (step >= 1 && step <= 3) {
    return stepReady ? footer.nextByStepReady[step - 1] : footer.nextByStep[step - 1]
  }
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

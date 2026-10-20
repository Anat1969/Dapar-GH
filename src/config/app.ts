// הגדרות הפרויקט. כל ערך כאן ניתן לשינוי בלי לגעת בלוגיקה.

export const APP_NAME = 'דפ"ר עילאי'

/** יעד ציון ברירת מחדל. מדד פנימי בלבד. */
export const TARGET_SCORE = 90

/** תאריך המבחן ותחילת התוכנית (לפי docs/03). */
export const EXAM_DATE = '2026-10-29'
export const PLAN_START = '2026-10-21'

export const INTERNAL_SCORE_LABEL = 'מדד פנימי, לא ציון רשמי'

/** ספי מעבר בין שכבות (docs/02). */
export const MASTERY = {
  toUnderstanding: { minAnswers: 15, window: 6, minAccuracy: 0.85 },
  toApplication: { minAnswers: 10, window: 8, minAccuracy: 0.75 },
  stuck: { window: 10, maxAccuracy: 0.6 },
  repeatErrorThreshold: 3,
  resolveStreak: 2,
} as const

/** משקלי זמן לפי תחום (docs/02). */
export const DOMAIN_WEIGHTS = {
  verbal: 0.55,
  quant: 0.25,
  figural: 0.1,
  instructions: 0.1,
} as const

/** סשן יומי: דקות לכל חלק (CLAUDE.md, עיקרון 8). */
export const DAILY_BLOCKS = { repair: 10, material: 35, apply: 15 } as const

/** מבחן מדומה: מספר שאלות ודקות לכל פרק. */
export const MOCK_SECTIONS = {
  verbal: { questions: 14, minutes: 16 },
  quant: { questions: 10, minutes: 15 },
  figural: { questions: 8, minutes: 10 },
  instructions: { questions: 8, minutes: 8 },
} as const

/** אבחון יום 1: 40 דקות מבחן בכל התחומים. */
export const DIAGNOSTIC_SECTIONS = {
  verbal: { questions: 10, minutes: 14 },
  quant: { questions: 8, minutes: 12 },
  figural: { questions: 6, minutes: 7 },
  instructions: { questions: 6, minutes: 7 },
} as const

/** זמן ברירת מחדל לשאלת יישום, כשאין לשאלה זמן משלה. */
export const DEFAULT_APPLY_SECONDS = 60

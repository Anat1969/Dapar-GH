import { EXAM_DATE, PLAN_START } from '../config/app'
import type { Domain, Layer } from './types'

export type DayMode = 'prep' | 'diagnostic' | 'daily' | 'mock_partial' | 'mock_full' | 'review' | 'exam_day' | 'after'

export interface PlanDay {
  day: number
  date: string
  weekday: string
  mode: DayMode
  title: string
  focus: { domain: Domain; layer: Layer }[]
  apply?: Domain
  note?: string
}

/** התוכנית לפי docs/03. */
export const PLAN: PlanDay[] = [
  { day: 1, date: '2026-10-21', weekday: "ג'", mode: 'diagnostic', title: 'אבחון מעורב בכל התחומים', focus: [], note: 'בלי ציון, רק מדידה ראשונית. 40 דקות מבחן, 20 דקות סיכום טעויות.' },
  { day: 2, date: '2026-10-22', weekday: "ד'", mode: 'daily', title: 'מילולי: הבנת הנקרא, שכבת ידע', focus: [{ domain: 'verbal', layer: 'knowledge' }], apply: 'verbal', note: 'מילולי מקבל את רוב הזמן.' },
  { day: 3, date: '2026-10-23', weekday: "ה'", mode: 'daily', title: 'מילולי: השלמת משפטים וניסוח. הבנת הוראות', focus: [{ domain: 'verbal', layer: 'understanding' }, { domain: 'instructions', layer: 'knowledge' }], apply: 'instructions' },
  { day: 4, date: '2026-10-24', weekday: 'שישי', mode: 'daily', title: 'מילולי: הבנה ויישום קל. כמותי לפי האבחון', focus: [{ domain: 'verbal', layer: 'understanding' }, { domain: 'quant', layer: 'knowledge' }], apply: 'verbal', note: 'יום קל יותר.' },
  { day: 5, date: '2026-10-25', weekday: "א'", mode: 'mock_partial', title: 'מבחן מדומה חלקי: מילולי', focus: [{ domain: 'verbal', layer: 'application' }], note: 'מחליף את היום. תיקון טעויות אחריו.' },
  { day: 6, date: '2026-10-26', weekday: "ב'", mode: 'daily', title: 'כמותי: אחוזים, יחסים, בעיות מילוליות. צורני: תחזוקה', focus: [{ domain: 'quant', layer: 'understanding' }, { domain: 'figural', layer: 'knowledge' }], apply: 'quant' },
  { day: 7, date: '2026-10-27', weekday: "ג'", mode: 'mock_full', title: 'מבחן מדומה מלא במחשב', focus: [], note: 'עם טיימר לכל פרק. מומלץ בבוקר.' },
  { day: 8, date: '2026-10-28', weekday: "ד'", mode: 'review', title: 'תיקון לפי המבחן המלא. יישום בזמן בנושאים החלשים', focus: [], note: 'בלי חומר חדש. יום מנוחה חלקי.' },
  { day: 9, date: '2026-10-29', weekday: "ה'", mode: 'exam_day', title: 'יום המבחן', focus: [], note: 'בבוקר: תיקון טעויות בלבד, 10 דקות. לאמת את שעת המבחן מול הנוסח הרשמי.' },
]

export function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000)

/** 0: לפני התוכנית. 1 עד 9: יום בתוכנית. 10: אחרי המבחן. */
export function planDayIndex(today: string) {
  const n = dayDiff(today, PLAN_START) + 1
  if (n < 1) return 0
  if (n > PLAN.length) return PLAN.length + 1
  return n
}

export function daysToExam(today: string) {
  return dayDiff(EXAM_DATE, today)
}

export function todayPlan(today: string): PlanDay {
  const idx = planDayIndex(today)
  if (idx === 0) {
    return { day: 0, date: today, weekday: '', mode: 'prep', title: 'ערב הכנה', focus: [{ domain: 'verbal', layer: 'knowledge' }], note: 'התוכנית מתחילה מחר באבחון. אפשר להתחיל אותו כבר עכשיו, או לתרגל חופשי.' }
  }
  if (idx > PLAN.length) {
    return { day: idx, date: today, weekday: '', mode: 'after', title: 'המבחן מאחוריך', focus: [], note: 'אפשר להמשיך לתרגל חופשי.' }
  }
  return PLAN[idx - 1]
}

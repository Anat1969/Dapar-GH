import { MASTERY } from '../config/app'
import type { Domain, ErrorNote, ErrorType, Question, ScoredItem } from './types'

export interface ErrorGroup {
  key: string
  skill: string
  domain: Domain
  type: ErrorType
  count: number
  lastAt: string
  hasNote: boolean
  resolved: boolean
  questionIds: string[]
}

export const groupKey = (skill: string, type: ErrorType) => `${skill}::${type}`

const byTime = (a: ScoredItem, b: ScoredItem) => a.answered_at.localeCompare(b.answered_at)

export function hasNote(notes: ErrorNote[], skill: string, type: ErrorType) {
  return notes.some((n) => n.skill === skill && n.error_type === type)
}

/** כמה פעמים טעה באותו נושא ובאותו סוג. */
export function repeatCount(items: ScoredItem[], skill: string, type: ErrorType) {
  return items.filter((i) => !i.is_correct && i.error_type === type && i.q.skill === skill).length
}

/** במופע השלישי (ומעלה) בלי ניסוח שמור: עוצרים ומבקשים ניסוח. */
export function needsRestatement(items: ScoredItem[], notes: ErrorNote[], skill: string, type: ErrorType) {
  return repeatCount(items, skill, type) >= MASTERY.repeatErrorThreshold && !hasNote(notes, skill, type)
}

/** אחרי הטעות האחרונה בנושא: שתי תשובות נכונות ברצף בנושא. */
export function correctStreakAfterLastError(items: ScoredItem[], skill: string) {
  const list = items.filter((i) => i.q.skill === skill).sort(byTime)
  let streak = 0
  for (let k = list.length - 1; k >= 0; k--) {
    if (list[k].is_correct) streak++
    else break
  }
  return streak
}

export function errorGroups(items: ScoredItem[], notes: ErrorNote[]): ErrorGroup[] {
  const map = new Map<string, ErrorGroup>()
  for (const i of [...items].sort(byTime)) {
    if (i.is_correct || i.error_type === 'none') continue
    const key = groupKey(i.q.skill, i.error_type)
    const g = map.get(key) ?? {
      key, skill: i.q.skill, domain: i.q.domain, type: i.error_type, count: 0, lastAt: i.answered_at,
      hasNote: false, resolved: false, questionIds: [],
    }
    g.count++
    g.lastAt = i.answered_at
    if (!g.questionIds.includes(i.question_id)) g.questionIds.push(i.question_id)
    map.set(key, g)
  }
  for (const g of map.values()) {
    g.hasNote = hasNote(notes, g.skill, g.type)
    const needNote = g.count >= MASTERY.repeatErrorThreshold
    g.resolved = correctStreakAfterLastError(items, g.skill) >= MASTERY.resolveStreak && (!needNote || g.hasNote)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
}

/** תור תיקון: קבוצות שלא טופלו. טעויות הוראה קודם, כי הן דורשות קריאה לפני פתרון. */
export function repairQueue(items: ScoredItem[], notes: ErrorNote[]) {
  return errorGroups(items, notes).filter((g) => !g.resolved)
}

export function hasOpenUnderstandingError(items: ScoredItem[], notes: ErrorNote[], domain: Domain) {
  return repairQueue(items, notes).some((g) => g.domain === domain && g.type === 'understanding')
}

export function dominantErrorType(items: { is_correct: boolean; error_type: ErrorType | 'none' }[]): ErrorType | null {
  const counts = new Map<ErrorType, number>()
  for (const i of items) {
    if (i.is_correct || i.error_type === 'none') continue
    counts.set(i.error_type, (counts.get(i.error_type) ?? 0) + 1)
  }
  let best: ErrorType | null = null
  let max = 0
  for (const [t, c] of counts) if (c > max) { best = t; max = c }
  return best
}

/** הצעה ראשונית לסוג הטעות. עילאי יכול לשנות. */
export function suggestErrorType(q: Question, secondsTaken: number | null, timedOut: boolean): ErrorType {
  if (timedOut) return 'time'
  if (q.time_limit_seconds && secondsTaken && secondsTaken > q.time_limit_seconds) return 'time'
  if (q.domain === 'instructions' || q.instruction_text) return 'instruction'
  if (q.domain === 'quant' && q.layer !== 'knowledge') return 'calculation'
  if (q.layer === 'understanding') return 'understanding'
  return 'knowledge'
}

/** מילות מפתח בהוראה, לסימון (docs/02). */
export const INSTRUCTION_KEYWORDS = ['לא', 'אינו', 'אינה', 'אינם', 'לפחות', 'לכל היותר', 'בדיוק', 'מתוך', 'רק', 'כל', 'פחות', 'יותר', 'שני', 'אחרון', 'ראשון', 'הפוך']

export function splitByKeywords(text: string): { t: string; k: boolean }[] {
  const sorted = [...INSTRUCTION_KEYWORDS].sort((a, b) => b.length - a.length)
  const re = new RegExp(`(^|[\\s,.:;"'(])(${sorted.join('|')})(?=[\\s,.:;"')?!]|$)`, 'g')
  const out: { t: string; k: boolean }[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length
    if (start > last) out.push({ t: text.slice(last, start), k: false })
    out.push({ t: m[2], k: true })
    last = start + m[2].length
  }
  if (last < text.length) out.push({ t: text.slice(last), k: false })
  return out
}

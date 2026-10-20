import type { ErrorType, ScoredItem } from './types'
import { ERROR_NAME, ERROR_REMEDY } from './types'
import { accuracy } from './mastery'
import { dominantErrorType } from './errors'

export interface SessionReport {
  improved: string[]
  strengthen: string[]
  dominant: ErrorType | null
  dominantName: string | null
  nextStep: string
  total: number
  correct: number
}

const groupBySkill = (items: ScoredItem[]) => {
  const m = new Map<string, ScoredItem[]>()
  for (const i of items) m.set(i.q.skill, [...(m.get(i.q.skill) ?? []), i])
  return m
}

/** דוח סוף סשן: שלושה שהשתפרו, שלושה לחיזוק, סוג טעות דומיננטי, צעד הבא. */
export function sessionReport(session: ScoredItem[], before: ScoredItem[]): SessionReport {
  const now = groupBySkill(session)
  const prev = groupBySkill(before)
  const scored = [...now.entries()].map(([skill, list]) => {
    const acc = accuracy(list)
    const p = prev.get(skill)
    const delta = p && p.length ? acc - accuracy(p) : acc - 0.5
    return { skill, acc, delta, n: list.length }
  })
  const improved = scored
    .filter((s) => s.acc > 0 && s.delta >= 0)
    .sort((a, b) => b.delta - a.delta || b.acc - a.acc)
    .slice(0, 3)
    .map((s) => s.skill)
  const strengthen = scored
    .filter((s) => s.acc < 1)
    .sort((a, b) => a.acc - b.acc || b.n - a.n)
    .slice(0, 3)
    .map((s) => s.skill)
  const dominant = dominantErrorType(session)
  const weakest = strengthen[0]
  const nextStep = weakest
    ? `לחזור לנושא "${weakest}". ${dominant ? ERROR_REMEDY[dominant] : ''}`.trim()
    : 'להמשיך לפי תוכנית היום. אין נושא פתוח לחיזוק מהסשן הזה.'
  return {
    improved, strengthen, dominant, dominantName: dominant ? ERROR_NAME[dominant] : null, nextStep,
    total: session.length, correct: session.filter((i) => i.is_correct).length,
  }
}

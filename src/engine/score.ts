import { DOMAIN_WEIGHTS } from '../config/app'
import type { Domain, ScoredItem } from './types'

/**
 * ציון משוער פנימי. מדד ליניארי בתוך התחום, 0 עד 100.
 * לא סולם רשמי ולא תחזית. תמיד מוצג עם הכיתוב "מדד פנימי, לא ציון רשמי".
 * משקל לפי קושי: שאלה קשה שווה יותר. שאלה שלא נענתה נספרת כשגויה.
 */
const DIFF_WEIGHT = { 1: 1, 2: 1.25, 3: 1.5 } as const

export function domainEstimate(items: ScoredItem[]): number | null {
  if (!items.length) return null
  let got = 0
  let total = 0
  for (const i of items) {
    const w = DIFF_WEIGHT[i.q.difficulty] ?? 1
    total += w
    if (i.is_correct) got += w
  }
  return Math.round((got / total) * 100)
}

export interface Estimate {
  overall: number | null
  byDomain: Partial<Record<Domain, number>>
}

export function estimate(items: ScoredItem[]): Estimate {
  const byDomain: Partial<Record<Domain, number>> = {}
  let sum = 0
  let wsum = 0
  for (const d of Object.keys(DOMAIN_WEIGHTS) as Domain[]) {
    const v = domainEstimate(items.filter((i) => i.q.domain === d))
    if (v === null) continue
    byDomain[d] = v
    sum += v * DOMAIN_WEIGHTS[d]
    wsum += DOMAIN_WEIGHTS[d]
  }
  return { overall: wsum ? Math.round(sum / wsum) : null, byDomain }
}

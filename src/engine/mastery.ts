import { MASTERY } from '../config/app'
import type { Domain, Layer, ScoredItem } from './types'

const byTime = (a: ScoredItem, b: ScoredItem) => a.answered_at.localeCompare(b.answered_at)

export function layerItems(items: ScoredItem[], domain: Domain, layer: Layer) {
  return items.filter((i) => i.q.domain === domain && i.q.layer === layer).sort(byTime)
}

export function accuracy(items: { is_correct: boolean }[]) {
  if (!items.length) return 0
  return items.filter((i) => i.is_correct).length / items.length
}

export function recentAccuracy(items: ScoredItem[], window: number) {
  return accuracy(items.slice(-window))
}

export interface LayerStatus {
  layer: Layer
  answered: number
  recent: number
  unlocked: boolean
  passed: boolean
  stuck: boolean
  /** התקדמות לכיוון הסף, 0 עד 1. לתצוגה בלבד. */
  progress: number
}

/** האם השכבה עברה את סף המעבר לשכבה הבאה. */
export function layerPassed(items: ScoredItem[], domain: Domain, layer: Layer, hasOpenUnderstandingError = false) {
  const list = layerItems(items, domain, layer)
  if (layer === 'knowledge') {
    const r = MASTERY.toUnderstanding
    return list.length >= r.minAnswers && recentAccuracy(list, r.window) >= r.minAccuracy
  }
  if (layer === 'understanding') {
    const r = MASTERY.toApplication
    return list.length >= r.minAnswers && recentAccuracy(list, r.window) >= r.minAccuracy && !hasOpenUnderstandingError
  }
  return false
}

/** ידע תמיד פתוח. הבנה נפתחת אחרי ידע. יישום נפתח רק אחרי ידע והבנה. */
export function isUnlocked(items: ScoredItem[], domain: Domain, layer: Layer, hasOpenUnderstandingError = false) {
  if (layer === 'knowledge') return true
  const k = layerPassed(items, domain, 'knowledge')
  if (layer === 'understanding') return k
  return k && layerPassed(items, domain, 'understanding', hasOpenUnderstandingError)
}

/** נתקע: דיוק מתחת ל-60 אחוז בעשר התשובות האחרונות בשכבה. */
export function isStuck(items: ScoredItem[], domain: Domain, layer: Layer) {
  const list = layerItems(items, domain, layer)
  const r = MASTERY.stuck
  return list.length >= r.window && recentAccuracy(list, r.window) < r.maxAccuracy
}

const prevLayer: Record<Layer, Layer> = { knowledge: 'knowledge', understanding: 'knowledge', application: 'understanding' }

export function layerStatus(items: ScoredItem[], domain: Domain, hasOpenUnderstandingError = false): LayerStatus[] {
  const k = layerItems(items, domain, 'knowledge')
  const u = layerItems(items, domain, 'understanding')
  const a = layerItems(items, domain, 'application')
  const kr = MASTERY.toUnderstanding
  const ur = MASTERY.toApplication
  const prog = (n: number, need: number, acc: number, needAcc: number) =>
    Math.min(1, 0.5 * Math.min(1, n / need) + 0.5 * Math.min(1, acc / needAcc))
  const kPassed = layerPassed(items, domain, 'knowledge')
  const uPassed = layerPassed(items, domain, 'understanding', hasOpenUnderstandingError)
  return [
    {
      layer: 'knowledge', answered: k.length, recent: recentAccuracy(k, kr.window), unlocked: true, passed: kPassed,
      stuck: isStuck(items, domain, 'knowledge'),
      progress: kPassed ? 1 : prog(k.length, kr.minAnswers, recentAccuracy(k, kr.window), kr.minAccuracy),
    },
    {
      layer: 'understanding', answered: u.length, recent: recentAccuracy(u, ur.window), unlocked: kPassed, passed: uPassed,
      stuck: isStuck(items, domain, 'understanding'),
      progress: !kPassed ? 0 : uPassed ? 1 : prog(u.length, ur.minAnswers, recentAccuracy(u, ur.window), ur.minAccuracy),
    },
    {
      layer: 'application', answered: a.length, recent: recentAccuracy(a, 10), unlocked: kPassed && uPassed, passed: false,
      stuck: isStuck(items, domain, 'application'),
      progress: !(kPassed && uPassed) ? 0 : Math.min(1, 0.5 * Math.min(1, a.length / 20) + 0.5 * recentAccuracy(a, 10)),
    },
  ]
}

/**
 * השכבה שבה כדאי לתרגל עכשיו בתחום.
 * wanted: השכבה שהתוכנית מבקשת. אם היא נעולה, יורדים לשכבה הפתוחה הגבוהה ביותר.
 * אם נתקעים בשכבה, חוזרים שכבה אחת אחורה.
 */
export function recommendedLayer(
  items: ScoredItem[], domain: Domain, wanted: Layer = 'application', hasOpenUnderstandingError = false,
): { layer: Layer; reason: 'ok' | 'locked' | 'stuck' } {
  const order: Layer[] = ['knowledge', 'understanding', 'application']
  let idx = order.indexOf(wanted)
  let reason: 'ok' | 'locked' | 'stuck' = 'ok'
  while (idx > 0 && !isUnlocked(items, domain, order[idx], hasOpenUnderstandingError)) {
    idx--
    reason = 'locked'
  }
  const layer = order[idx]
  if (layer !== 'knowledge' && isStuck(items, domain, layer)) {
    return { layer: prevLayer[layer], reason: 'stuck' }
  }
  return { layer, reason }
}

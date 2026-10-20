import { describe, expect, it } from 'vitest'
import { isStuck, isUnlocked, layerStatus, recommendedLayer } from './mastery'
import { many, q } from './testkit'

const K = q('verbal', 'knowledge')
const U = q('verbal', 'understanding')
const A = q('verbal', 'application')
const all = (n: number, c = true) => Array(n).fill(c)

describe('שער השכבות', () => {
  it('ידע תמיד פתוח', () => {
    expect(isUnlocked([], 'verbal', 'knowledge')).toBe(true)
  })
  it('הבנה נעולה עד 15 שאלות ידע ודיוק 85 אחוז בשש האחרונות', () => {
    expect(isUnlocked(many(K, all(14)), 'verbal', 'understanding')).toBe(false)
    expect(isUnlocked(many(K, all(15)), 'verbal', 'understanding')).toBe(true)
  })
  it('הבנה נעולה כשהדיוק בשש האחרונות נמוך', () => {
    const items = many(K, [...all(12), true, false, true, true, false, true])
    expect(isUnlocked(items, 'verbal', 'understanding')).toBe(false)
  })
  it('יישום נעול לפני ידע והבנה', () => {
    expect(isUnlocked(many(U, all(20)), 'verbal', 'application')).toBe(false)
    const items = [...many(K, all(15)), ...many(U, all(9))]
    expect(isUnlocked(items, 'verbal', 'application')).toBe(false)
  })
  it('יישום נפתח אחרי 10 הבנה ו-75 אחוז בשמונה האחרונות', () => {
    const items = [...many(K, all(15)), ...many(U, [...all(4), true, true, false, true, true, true, false, true])]
    expect(isUnlocked(items, 'verbal', 'application')).toBe(true)
  })
  it('טעות הבנה פתוחה חוסמת יישום', () => {
    const items = [...many(K, all(15)), ...many(U, all(10))]
    expect(isUnlocked(items, 'verbal', 'application', true)).toBe(false)
  })
})

describe('נתקעים', () => {
  it('מתחת ל-60 אחוז בעשר האחרונות', () => {
    const items = many(U, [true, true, true, true, true, false, false, false, false, false])
    expect(isStuck(items, 'verbal', 'understanding')).toBe(true)
    expect(isStuck(many(U, all(9, false)), 'verbal', 'understanding')).toBe(false)
  })
  it('חוזרים שכבה אחת אחורה', () => {
    const items = [...many(K, all(15)), ...many(U, [...all(3), ...all(7, false)])]
    expect(recommendedLayer(items, 'verbal', 'understanding')).toEqual({ layer: 'knowledge', reason: 'stuck' })
  })
  it('שכבה נעולה יורדת לשכבה הפתוחה', () => {
    expect(recommendedLayer([], 'verbal', 'application')).toEqual({ layer: 'knowledge', reason: 'locked' })
  })
  it('ממשיכים ביישום כשהכל פתוח', () => {
    const items = [...many(K, all(15)), ...many(U, all(10)), ...many(A, all(3))]
    expect(recommendedLayer(items, 'verbal', 'application')).toEqual({ layer: 'application', reason: 'ok' })
  })
})

describe('מצב שכבות לתצוגה', () => {
  it('התקדמות בין 0 ל-1', () => {
    const s = layerStatus(many(K, all(8)), 'verbal')
    expect(s[0].progress).toBeGreaterThan(0)
    expect(s[0].progress).toBeLessThan(1)
    expect(s[1].unlocked).toBe(false)
    expect(s[2].progress).toBe(0)
  })
})

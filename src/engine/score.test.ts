import { describe, expect, it } from 'vitest'
import { domainEstimate, estimate } from './score'
import { item, q } from './testkit'

describe('ציון משוער פנימי', () => {
  it('ריק מחזיר null', () => {
    expect(domainEstimate([])).toBe(null)
    expect(estimate([]).overall).toBe(null)
  })
  it('ליניארי בתוך התחום', () => {
    const Q = q('verbal', 'application')
    expect(domainEstimate([item(Q, true), item(Q, false)])).toBe(50)
  })
  it('שאלה קשה שווה יותר', () => {
    const easy = q('quant', 'application', 's', { difficulty: 1 })
    const hard = q('quant', 'application', 's', { difficulty: 3 })
    expect(domainEstimate([item(hard, true), item(easy, false)])).toBe(60)
  })
  it('כללי לפי משקלי התחומים שנבדקו בלבד', () => {
    const v = q('verbal', 'application')
    const m = q('quant', 'application')
    const e = estimate([item(v, true), item(m, false)])
    expect(e.byDomain).toEqual({ verbal: 100, quant: 0 })
    expect(e.overall).toBe(Math.round((100 * 0.55) / 0.8))
  })
})

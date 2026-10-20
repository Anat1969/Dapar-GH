import { describe, expect, it } from 'vitest'
import { daysToExam, PLAN, planDayIndex, todayPlan } from './plan'

describe('תוכנית תשעה ימים', () => {
  it('תשעה ימים מ-21.10 עד 29.10', () => {
    expect(PLAN).toHaveLength(9)
    expect(PLAN[0].date).toBe('2026-10-21')
    expect(PLAN[8].date).toBe('2026-10-29')
  })
  it('ערב הכנה לפני התחלה', () => {
    expect(planDayIndex('2026-10-20')).toBe(0)
    expect(todayPlan('2026-10-20').mode).toBe('prep')
  })
  it('יום 1 אבחון, יום 5 מדומה חלקי, יום 7 מלא, יום 9 מבחן', () => {
    expect(todayPlan('2026-10-21').mode).toBe('diagnostic')
    expect(todayPlan('2026-10-25').mode).toBe('mock_partial')
    expect(todayPlan('2026-10-27').mode).toBe('mock_full')
    expect(todayPlan('2026-10-29').mode).toBe('exam_day')
  })
  it('אחרי המבחן', () => {
    expect(todayPlan('2026-10-30').mode).toBe('after')
  })
  it('ספירה לאחור', () => {
    expect(daysToExam('2026-10-20')).toBe(9)
    expect(daysToExam('2026-10-29')).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { detectDistress } from './mood'
import { sessionReport } from './report'
import { item, q } from './testkit'

describe('חרדה ותסכול', () => {
  it('מזהה ביטויים', () => {
    expect(detectDistress('אני ממש לחוץ מהמבחן')).toBe(true)
    expect(detectDistress('נמאס לי')).toBe(true)
    expect(detectDistress('אחוז זה חלק ממאה')).toBe(false)
    expect(detectDistress('')).toBe(false)
  })
})

describe('דוח סשן', () => {
  it('שלושה לכל היותר, וסוג דומיננטי', () => {
    const a = q('verbal', 'knowledge', 'אנלוגיות')
    const b = q('quant', 'knowledge', 'אחוזים')
    const r = sessionReport([item(a, true), item(b, false, 'calculation'), item(b, false, 'calculation')], [])
    expect(r.improved).toEqual(['אנלוגיות'])
    expect(r.strengthen[0]).toBe('אחוזים')
    expect(r.dominant).toBe('calculation')
    expect(r.nextStep).toContain('אחוזים')
  })
})

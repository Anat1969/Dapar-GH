import { describe, expect, it } from 'vitest'
import { dominantErrorType, errorGroups, needsRestatement, repairQueue, splitByKeywords, suggestErrorType } from './errors'
import { item, q } from './testkit'
import type { ErrorNote } from './types'

const Q = q('quant', 'understanding', 'אחוזים')
const note: ErrorNote = { id: 'n', skill: 'אחוזים', error_type: 'calculation', rule_restatement: 'x', created_at: '' }

describe('טעות חוזרת', () => {
  it('במופע השלישי מבקשים ניסוח', () => {
    const two = [item(Q, false, 'calculation'), item(Q, false, 'calculation')]
    expect(needsRestatement(two, [], 'אחוזים', 'calculation')).toBe(false)
    const three = [...two, item(Q, false, 'calculation')]
    expect(needsRestatement(three, [], 'אחוזים', 'calculation')).toBe(true)
  })
  it('סוג אחר לא נספר יחד', () => {
    const items = [item(Q, false, 'calculation'), item(Q, false, 'calculation'), item(Q, false, 'time')]
    expect(needsRestatement(items, [], 'אחוזים', 'calculation')).toBe(false)
  })
  it('אחרי ניסוח שמור לא מבקשים שוב', () => {
    const items = [1, 2, 3].map(() => item(Q, false, 'calculation'))
    expect(needsRestatement(items, [note], 'אחוזים', 'calculation')).toBe(false)
  })
})

describe('תור תיקון', () => {
  it('טעות יורדת מהתור אחרי שתי תשובות נכונות ברצף', () => {
    const items = [item(Q, false, 'calculation'), item(Q, true)]
    expect(repairQueue(items, [])).toHaveLength(1)
    expect(repairQueue([...items, item(Q, true)], [])).toHaveLength(0)
  })
  it('אחרי שלוש טעויות צריך גם ניסוח וגם רצף', () => {
    const items = [1, 2, 3].map(() => item(Q, false, 'calculation'))
    const fixed = [...items, item(Q, true), item(Q, true)]
    expect(repairQueue(fixed, [])).toHaveLength(1)
    expect(repairQueue(fixed, [note])).toHaveLength(0)
  })
  it('קיבוץ לפי נושא וסוג', () => {
    const g = errorGroups([item(Q, false, 'calculation'), item(Q, false, 'time')], [])
    expect(g.map((x) => x.type).sort()).toEqual(['calculation', 'time'])
  })
})

describe('סוג טעות', () => {
  it('דומיננטי', () => {
    expect(dominantErrorType([item(Q, false, 'time'), item(Q, false, 'time'), item(Q, false, 'knowledge')])).toBe('time')
    expect(dominantErrorType([item(Q, true)])).toBe(null)
  })
  it('הצעה לפי הקשר', () => {
    expect(suggestErrorType(Q, 10, true)).toBe('time')
    expect(suggestErrorType(q('instructions', 'knowledge'), 5, false)).toBe('instruction')
    expect(suggestErrorType(Q, 5, false)).toBe('calculation')
    expect(suggestErrorType(q('verbal', 'understanding'), 5, false)).toBe('understanding')
    expect(suggestErrorType(q('verbal', 'knowledge'), 5, false)).toBe('knowledge')
  })
})

describe('מילות מפתח בהוראה', () => {
  it('מסמן "לא" ו"לפחות" כמילים שלמות', () => {
    const parts = splitByKeywords('בחרו את המספר שלא מתחלק, לפחות פעם אחת')
    expect(parts.filter((p) => p.k).map((p) => p.t)).toEqual(['לפחות'])
    const p2 = splitByKeywords('איזו מילה לא שייכת לקבוצה')
    expect(p2.filter((p) => p.k).map((p) => p.t)).toEqual(['לא'])
    expect(p2.map((p) => p.t).join('')).toBe('איזו מילה לא שייכת לקבוצה')
  })
})

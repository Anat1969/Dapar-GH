import type { Domain, Layer, Question, ScoredItem } from '../engine/types'

function shuffle<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface PickOpts {
  domain?: Domain
  layer?: Layer
  skill?: string
  exclude?: Set<string>
  count: number
  /** ביישום: מהקל לקשה. */
  ascending?: boolean
}

/**
 * בוחר שאלות: קודם שאלות שלא נענו, אחר כך שאלות שבהן טעה, ואז הוותיקות ביותר.
 */
export function pickQuestions(questions: Question[], items: ScoredItem[], o: PickOpts): Question[] {
  const pool = questions.filter(
    (q) => (!o.domain || q.domain === o.domain) && (!o.layer || q.layer === o.layer) && (!o.skill || q.skill === o.skill) && !o.exclude?.has(q.id),
  )
  const last = new Map<string, ScoredItem>()
  for (const i of items) {
    const prev = last.get(i.question_id)
    if (!prev || prev.answered_at < i.answered_at) last.set(i.question_id, i)
  }
  const fresh = shuffle(pool.filter((q) => !last.has(q.id)))
  const wrong = shuffle(pool.filter((q) => last.get(q.id)?.is_correct === false))
  const old = pool
    .filter((q) => last.get(q.id)?.is_correct === true)
    .sort((a, b) => last.get(a.id)!.answered_at.localeCompare(last.get(b.id)!.answered_at))
  const out = [...fresh, ...wrong, ...old].slice(0, o.count)
  return o.ascending ? out.sort((a, b) => a.difficulty - b.difficulty) : out
}

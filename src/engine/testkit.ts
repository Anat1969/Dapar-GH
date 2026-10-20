import type { Domain, ErrorType, Layer, Question, ScoredItem } from './types'

let n = 0
export function q(domain: Domain, layer: Layer, skill = 's', extra: Partial<Question> = {}): Question {
  return {
    id: `q${++n}`, domain, layer, skill, difficulty: 1, prompt: 'p', options: ['a', 'b'], correct_index: 0,
    explanation: 'e', source: 'new', ...extra,
  }
}

let t = 0
export function item(question: Question, correct: boolean, error_type: ErrorType | 'none' = correct ? 'none' : 'knowledge'): ScoredItem {
  t++
  return {
    id: `i${t}`, attempt_id: 'a', question_id: question.id, selected_index: correct ? 0 : 1, is_correct: correct,
    seconds_taken: 10, error_type, answered_at: new Date(Date.UTC(2026, 9, 21, 0, 0, t)).toISOString(), q: question,
  }
}

export function many(question: Question, pattern: boolean[]) {
  return pattern.map((c) => item(question, c))
}

export type Domain = 'verbal' | 'quant' | 'figural' | 'instructions'
export type Layer = 'knowledge' | 'understanding' | 'application'
export type ErrorType = 'knowledge' | 'understanding' | 'instruction' | 'calculation' | 'time'
export type Source = 'official' | 'reconstructed' | 'new'
export type AttemptKind = 'diagnostic' | 'daily' | 'practice' | 'mock_partial' | 'mock_full'

export const DOMAINS: Domain[] = ['verbal', 'quant', 'figural', 'instructions']
export const LAYERS: Layer[] = ['knowledge', 'understanding', 'application']
export const ERROR_TYPES: ErrorType[] = ['knowledge', 'understanding', 'instruction', 'calculation', 'time']

export const DOMAIN_NAME: Record<Domain, string> = {
  verbal: 'חשיבה מילולית',
  quant: 'חשיבה כמותית',
  figural: 'חשיבה צורנית',
  instructions: 'הבנת הוראות',
}

export const LAYER_NAME: Record<Layer, string> = {
  knowledge: 'ידע',
  understanding: 'הבנה',
  application: 'יישום',
}

export const ERROR_NAME: Record<ErrorType, string> = {
  knowledge: 'ידע חסר',
  understanding: 'הבנה לא מדויקת',
  instruction: 'הוראה שנקראה לא נכון',
  calculation: 'חישוב',
  time: 'זמן',
}

export const ERROR_REMEDY: Record<ErrorType, string> = {
  knowledge: 'הסבר קצר של הכלל, ואחריו שאלות ידע לחזרה.',
  understanding: 'שאלות הסבר בשכבת הבנה: למה זה עובד ומתי לא.',
  instruction: 'קודם קוראים את ההוראה לבד, עם מילות המפתח מסומנות.',
  calculation: 'תרגיל דומה עם אותו מבנה, וחישוב לאט.',
  time: 'מבחן מדומה עם שעון.',
}

export const SOURCE_NAME: Record<Source, string> = {
  official: 'רשמית',
  reconstructed: 'משוחזרת',
  new: 'חדש בסגנון',
}

/** צורה בודדת בחשיבה צורנית. */
export interface Shape {
  s: 'circle' | 'square' | 'triangle' | 'diamond' | 'line' | 'dot' | 'hex'
  rot?: number
  fill?: 'none' | 'solid' | 'half'
  n?: number
  size?: number
}
export type Figure = Shape[]

export interface Question {
  id: string
  domain: Domain
  layer: Layer
  skill: string
  difficulty: 1 | 2 | 3
  prompt: string
  instruction_text?: string | null
  /** רצף צורות לשאלה צורנית. כל תא הוא Figure. null מסמן תא ריק (סימן שאלה). */
  figure?: (Figure | null)[] | null
  /** אפשרות היא טקסט או צורה. */
  options: (string | Figure)[]
  correct_index: number
  explanation: string
  source: Source
  time_limit_seconds?: number | null
}

export interface Attempt {
  id: string
  kind: AttemptKind
  started_at: string
  finished_at?: string | null
  score_estimate?: number | null
}

export interface AttemptItem {
  id: string
  attempt_id: string
  question_id: string
  selected_index: number | null
  is_correct: boolean
  seconds_taken: number | null
  error_type: ErrorType | 'none'
  answered_at: string
}

export interface ErrorNote {
  id: string
  skill: string
  error_type: ErrorType
  rule_restatement: string
  created_at: string
}

/** פריט עם השאלה שלו, לחישובי מנוע. */
export interface ScoredItem extends AttemptItem {
  q: Question
}

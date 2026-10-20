// מפתח publishable בלבד. אין כאן ולא בשום מקום בקוד מפתח סודי.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ktqmwpbzcnzkhjskqisy.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q'

/** קידומת הטבלאות בפרויקט המשותף. */
export const T = {
  domains: 'dapar_domains',
  questions: 'dapar_questions',
  attempts: 'dapar_attempts',
  items: 'dapar_attempt_items',
  notes: 'dapar_error_notes',
  admins: 'dapar_admins',
} as const

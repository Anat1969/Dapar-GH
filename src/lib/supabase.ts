import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabase'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** בודק אם Google מופעל בפרויקט. null: לא ניתן לבדוק (רשת). */
export async function googleEnabled(): Promise<boolean | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
    if (!r.ok) return null
    const j = await r.json()
    return Boolean(j?.external?.google)
  } catch {
    return null
  }
}

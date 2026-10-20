import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { googleEnabled, supabase } from './supabase'
import { readJSON, removeKey, writeJSON } from './storage'

const MODE_KEY = 'dapar.mode'

interface Auth {
  ready: boolean
  session: Session | null
  localMode: boolean
  google: boolean | null
  signInGoogle: () => Promise<string | null>
  continueLocal: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<Auth | null>(null)
export const useAuth = () => {
  const a = useContext(Ctx)
  if (!a) throw new Error('AuthProvider missing')
  return a
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [localMode, setLocalMode] = useState(() => readJSON<string>(MODE_KEY, '') === 'local')
  const [google, setGoogle] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session)
      })
      .catch(() => undefined)
      .finally(() => alive && setReady(true))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    googleEnabled().then((g) => alive && setGoogle(g))
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: Auth = {
    ready,
    session,
    localMode: localMode && !session,
    google,
    signInGoogle: async () => {
      if (google === false) return 'הכניסה עם Google עדיין לא הופעלה בפרויקט.'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/' },
      })
      return error ? 'הכניסה עם Google לא זמינה כרגע.' : null
    },
    continueLocal: () => {
      writeJSON(MODE_KEY, 'local')
      setLocalMode(true)
    },
    signOut: async () => {
      removeKey(MODE_KEY)
      setLocalMode(false)
      await supabase.auth.signOut().catch(() => undefined)
      setSession(null)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

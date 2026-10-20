import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import bankJson from '../data/bank.json'
import { T } from '../config/supabase'
import type { Attempt, AttemptItem, AttemptKind, ErrorNote, ErrorType, Question, ScoredItem } from '../engine/types'
import { supabase } from './supabase'
import { readJSON, removeKey, uid, writeJSON } from './storage'

const BANK = bankJson as Question[]

export type Mode = 'remote' | 'local'
type Table = 'attempts' | 'items' | 'notes' | 'questions'
interface Op { id: string; table: Table; kind: 'upsert' | 'delete'; row: Record<string, unknown> }

interface Data {
  attempts: Attempt[]
  items: AttemptItem[]
  notes: ErrorNote[]
}
const EMPTY: Data = { attempts: [], items: [], notes: [] }

const LOCAL_KEY = 'dapar.local.v1'
const cacheKey = (u: string) => `dapar.cache.${u}`
const outboxKey = (u: string) => `dapar.outbox.${u}`
const migratedKey = (u: string) => `dapar.migrated.${u}`

const tableName: Record<Table, string> = { attempts: T.attempts, items: T.items, notes: T.notes, questions: T.questions }

export interface Store {
  mode: Mode
  status: 'loading' | 'ready' | 'error'
  error: string | null
  isAdmin: boolean
  userEmail: string | null
  questions: Question[]
  qmap: Map<string, Question>
  attempts: Attempt[]
  items: AttemptItem[]
  scored: ScoredItem[]
  notes: ErrorNote[]
  pending: number
  /** תמונת מצב עדכנית, לשימוש בתוך handlers בלי לחכות לרינדור. */
  snapshot: () => { scored: ScoredItem[]; notes: ErrorNote[] }
  reload: () => void
  retry: () => void
  startAttempt: (kind: AttemptKind) => Attempt
  finishAttempt: (id: string, score?: number | null) => void
  saveItem: (item: AttemptItem) => void
  saveNote: (skill: string, type: ErrorType, text: string) => void
  upsertQuestion: (q: Question) => Promise<string | null>
  deleteQuestion: (id: string) => Promise<string | null>
}

const Ctx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

export function StoreProvider({ session, mode, children }: { session: Session | null; mode: Mode; children: ReactNode }) {
  const userId = session?.user.id ?? 'local'
  const userEmail = session?.user.email ?? null
  const [data, setData] = useState<Data>(EMPTY)
  const [remoteQuestions, setRemoteQuestions] = useState<Question[] | null>(null)
  const [status, setStatus] = useState<Store['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pending, setPending] = useState(0)
  const [tick, setTick] = useState(0)
  const dataRef = useRef<Data>(EMPTY)
  const flushing = useRef(false)

  const commit = useCallback(
    (next: Data) => {
      dataRef.current = next
      setData(next)
      writeJSON(mode === 'local' ? LOCAL_KEY : cacheKey(userId), next)
    },
    [mode, userId],
  )

  const flush = useCallback(async () => {
    if (mode !== 'remote' || flushing.current) return
    flushing.current = true
    try {
      let box = readJSON<Op[]>(outboxKey(userId), [])
      while (box.length) {
        const op = box[0]
        const q =
          op.kind === 'upsert'
            ? // user_id נקבע בשרת (default auth.uid()), ו-RLS מוודא שהוא שלו
            supabase.from(tableName[op.table]).upsert(op.row)
            : supabase.from(tableName[op.table]).delete().eq('id', op.row.id as string)
        const { error: e } = await q
        if (e) {
          // שגיאת הרשאה או נתונים: לא חוסמים את התור לנצח
          if (e.code && /^(23|42)/.test(e.code)) {
            box = box.slice(1)
            writeJSON(outboxKey(userId), box)
            continue
          }
          throw e
        }
        box = box.slice(1)
        writeJSON(outboxKey(userId), box)
      }
      setPending(0)
    } catch {
      setPending(readJSON<Op[]>(outboxKey(userId), []).length)
    } finally {
      flushing.current = false
    }
  }, [mode, userId])

  const enqueue = useCallback(
    (op: Omit<Op, 'id'>) => {
      if (mode !== 'remote') return
      const box = readJSON<Op[]>(outboxKey(userId), [])
      box.push({ ...op, id: uid() })
      writeJSON(outboxKey(userId), box)
      setPending(box.length)
      void flush()
    },
    [flush, mode, userId],
  )

  // טעינה
  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus('loading')
      setError(null)
      if (mode === 'local') {
        commit(readJSON<Data>(LOCAL_KEY, EMPTY))
        setRemoteQuestions(null)
        setIsAdmin(false)
        setStatus('ready')
        return
      }
      const cached = readJSON<Data | null>(cacheKey(userId), null)
      if (cached) {
        commit(cached)
        setStatus('ready')
      }
      // העברה חד פעמית של התקדמות מהמכשיר לחשבון
      if (!readJSON(migratedKey(userId), false)) {
        const local = readJSON<Data>(LOCAL_KEY, EMPTY)
        const box = readJSON<Op[]>(outboxKey(userId), [])
        for (const a of local.attempts) box.push({ id: uid(), table: 'attempts', kind: 'upsert', row: { ...a } })
        for (const i of local.items) box.push({ id: uid(), table: 'items', kind: 'upsert', row: { ...i } })
        for (const n of local.notes) box.push({ id: uid(), table: 'notes', kind: 'upsert', row: { ...n } })
        writeJSON(outboxKey(userId), box)
        writeJSON(migratedKey(userId), true)
      }
      await flush()
      try {
        const [qs, at, it, nt, adm] = await Promise.all([
          supabase.from(T.questions).select('*').limit(5000),
          supabase.from(T.attempts).select('id,kind,started_at,finished_at,score_estimate').order('started_at'),
          supabase.from(T.items).select('id,attempt_id,question_id,selected_index,is_correct,seconds_taken,error_type,answered_at').order('answered_at').limit(20000),
          supabase.from(T.notes).select('id,skill,error_type,rule_restatement,created_at').order('created_at'),
          supabase.rpc('dapar_is_admin'),
        ])
        const firstErr = qs.error || at.error || it.error || nt.error
        if (firstErr) throw firstErr
        if (cancelled) return
        setRemoteQuestions((qs.data ?? []) as Question[])
        setIsAdmin(adm.data === true)
        // מיזוג עם רשומות שעדיין בתור
        const box = readJSON<Op[]>(outboxKey(userId), [])
        const merge = <X extends { id: string }>(server: X[], table: Table) => {
          const map = new Map(server.map((r) => [r.id, r]))
          for (const op of box) if (op.table === table && op.kind === 'upsert') map.set(op.row.id as string, op.row as unknown as X)
          return [...map.values()]
        }
        commit({
          attempts: merge(at.data as Attempt[], 'attempts'),
          items: merge(it.data as AttemptItem[], 'items'),
          notes: merge(nt.data as ErrorNote[], 'notes'),
        })
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        if (!cached) {
          setError('אין חיבור לשרת כרגע.')
          setStatus('error')
        }
        void e
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [mode, userId, tick, commit, flush])

  // ניסיון חוזר כשהחיבור חוזר
  useEffect(() => {
    if (mode !== 'remote') return
    const on = () => void flush()
    window.addEventListener('online', on)
    const t = window.setInterval(on, 20000)
    return () => {
      window.removeEventListener('online', on)
      window.clearInterval(t)
    }
  }, [flush, mode])

  const questions = useMemo(() => {
    // אחרי כניסה: הבנק מהשרת (שם האדמין עורכת). בלי חיבור או בבנק ריק: הבנק ההתחלתי שבאפליקציה.
    return remoteQuestions && remoteQuestions.length ? remoteQuestions : BANK
  }, [remoteQuestions])

  const qmap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])

  const scoredOf = useCallback(
    (items: AttemptItem[]) =>
      items
        .filter((i) => qmap.has(i.question_id))
        .map((i) => ({ ...i, q: qmap.get(i.question_id)! }))
        .sort((a, b) => a.answered_at.localeCompare(b.answered_at)),
    [qmap],
  )

  const scored = useMemo(() => scoredOf(data.items), [data.items, scoredOf])

  const store: Store = {
    mode,
    status,
    error,
    isAdmin,
    userEmail,
    questions,
    qmap,
    attempts: data.attempts,
    items: data.items,
    scored,
    notes: data.notes,
    pending,
    snapshot: () => ({ scored: scoredOf(dataRef.current.items), notes: dataRef.current.notes }),
    reload: () => setTick((t) => t + 1),
    retry: () => {
      void flush()
      setTick((t) => t + 1)
    },
    startAttempt: (kind) => {
      const a: Attempt = { id: uid(), kind, started_at: new Date().toISOString(), finished_at: null, score_estimate: null }
      commit({ ...dataRef.current, attempts: [...dataRef.current.attempts, a] })
      enqueue({ table: 'attempts', kind: 'upsert', row: { ...a } })
      return a
    },
    finishAttempt: (id, score = null) => {
      const cur = dataRef.current.attempts.find((a) => a.id === id)
      if (!cur) return
      const a: Attempt = { ...cur, finished_at: new Date().toISOString(), score_estimate: score }
      commit({ ...dataRef.current, attempts: dataRef.current.attempts.map((x) => (x.id === id ? a : x)) })
      enqueue({ table: 'attempts', kind: 'upsert', row: { ...a } })
    },
    saveItem: (item) => {
      const exists = dataRef.current.items.some((i) => i.id === item.id)
      const items = exists ? dataRef.current.items.map((i) => (i.id === item.id ? item : i)) : [...dataRef.current.items, item]
      commit({ ...dataRef.current, items })
      enqueue({ table: 'items', kind: 'upsert', row: { ...item } })
    },
    saveNote: (skill, type, text) => {
      const n: ErrorNote = { id: uid(), skill, error_type: type, rule_restatement: text, created_at: new Date().toISOString() }
      commit({ ...dataRef.current, notes: [...dataRef.current.notes, n] })
      enqueue({ table: 'notes', kind: 'upsert', row: { ...n } })
    },
    upsertQuestion: async (q) => {
      if (mode !== 'remote') return 'ניהול הבנק זמין רק אחרי כניסה עם Google.'
      if (!q.source) return 'שאלה בלי source לא נשמרת.'
      const { error: e } = await supabase.from(T.questions).upsert(q)
      if (e) return e.message.includes('row-level') ? 'אין הרשאה לשמור שאלות.' : 'השמירה נכשלה. נסו שוב.'
      setRemoteQuestions((prev) => [...(prev ?? []).filter((x) => x.id !== q.id), q])
      return null
    },
    deleteQuestion: async (id) => {
      if (mode !== 'remote') return 'ניהול הבנק זמין רק אחרי כניסה עם Google.'
      const { error: e } = await supabase.from(T.questions).delete().eq('id', id)
      if (e) return 'המחיקה נכשלה. נסו שוב.'
      setRemoteQuestions((prev) => (prev ?? []).filter((x) => x.id !== id))
      return null
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function clearLocalProgress() {
  removeKey(LOCAL_KEY)
}

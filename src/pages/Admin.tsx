import { useMemo, useState } from 'react'
import { DOMAIN_NAME, DOMAINS, LAYER_NAME, LAYERS, SOURCE_NAME, type Question, type Source } from '../engine/types'
import { useStore } from '../lib/store'
import { uid } from '../lib/storage'
import { Dialog } from '../components/Dialog'
import { Empty } from '../components/States'
import { useToast } from '../lib/toast'

const blank = (): Question => ({
  id: uid(), domain: 'verbal', layer: 'knowledge', skill: '', difficulty: 1, prompt: '', instruction_text: '', figure: null,
  options: ['', '', '', ''], correct_index: 0, explanation: '', source: '' as Source, time_limit_seconds: null,
})

/** בדיקה לפני שמירה. שאלה בלי source לא נשמרת. */
export function validateQuestion(q: Partial<Question>): string | null {
  if (!q.source || !['official', 'reconstructed', 'new'].includes(q.source)) return 'חובה לבחור מקור (source).'
  if (!q.domain || !DOMAINS.includes(q.domain)) return 'תחום לא תקין.'
  if (!q.layer || !LAYERS.includes(q.layer)) return 'שכבה לא תקינה.'
  if (!q.skill?.trim()) return 'חסר נושא.'
  if (!q.prompt?.trim()) return 'חסר טקסט שאלה.'
  if (!Array.isArray(q.options) || q.options.length < 2) return 'צריך לפחות שתי אפשרויות.'
  if (q.options.some((o) => typeof o === 'string' && !o.trim())) return 'יש אפשרות ריקה.'
  if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= q.options.length) return 'התשובה הנכונה לא תקינה.'
  if (!q.explanation?.trim()) return 'חסר הסבר.'
  if (![1, 2, 3].includes(Number(q.difficulty))) return 'קושי בין 1 ל-3.'
  return null
}

export default function Admin() {
  const store = useStore()
  const toast = useToast()
  const [filter, setFilter] = useState({ domain: '', layer: '', text: '' })
  const [edit, setEdit] = useState<Question | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [busy, setBusy] = useState(false)

  const list = useMemo(
    () =>
      store.questions.filter(
        (q) => (!filter.domain || q.domain === filter.domain) && (!filter.layer || q.layer === filter.layer) && (!filter.text || q.prompt.includes(filter.text) || q.skill.includes(filter.text)),
      ),
    [store.questions, filter],
  )

  if (!store.isAdmin) {
    return (
      <div className="page">
        <Empty text="אין הרשאה לניהול הבנק. הדף פתוח רק לאדמין." />
      </div>
    )
  }

  const save = async () => {
    if (!edit) return
    const q = { ...edit, instruction_text: edit.instruction_text?.trim() || null, difficulty: Number(edit.difficulty) as 1 | 2 | 3 }
    const v = validateQuestion(q)
    if (v) return setErr(v)
    setBusy(true)
    const e = await store.upsertQuestion(q)
    setBusy(false)
    if (e) return setErr(e)
    setEdit(null)
    toast('השאלה נשמרה')
  }

  const del = async (id: string) => {
    if (!window.confirm('למחוק את השאלה? גם התשובות אליה יימחקו.')) return
    const e = await store.deleteQuestion(id)
    toast(e ?? 'השאלה נמחקה')
  }

  const doImport = async () => {
    setErr(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(importText)
    } catch {
      return setErr('הקובץ אינו JSON תקין.')
    }
    const arr = (Array.isArray(parsed) ? parsed : [parsed]) as Partial<Question>[]
    let ok = 0
    const bad: string[] = []
    setBusy(true)
    for (const [i, raw] of arr.entries()) {
      const { ...rest } = raw as Record<string, unknown>
      delete rest._הערה
      const q = { id: uid(), instruction_text: null, figure: null, time_limit_seconds: null, ...rest } as Question
      const v = validateQuestion(q)
      if (v) { bad.push(`שאלה ${i + 1}: ${v}`); continue }
      const e = await store.upsertQuestion(q)
      if (e) bad.push(`שאלה ${i + 1}: ${e}`)
      else ok++
    }
    setBusy(false)
    toast(`יובאו ${ok} שאלות`)
    if (bad.length) setErr(bad.slice(0, 6).join('\n'))
    else { setImportOpen(false); setImportText('') }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(store.questions, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'dapar-question-bank.json'
    a.click()
  }

  return (
    <div className="page">
      <div className="section-head">
        <div className="mono label">אדמין</div>
        <h1 className="h-hero">ניהול בנק השאלות</h1>
        <p className="muted">{store.questions.length} שאלות. שאלה רשמית או משוחזרת מסומנת כך רק כשהמקור ידוע.</p>
      </div>
      <div className="row-actions">
        <button className="btn btn-primary" onClick={() => { setErr(null); setEdit(blank()) }}>שאלה חדשה</button>
        <button className="btn" onClick={() => { setErr(null); setImportOpen(true) }}>ייבוא JSON</button>
        <button className="btn btn-ghost" onClick={exportJson}>ייצוא JSON</button>
      </div>
      <div className="filters">
        <select aria-label="תחום" value={filter.domain} onChange={(e) => setFilter({ ...filter, domain: e.target.value })}>
          <option value="">כל התחומים</option>
          {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_NAME[d]}</option>)}
        </select>
        <select aria-label="שכבה" value={filter.layer} onChange={(e) => setFilter({ ...filter, layer: e.target.value })}>
          <option value="">כל השכבות</option>
          {LAYERS.map((l) => <option key={l} value={l}>{LAYER_NAME[l]}</option>)}
        </select>
        <input aria-label="חיפוש" placeholder="חיפוש בטקסט או בנושא" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
      </div>
      <div className="admin-list">
        {list.slice(0, 200).map((q) => (
          <div key={q.id} className="admin-row">
            <div className="admin-row-main">
              <div className="qtags">
                <span className={`tag tag-${q.domain}`}>{DOMAIN_NAME[q.domain]}</span>
                <span className="tag">{LAYER_NAME[q.layer]}</span>
                <span className="tag">{q.skill}</span>
                <span className="tag tag-source">{SOURCE_NAME[q.source]}</span>
              </div>
              <p>{q.prompt.slice(0, 140)}</p>
            </div>
            <div className="admin-row-actions">
              <button className="btn btn-sm" onClick={() => { setErr(null); setEdit({ ...q, options: [...q.options] }) }}>עריכה</button>
              <button className="btn btn-sm btn-quiet" onClick={() => void del(q.id)}>מחיקה</button>
            </div>
          </div>
        ))}
        {list.length > 200 && <p className="muted">מוצגות 200 הראשונות. סננו כדי לצמצם.</p>}
      </div>

      <Dialog open={Boolean(edit)} title={edit && store.questions.some((x) => x.id === edit.id) ? 'עריכת שאלה' : 'שאלה חדשה'} onClose={() => setEdit(null)} wide>
        {edit && (
          <div className="form">
            <div className="form-row">
              <label className="field"><span>תחום</span>
                <select value={edit.domain} onChange={(e) => setEdit({ ...edit, domain: e.target.value as Question['domain'] })}>
                  {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_NAME[d]}</option>)}
                </select>
              </label>
              <label className="field"><span>שכבה</span>
                <select value={edit.layer} onChange={(e) => setEdit({ ...edit, layer: e.target.value as Question['layer'] })}>
                  {LAYERS.map((l) => <option key={l} value={l}>{LAYER_NAME[l]}</option>)}
                </select>
              </label>
              <label className="field"><span>קושי</span>
                <select value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: Number(e.target.value) as 1 | 2 | 3 })}>
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </label>
              <label className="field"><span>מקור (source)</span>
                <select value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value as Source })}>
                  <option value="">בחרו מקור</option>
                  <option value="new">חדש בסגנון</option>
                  <option value="reconstructed">משוחזרת</option>
                  <option value="official">רשמית</option>
                </select>
              </label>
            </div>
            <label className="field"><span>נושא</span><input value={edit.skill} onChange={(e) => setEdit({ ...edit, skill: e.target.value })} /></label>
            <label className="field"><span>הוראה (לא חובה)</span><input value={edit.instruction_text ?? ''} onChange={(e) => setEdit({ ...edit, instruction_text: e.target.value })} /></label>
            <label className="field"><span>שאלה</span><textarea rows={3} value={edit.prompt} onChange={(e) => setEdit({ ...edit, prompt: e.target.value })} /></label>
            <fieldset className="field">
              <legend>אפשרויות (סמנו את הנכונה)</legend>
              {edit.options.map((o, i) => (
                <div key={i} className="opt-edit">
                  <input type="radio" name="correct" aria-label={`תשובה נכונה ${i + 1}`} checked={edit.correct_index === i} onChange={() => setEdit({ ...edit, correct_index: i })} />
                  {typeof o === 'string' ? (
                    <input value={o} aria-label={`אפשרות ${i + 1}`} onChange={(e) => setEdit({ ...edit, options: edit.options.map((x, k) => (k === i ? e.target.value : x)) })} />
                  ) : (
                    <span className="muted">צורה (עריכה ב-JSON)</span>
                  )}
                </div>
              ))}
            </fieldset>
            <label className="field"><span>הסבר</span><textarea rows={2} value={edit.explanation} onChange={(e) => setEdit({ ...edit, explanation: e.target.value })} /></label>
            <label className="field"><span>זמן לשאלה בשניות (יישום)</span><input type="number" value={edit.time_limit_seconds ?? ''} onChange={(e) => setEdit({ ...edit, time_limit_seconds: e.target.value ? Number(e.target.value) : null })} /></label>
            {err && <p className="notice notice-err">{err}</p>}
            <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>שמירה</button>
          </div>
        )}
      </Dialog>

      <Dialog open={importOpen} title="ייבוא JSON" onClose={() => setImportOpen(false)} wide>
        <p className="muted">שאלה אחת או מערך, לפי data/question-bank.template.json. שאלה בלי source לא נשמרת.</p>
        <input type="file" accept="application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImportText(await f.text()) }} />
        <textarea rows={10} className="mono" dir="ltr" value={importText} onChange={(e) => setImportText(e.target.value)} />
        {err && <p className="notice notice-err" style={{ whiteSpace: 'pre-line' }}>{err}</p>}
        <button className="btn btn-primary" disabled={busy || !importText.trim()} onClick={() => void doImport()}>ייבוא</button>
      </Dialog>
    </div>
  )
}

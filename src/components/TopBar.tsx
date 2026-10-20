import { useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { APP_NAME } from '../config/app'
import { LINKS, isSet } from '../config/links'
import { useInstall } from '../lib/install'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { Logo } from './Logo'

export function TopBar({ isAdmin, showNav }: { isAdmin: boolean; showNav: boolean }) {
  const { canInstall, install } = useInstall()
  const toast = useToast()
  const { session, localMode, signOut } = useAuth()
  useLocation()
  const ref = useRef<HTMLElement>(null)

  // דיאלוגים נפתחים מתחת לסרגל: הגובה שלו נשמר במשתנה CSS
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const copy = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    toast('הקישור הועתק')
  }

  return (
    <header className="topbar" ref={ref}>
      <div className="topbar-row">
        <Link to="/" className="brand" aria-label={`${APP_NAME}, דף הבית`}>
          <Logo size={30} />
          <span>{APP_NAME}</span>
        </Link>
        <div className="topbar-actions">
          <button className="btn btn-bar" onClick={copy}>העתקת קישור</button>
          {isSet(LINKS.devChat) && (
            <a className="btn btn-bar" href={LINKS.devChat} target="_blank" rel="noreferrer">שיחת הפיתוח</a>
          )}
          {isSet(LINKS.researchProject) && (
            <a className="btn btn-bar" href={LINKS.researchProject} target="_blank" rel="noreferrer">פרויקט המחקר</a>
          )}
          {canInstall && (
            <button className="btn btn-bar btn-install" onClick={install}>התקנת האפליקציה</button>
          )}
          {(session || localMode) && (
            <button className="btn btn-bar btn-quiet" onClick={() => void signOut()}>יציאה</button>
          )}
        </div>
      </div>
      {showNav && (
        <nav className="topnav" aria-label="ניווט ראשי">
          <NavLink to="/" end>היום</NavLink>
          <NavLink to="/practice">תרגול</NavLink>
          <NavLink to="/repair">תיקון טעויות</NavLink>
          <NavLink to="/mock">מבחן מדומה</NavLink>
          <NavLink to="/stats">לוח מדידה</NavLink>
          {isAdmin && <NavLink to="/admin">ניהול הבנק</NavLink>}
        </nav>
      )}
    </header>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { APP_NAME } from '../config/app'
import { LINKS, isSet } from '../config/links'
import { useAuth } from '../lib/auth'
import { Logo } from './Logo'
import { AIMenu, type MenuItem } from './AIMenu'

export function TopBar({ isAdmin, showNav }: { isAdmin: boolean; showNav: boolean }) {
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

  const items = useMemo<MenuItem[]>(
    () => (session || localMode ? [{ label: 'יציאה', hint: localMode ? 'מכשיר זה' : 'חשבון', onSelect: () => void signOut() }] : []),
    [session, localMode, signOut],
  )

  return (
    <header className="topbar" ref={ref}>
      <div className="topbar-row">
        <Link to="/" className="brand" aria-label={`${APP_NAME}, דף הבית`}>
          <Logo size={30} />
          <span>{APP_NAME}</span>
        </Link>
        <div className="topbar-actions">
          <AIMenu chat={isSet(LINKS.devChat) ? LINKS.devChat : undefined} research={isSet(LINKS.researchProject) ? LINKS.researchProject : undefined} items={items} />
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

import { useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  hint?: string
  pressed?: boolean
  disabled?: boolean
  onSelect: () => unknown
}

interface MenuElement extends HTMLElement {
  items: MenuItem[]
  status: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ai-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { chat?: string; research?: string }
    }
  }
}

/**
 * The A&I logo button (<ai-menu> from https://appofapp-gh.vercel.app/ai-menu.js).
 * Every editing and development action lives inside it.
 */
export function AIMenu({ chat, research, items = [], status = '' }: { chat?: string; research?: string; items?: MenuItem[]; status?: string }) {
  const ref = useRef<MenuElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.items = items
    el.status = status
  }, [items, status])
  return <ai-menu ref={ref} chat={chat || undefined} research={research || undefined} />
}

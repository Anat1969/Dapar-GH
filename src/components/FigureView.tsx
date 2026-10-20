import { useId } from 'react'
import type { Figure, Shape } from '../engine/types'

function path(s: Shape['s'], r: number) {
  switch (s) {
    case 'square':
      return `M${-r},${-r}H${r}V${r}H${-r}Z`
    case 'triangle':
      return `M0,${-r}L${r * 0.95},${r * 0.75}L${-r * 0.95},${r * 0.75}Z`
    case 'diamond':
      return `M0,${-r}L${r},0L0,${r}L${-r},0Z`
    case 'hex': {
      const pts = Array.from({ length: 6 }, (_, k) => {
        const a = (Math.PI / 3) * k - Math.PI / 2
        return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
      })
      return `M${pts.join('L')}Z`
    }
    case 'line':
      return `M0,${-r}V${r}`
    default:
      return ''
  }
}

function ShapeEl({ shape, x, y, r, clipId }: { shape: Shape; x: number; y: number; r: number; clipId: string }) {
  const fill = shape.fill ?? 'none'
  const rot = shape.rot ?? 0
  const d = path(shape.s, r)
  const outline =
    shape.s === 'circle' || shape.s === 'dot' ? (
      <circle r={shape.s === 'dot' ? r * 0.3 : r} />
    ) : (
      <path d={d} />
    )
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <clipPath id={clipId}>
        <rect x={-r - 2} y={-r - 2} width={2 * r + 4} height={r + 2} />
      </clipPath>
      {fill === 'half' && (
        <g clipPath={`url(#${clipId})`} className="fig-fill">
          {outline}
        </g>
      )}
      <g className={fill === 'solid' || shape.s === 'dot' ? 'fig-fill fig-stroke' : 'fig-stroke'}>{outline}</g>
    </g>
  )
}

/** ציור תא אחד ברצף צורני. */
export function FigureCell({ fig, label }: { fig: Figure | null; label?: string }) {
  const base = useId().replace(/:/g, '')
  if (!fig) {
    return (
      <svg viewBox="0 0 100 100" className="fig-cell fig-empty" role="img" aria-label="תא חסר">
        <text x="50" y="62" textAnchor="middle" className="fig-q">?</text>
      </svg>
    )
  }
  const shapes: { shape: Shape; x: number; y: number; r: number }[] = []
  for (const sh of fig) {
    const n = sh.n ?? 1
    if (n === 1) {
      shapes.push({ shape: sh, x: 50, y: 50, r: 40 * (sh.size ?? 0.75) })
      continue
    }
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const cellW = 84 / cols
    const cellH = 84 / rows
    const r = Math.min(cellW, cellH) * 0.36
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / cols)
      const inRow = row === rows - 1 ? n - row * cols : cols
      const col = k % cols
      const offset = (84 - inRow * cellW) / 2
      shapes.push({ shape: sh, x: 8 + offset + cellW * (col + 0.5), y: 8 + (84 - rows * cellH) / 2 + cellH * (row + 0.5), r })
    }
  }
  return (
    <svg viewBox="0 0 100 100" className="fig-cell" role="img" aria-label={label ?? 'צורה'}>
      {shapes.map((s, k) => (
        <ShapeEl key={k} {...s} clipId={`${base}-${k}`} />
      ))}
    </svg>
  )
}

export function FigureStrip({ cells }: { cells: (Figure | null)[] }) {
  return (
    <div className="fig-strip" dir="ltr">
      {cells.map((c, i) => (
        <div className="fig-strip-item" key={i}>
          <FigureCell fig={c} label={`צעד ${i + 1}`} />
        </div>
      ))}
    </div>
  )
}

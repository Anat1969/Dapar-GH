import { splitByKeywords } from '../engine/errors'

/** הוראה עם מילות המפתח מסומנות. */
export function InstructionText({ text }: { text: string }) {
  return (
    <p className="instruction">
      {splitByKeywords(text).map((p, i) =>
        p.k ? (
          <mark key={i} className="kw">{p.t}</mark>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </p>
  )
}

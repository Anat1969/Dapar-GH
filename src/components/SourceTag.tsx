import type { Question } from '../engine/types'
import { SOURCE_NAME, DOMAIN_NAME, LAYER_NAME } from '../engine/types'

export function QuestionTags({ q }: { q: Question }) {
  return (
    <div className="qtags">
      <span className={`tag tag-${q.domain}`}>{DOMAIN_NAME[q.domain]}</span>
      <span className="tag">{LAYER_NAME[q.layer]}</span>
      <span className="tag tag-skill">{q.skill}</span>
      <span className={`tag tag-source tag-src-${q.source}`}>{SOURCE_NAME[q.source]}</span>
    </div>
  )
}

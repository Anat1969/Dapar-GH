// מייצר SQL לזריעת בנק השאלות ההתחלתי בטבלה dapar_questions (בחלקים).
// הרצה: node scripts/bank-to-sql.mjs  ->  supabase/seed/questions-*.sql
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const bank = JSON.parse(readFileSync(new URL('../src/data/bank.json', import.meta.url)))
mkdirSync(new URL('../supabase/seed/', import.meta.url), { recursive: true })
const size = 80
for (let i = 0; i * size < bank.length; i++) {
  const part = bank.slice(i * size, (i + 1) * size)
  const json = JSON.stringify(part).replace(/'/g, "''")
  const sql = `insert into public.dapar_questions (id, domain, layer, skill, difficulty, prompt, instruction_text, figure, options, correct_index, explanation, source, time_limit_seconds)
select id, domain, layer, skill, difficulty, prompt, instruction_text, figure, options, correct_index, explanation, source, time_limit_seconds
from jsonb_populate_recordset(null::public.dapar_questions, '${json}'::jsonb)
on conflict (id) do update set domain = excluded.domain, layer = excluded.layer, skill = excluded.skill, difficulty = excluded.difficulty,
  prompt = excluded.prompt, instruction_text = excluded.instruction_text, figure = excluded.figure, options = excluded.options,
  correct_index = excluded.correct_index, explanation = excluded.explanation, source = excluded.source, time_limit_seconds = excluded.time_limit_seconds;
`
  writeFileSync(new URL(`../supabase/seed/questions-${i + 1}.sql`, import.meta.url), sql)
}
console.log('parts:', Math.ceil(bank.length / size))

// Writes the demo books as SQL, for loading into the Cloudflare D1 database:
//   npm run seed:remote
// (runs this, then `wrangler d1 execute textweaver --remote --file .data/seed-remote.sql`).
// Safe to re-run: rows are INSERT OR REPLACE.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db, Stmt } from '../src/platform';
import { demoStatements } from '../src/seed';

function literal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** A Db that records statements as SQL text instead of running them. */
function recorder(): Db {
  const make = (sql: string, values: unknown[] = []): Stmt & { toSql(): string } => ({
    bind: (...v: unknown[]) => make(sql, v),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ meta: { changes: 0 } }),
    toSql: () => {
      let i = 0;
      return `${sql.replace(/\s+/g, ' ').trim().replace(/\?/g, () => literal(values[i++]))};`;
    },
  });
  return { prepare: (sql) => make(sql), batch: async () => [] };
}

const statements = demoStatements(recorder()) as (Stmt & { toSql(): string })[];
const out = join(process.cwd(), '.data', 'seed-remote.sql');
mkdirSync(join(process.cwd(), '.data'), { recursive: true });
writeFileSync(out, statements.map((s) => s.toSql()).join('\n') + '\n');
console.log(`Wrote ${statements.length} statements to ${out}`);

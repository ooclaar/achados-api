import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

export function criarPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 10 });
}

/** Aplica db/schema.sql. O arquivo é idempotente, então pode rodar a cada inicialização. */
export async function aplicarSchema(pool: Pool): Promise<void> {
  const caminho = path.join(__dirname, '..', '..', 'db', 'schema.sql');
  const sql = await readFile(caminho, 'utf8');
  await pool.query(sql);
}

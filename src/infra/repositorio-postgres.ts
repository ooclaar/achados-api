import type { Pool } from 'pg';
import type { FiltroDeAchados, RepositorioDeAchados } from '../aplicacao/repositorio-de-achados';
import type { Achado, Status } from '../dominio/achado';
import type { Severidade } from '../dominio/severidade';

interface LinhaDeAchado {
  id: string;
  titulo: string;
  descricao: string;
  severidade: Severidade;
  status: Status;
  responsavel: string | null;
  criado_em: Date;
  prazo: Date;
  resolvido_em: Date | null;
}

const COLUNAS =
  'id, titulo, descricao, severidade, status, responsavel, criado_em, prazo, resolvido_em';

function paraAchado(linha: LinhaDeAchado): Achado {
  return {
    id: linha.id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    severidade: linha.severidade,
    status: linha.status,
    responsavel: linha.responsavel,
    criadoEm: linha.criado_em,
    prazo: linha.prazo,
    resolvidoEm: linha.resolvido_em,
  };
}

/** SQL puro com parâmetros ($1, $2...), nunca concatenação de strings. Ver docs/adr/0001. */
export class RepositorioPostgres implements RepositorioDeAchados {
  constructor(private readonly pool: Pool) {}

  async salvar(achado: Achado): Promise<void> {
    await this.pool.query(
      `INSERT INTO achados (${COLUNAS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         responsavel = EXCLUDED.responsavel,
         resolvido_em = EXCLUDED.resolvido_em`,
      [
        achado.id,
        achado.titulo,
        achado.descricao,
        achado.severidade,
        achado.status,
        achado.responsavel,
        achado.criadoEm,
        achado.prazo,
        achado.resolvidoEm,
      ],
    );
  }

  async buscarPorId(id: string): Promise<Achado | null> {
    const resultado = await this.pool.query<LinhaDeAchado>(
      `SELECT ${COLUNAS} FROM achados WHERE id = $1`,
      [id],
    );
    const linha = resultado.rows[0];
    return linha ? paraAchado(linha) : null;
  }

  async listar(filtro: FiltroDeAchados): Promise<Achado[]> {
    const resultado = await this.pool.query<LinhaDeAchado>(
      `SELECT ${COLUNAS} FROM achados
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY criado_em DESC
       LIMIT 100`,
      [filtro.status ?? null],
    );
    return resultado.rows.map(paraAchado);
  }
}

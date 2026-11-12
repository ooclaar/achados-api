import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ServicoDeAchados } from '../../src/aplicacao/servico-de-achados';
import { criarApp } from '../../src/http/app';
import { aplicarSchema, criarPool } from '../../src/infra/banco';
import { RepositorioPostgres } from '../../src/infra/repositorio-postgres';

// Integração de verdade: HTTP -> serviço -> Postgres.
// Precisa do banco no ar: `docker compose up -d db` (no CI, um service container).
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/achados';

describe('fluxo principal com Postgres', () => {
  let pool: Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = criarPool(DATABASE_URL);
    await aplicarSchema(pool);
    app = criarApp({
      servico: new ServicoDeAchados(new RepositorioPostgres(pool)),
      verificarBanco: async () => {
        await pool.query('SELECT 1');
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('registra, atribui, resolve e deixa tudo gravado no banco', async () => {
    const registro = await app.inject({
      method: 'POST',
      url: '/achados',
      payload: { titulo: 'Credencial exposta no repositório', severidade: 'CRITICA' },
    });
    expect(registro.statusCode).toBe(201);
    const { id, criadoEm, prazo } = registro.json<{ id: string; criadoEm: string; prazo: string }>();
    const seteDias = 7 * 24 * 60 * 60 * 1000;
    expect(new Date(prazo).getTime() - new Date(criadoEm).getTime()).toBe(seteDias);

    const atribuicao = await app.inject({
      method: 'POST',
      url: `/achados/${id}/atribuicao`,
      payload: { responsavel: 'ana' },
    });
    expect(atribuicao.statusCode).toBe(200);
    expect(atribuicao.json()).toMatchObject({ status: 'EM_TRATAMENTO', responsavel: 'ana' });

    const resolucao = await app.inject({ method: 'POST', url: `/achados/${id}/resolucao` });
    expect(resolucao.statusCode).toBe(200);

    const consulta = await app.inject({ method: 'GET', url: `/achados/${id}` });
    expect(consulta.statusCode).toBe(200);
    expect(consulta.json()).toMatchObject({ id, status: 'RESOLVIDO', responsavel: 'ana', vencido: false });

    // Confere direto na tabela, sem passar pelo repositório.
    const { rows } = await pool.query(
      'SELECT status, responsavel, resolvido_em FROM achados WHERE id = $1',
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('RESOLVIDO');
    expect(rows[0].responsavel).toBe('ana');
    expect(rows[0].resolvido_em).toBeInstanceOf(Date);
  });

  it('lista por status trazendo o achado recém-criado', async () => {
    const registro = await app.inject({
      method: 'POST',
      url: '/achados',
      payload: { titulo: 'TLS 1.0 habilitado', severidade: 'MEDIA' },
    });
    const { id } = registro.json<{ id: string }>();

    const abertos = await app.inject({ method: 'GET', url: '/achados?status=ABERTO' });
    const resolvidos = await app.inject({ method: 'GET', url: '/achados?status=RESOLVIDO' });

    expect(abertos.json<{ id: string }[]>().map((a) => a.id)).toContain(id);
    expect(resolvidos.json<{ id: string }[]>().map((a) => a.id)).not.toContain(id);
  });

  it('responde 404 para um id que não está no banco', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/achados/22222222-2222-4222-8222-222222222222',
    });

    expect(resposta.statusCode).toBe(404);
  });

  it('GET /health confirma a conexão com o banco', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok' });
  });
});

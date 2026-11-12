import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServicoDeAchados } from '../../src/aplicacao/servico-de-achados';
import { criarApp } from '../../src/http/app';
import { RepositorioEmMemoria } from '../../src/infra/repositorio-em-memoria';

// Camada HTTP isolada: repositório em memória, sem rede e sem banco.
describe('API HTTP', () => {
  const ID_INEXISTENTE = '11111111-1111-4111-8111-111111111111';
  let app: FastifyInstance;
  let bancoNoAr: boolean;

  beforeEach(() => {
    bancoNoAr = true;
    app = criarApp({
      servico: new ServicoDeAchados(new RepositorioEmMemoria()),
      verificarBanco: async () => {
        if (!bancoNoAr) throw new Error('banco fora do ar');
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  async function registrar() {
    const resposta = await app.inject({
      method: 'POST',
      url: '/achados',
      payload: { titulo: 'Bucket S3 público', severidade: 'CRITICA' },
    });
    return resposta.json<{ id: string }>();
  }

  it('POST /achados responde 201 com o achado criado', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/achados',
      payload: { titulo: 'Bucket S3 público', descricao: 'Listagem aberta', severidade: 'CRITICA' },
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toMatchObject({
      titulo: 'Bucket S3 público',
      descricao: 'Listagem aberta',
      severidade: 'CRITICA',
      status: 'ABERTO',
      responsavel: null,
      resolvidoEm: null,
      vencido: false,
    });
  });

  it('POST /achados responde 400 para severidade inválida', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/achados',
      payload: { titulo: 'Bucket S3 público', severidade: 'URGENTE' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toBe('DADOS_INVALIDOS');
  });

  it('POST /achados responde 400 quando o título é só espaços', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/achados',
      payload: { titulo: '     ', severidade: 'BAIXA' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toBe('DADOS_INVALIDOS');
  });

  it('GET /achados/:id responde 404 para achado inexistente', async () => {
    const resposta = await app.inject({ method: 'GET', url: `/achados/${ID_INEXISTENTE}` });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().erro).toBe('ACHADO_NAO_ENCONTRADO');
  });

  it('GET /achados/:id responde 400 quando o id não é um UUID', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/achados/abc' });

    expect(resposta.statusCode).toBe(400);
  });

  it('POST /achados/:id/resolucao responde 409 se o achado ainda está ABERTO', async () => {
    const { id } = await registrar();

    const resposta = await app.inject({ method: 'POST', url: `/achados/${id}/resolucao` });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro).toBe('TRANSICAO_INVALIDA');
  });

  it('GET /achados filtra por status', async () => {
    const aberto = await registrar();
    const emTratamento = await registrar();
    await app.inject({
      method: 'POST',
      url: `/achados/${emTratamento.id}/atribuicao`,
      payload: { responsavel: 'ana' },
    });

    const resposta = await app.inject({ method: 'GET', url: '/achados?status=ABERTO' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json<{ id: string }[]>().map((a) => a.id)).toEqual([aberto.id]);
  });

  it('responde 400 para JSON malformado', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/achados',
      headers: { 'content-type': 'application/json' },
      payload: '{"titulo": ',
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toBe('DADOS_INVALIDOS');
  });

  it('responde 415 (e não 500) para Content-Type não suportado', async () => {
    const { id } = await registrar();

    const resposta = await app.inject({
      method: 'POST',
      url: `/achados/${id}/resolucao`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'a=1',
    });

    expect(resposta.statusCode).toBe(415);
    expect(resposta.json().erro).toBe('REQUISICAO_INVALIDA');
  });

  it('responde 500 sem vazar detalhes quando o repositório falha', async () => {
    const repositorioQuebrado = new RepositorioEmMemoria();
    repositorioQuebrado.listar = async () => {
      throw new Error('connection refused em db:5432');
    };
    const appQuebrado = criarApp({
      servico: new ServicoDeAchados(repositorioQuebrado),
      verificarBanco: async () => {},
    });

    const resposta = await appQuebrado.inject({ method: 'GET', url: '/achados' });
    await appQuebrado.close();

    expect(resposta.statusCode).toBe(500);
    expect(resposta.json()).toEqual({ erro: 'ERRO_INTERNO', mensagem: 'Erro interno' });
  });

  it('GET /health responde 200 com o banco no ar e 503 sem ele', async () => {
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);

    bancoNoAr = false;

    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(503);
  });

  it('GET /metrics expõe a duração por rota e status', async () => {
    await registrar();

    const resposta = await app.inject({ method: 'GET', url: '/metrics' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain(
      'http_request_duration_seconds_count{method="POST",route="/achados",status_code="201"} 1',
    );
  });
});

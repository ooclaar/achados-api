import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { ServicoDeAchados } from '../aplicacao/servico-de-achados';
import { estaVencido, STATUS, type Achado, type Status } from '../dominio/achado';
import { AchadoNaoEncontrado, ErroDeValidacao, TransicaoInvalida } from '../dominio/erros';
import { SEVERIDADES, type Severidade } from '../dominio/severidade';
import { criarMetricas } from './metricas';

export interface DependenciasDoApp {
  servico: ServicoDeAchados;
  /** Lança erro se o banco não responder. Usado pelo /health. */
  verificarBanco: () => Promise<void>;
  logger?: FastifyServerOptions['logger'];
}

// Schemas JSON: o Fastify valida a entrada antes de chamar a rota e responde 400 sozinho.
const parametroId = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const corpoDoRegistro = {
  type: 'object',
  required: ['titulo', 'severidade'],
  additionalProperties: false,
  properties: {
    titulo: { type: 'string', minLength: 3, maxLength: 200 },
    descricao: { type: 'string', maxLength: 5000 },
    severidade: { type: 'string', enum: SEVERIDADES },
  },
} as const;

const corpoDaAtribuicao = {
  type: 'object',
  required: ['responsavel'],
  additionalProperties: false,
  properties: { responsavel: { type: 'string', minLength: 1, maxLength: 100 } },
} as const;

const filtroDaListagem = {
  type: 'object',
  additionalProperties: false,
  properties: { status: { type: 'string', enum: STATUS } },
} as const;

function paraJson(achado: Achado) {
  return {
    id: achado.id,
    titulo: achado.titulo,
    descricao: achado.descricao,
    severidade: achado.severidade,
    status: achado.status,
    responsavel: achado.responsavel,
    criadoEm: achado.criadoEm.toISOString(),
    prazo: achado.prazo.toISOString(),
    resolvidoEm: achado.resolvidoEm?.toISOString() ?? null,
    vencido: estaVencido(achado, new Date()),
  };
}

/**
 * Erros que o próprio Fastify gera por culpa do cliente (schema inválido, JSON malformado,
 * Content-Type não suportado) já chegam com statusCode 4xx. Devolve esse status, ou null.
 */
function statusDeErroDoCliente(erro: unknown): number | null {
  if (typeof erro !== 'object' || erro === null || !('statusCode' in erro)) {
    return null;
  }
  const status = Number(erro.statusCode);
  return status >= 400 && status < 500 ? status : null;
}

export function criarApp({ servico, verificarBanco, logger = false }: DependenciasDoApp): FastifyInstance {
  const app = Fastify({ logger });
  const metricas = criarMetricas();

  // Métrica: uma observação por resposta, com a rota declarada (/achados/:id), não a URL real.
  app.addHook('onResponse', async (request, reply) => {
    metricas.duracaoHttp.observe(
      {
        method: request.method,
        route: request.routeOptions.url ?? 'rota_desconhecida',
        status_code: String(reply.statusCode),
      },
      reply.elapsedTime / 1000,
    );
  });

  // Traduz erros do domínio para HTTP em um único lugar.
  app.setErrorHandler((erro: unknown, request, reply) => {
    if (erro instanceof AchadoNaoEncontrado) {
      return reply.status(404).send({ erro: 'ACHADO_NAO_ENCONTRADO', mensagem: erro.message });
    }
    if (erro instanceof TransicaoInvalida) {
      return reply.status(409).send({ erro: 'TRANSICAO_INVALIDA', mensagem: erro.message });
    }
    if (erro instanceof ErroDeValidacao) {
      return reply.status(400).send({ erro: 'DADOS_INVALIDOS', mensagem: erro.message });
    }
    const statusDoCliente = statusDeErroDoCliente(erro);
    if (statusDoCliente !== null) {
      return reply.status(statusDoCliente).send({
        erro: statusDoCliente === 400 ? 'DADOS_INVALIDOS' : 'REQUISICAO_INVALIDA',
        mensagem: erro instanceof Error ? erro.message : 'Requisição inválida',
      });
    }
    request.log.error({ err: erro }, 'erro inesperado');
    return reply.status(500).send({ erro: 'ERRO_INTERNO', mensagem: 'Erro interno' });
  });

  app.get('/health', async (_request, reply) => {
    try {
      await verificarBanco();
      return { status: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'indisponivel' });
    }
  });

  app.get('/metrics', async (_request, reply) => {
    return reply.type(metricas.registro.contentType).send(await metricas.registro.metrics());
  });

  app.post<{ Body: { titulo: string; descricao?: string; severidade: Severidade } }>(
    '/achados',
    { schema: { body: corpoDoRegistro } },
    async (request, reply) => {
      const achado = await servico.registrar(request.body);
      request.log.info(
        { achadoId: achado.id, severidade: achado.severidade, prazo: achado.prazo },
        'achado registrado',
      );
      return reply.status(201).send(paraJson(achado));
    },
  );

  app.get<{ Querystring: { status?: Status } }>(
    '/achados',
    { schema: { querystring: filtroDaListagem } },
    async (request) => {
      const achados = await servico.listar({ status: request.query.status });
      return achados.map(paraJson);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/achados/:id',
    { schema: { params: parametroId } },
    async (request) => paraJson(await servico.buscar(request.params.id)),
  );

  app.post<{ Params: { id: string }; Body: { responsavel: string } }>(
    '/achados/:id/atribuicao',
    { schema: { params: parametroId, body: corpoDaAtribuicao } },
    async (request) => {
      const achado = await servico.atribuir(request.params.id, request.body.responsavel);
      request.log.info(
        { achadoId: achado.id, responsavel: achado.responsavel },
        'achado atribuído',
      );
      return paraJson(achado);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/achados/:id/resolucao',
    { schema: { params: parametroId } },
    async (request) => {
      const achado = await servico.resolver(request.params.id);
      request.log.info({ achadoId: achado.id }, 'achado resolvido');
      return paraJson(achado);
    },
  );

  return app;
}

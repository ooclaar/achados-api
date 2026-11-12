import { ErroDeValidacao, TransicaoInvalida } from './erros';
import { calcularPrazo, SEVERIDADES, type Severidade } from './severidade';

export const STATUS = ['ABERTO', 'EM_TRATAMENTO', 'RESOLVIDO'] as const;
export type Status = (typeof STATUS)[number];

/**
 * Achado de segurança (vulnerabilidade encontrada em um sistema).
 * Ciclo de vida: ABERTO -> EM_TRATAMENTO -> RESOLVIDO.
 */
export interface Achado {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly severidade: Severidade;
  readonly status: Status;
  readonly responsavel: string | null;
  readonly criadoEm: Date;
  readonly prazo: Date;
  readonly resolvidoEm: Date | null;
}

export interface DadosDoNovoAchado {
  id: string;
  titulo: string;
  descricao?: string;
  severidade: Severidade;
}

// As funções abaixo são puras: recebem o achado e devolvem um novo, sem tocar em banco ou relógio.

export function registrarAchado(dados: DadosDoNovoAchado, agora: Date): Achado {
  const titulo = dados.titulo.trim();
  if (titulo.length < 3) {
    throw new ErroDeValidacao('O título precisa ter pelo menos 3 caracteres');
  }
  if (!SEVERIDADES.includes(dados.severidade)) {
    throw new ErroDeValidacao(`Severidade inválida: ${String(dados.severidade)}`);
  }

  return {
    id: dados.id,
    titulo,
    descricao: (dados.descricao ?? '').trim(),
    severidade: dados.severidade,
    status: 'ABERTO',
    responsavel: null,
    criadoEm: agora,
    prazo: calcularPrazo(dados.severidade, agora),
    resolvidoEm: null,
  };
}

/** Define (ou troca) o responsável e coloca o achado em tratamento. */
export function atribuirAchado(achado: Achado, responsavel: string): Achado {
  if (achado.status === 'RESOLVIDO') {
    throw new TransicaoInvalida('Um achado resolvido não pode ser atribuído');
  }
  const nome = responsavel.trim();
  if (nome.length === 0) {
    throw new ErroDeValidacao('O responsável é obrigatório');
  }

  return { ...achado, responsavel: nome, status: 'EM_TRATAMENTO' };
}

/** Só se resolve o que está em tratamento, ou seja, o que já tem responsável. */
export function resolverAchado(achado: Achado, agora: Date): Achado {
  if (achado.status !== 'EM_TRATAMENTO') {
    throw new TransicaoInvalida(
      `Só é possível resolver um achado EM_TRATAMENTO (status atual: ${achado.status})`,
    );
  }

  return { ...achado, status: 'RESOLVIDO', resolvidoEm: agora };
}

/** Vencido = passou do prazo e ainda não foi resolvido. */
export function estaVencido(achado: Achado, agora: Date): boolean {
  return achado.status !== 'RESOLVIDO' && agora.getTime() > achado.prazo.getTime();
}

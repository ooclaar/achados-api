import { describe, expect, it } from 'vitest';
import {
  atribuirAchado,
  estaVencido,
  registrarAchado,
  resolverAchado,
} from '../../src/dominio/achado';
import { ErroDeValidacao, TransicaoInvalida } from '../../src/dominio/erros';
import type { Severidade } from '../../src/dominio/severidade';

const AGORA = new Date('2026-11-10T12:00:00.000Z');
const UM_DIA = 24 * 60 * 60 * 1000;

function novoAchado(severidade: Severidade = 'ALTA') {
  return registrarAchado(
    { id: 'a1', titulo: 'SQL injection no login', severidade },
    AGORA,
  );
}

describe('registrarAchado', () => {
  it('nasce ABERTO, sem responsável e com prazo pela severidade', () => {
    const achado = novoAchado('CRITICA');

    expect(achado.status).toBe('ABERTO');
    expect(achado.responsavel).toBeNull();
    expect(achado.resolvidoEm).toBeNull();
    expect(achado.criadoEm).toEqual(AGORA);
    expect(achado.prazo.toISOString()).toBe('2026-11-17T12:00:00.000Z');
  });

  it('remove espaços nas pontas do título e da descrição', () => {
    const achado = registrarAchado(
      { id: 'a1', titulo: '  XSS na busca  ', descricao: '  refletido  ', severidade: 'MEDIA' },
      AGORA,
    );

    expect(achado.titulo).toBe('XSS na busca');
    expect(achado.descricao).toBe('refletido');
  });

  it('recusa título com menos de 3 caracteres', () => {
    expect(() =>
      registrarAchado({ id: 'a1', titulo: '  x ', severidade: 'BAIXA' }, AGORA),
    ).toThrow(ErroDeValidacao);
  });

  it('recusa severidade desconhecida', () => {
    expect(() =>
      registrarAchado(
        { id: 'a1', titulo: 'Porta aberta', severidade: 'URGENTE' as Severidade },
        AGORA,
      ),
    ).toThrow(ErroDeValidacao);
  });
});

describe('atribuirAchado', () => {
  it('define o responsável e passa para EM_TRATAMENTO', () => {
    const achado = atribuirAchado(novoAchado(), ' ana ');

    expect(achado.status).toBe('EM_TRATAMENTO');
    expect(achado.responsavel).toBe('ana');
  });

  it('permite trocar o responsável de um achado em tratamento', () => {
    const achado = atribuirAchado(atribuirAchado(novoAchado(), 'ana'), 'bruno');

    expect(achado.status).toBe('EM_TRATAMENTO');
    expect(achado.responsavel).toBe('bruno');
  });

  it('recusa responsável em branco', () => {
    expect(() => atribuirAchado(novoAchado(), '   ')).toThrow(ErroDeValidacao);
  });

  it('recusa atribuir um achado já resolvido', () => {
    const resolvido = resolverAchado(atribuirAchado(novoAchado(), 'ana'), AGORA);

    expect(() => atribuirAchado(resolvido, 'bruno')).toThrow(TransicaoInvalida);
  });

  it('não modifica o achado original', () => {
    const original = novoAchado();
    atribuirAchado(original, 'ana');

    expect(original.status).toBe('ABERTO');
    expect(original.responsavel).toBeNull();
  });
});

describe('resolverAchado', () => {
  it('resolve um achado em tratamento e registra a data', () => {
    const depois = new Date(AGORA.getTime() + UM_DIA);
    const achado = resolverAchado(atribuirAchado(novoAchado(), 'ana'), depois);

    expect(achado.status).toBe('RESOLVIDO');
    expect(achado.resolvidoEm).toEqual(depois);
    expect(achado.responsavel).toBe('ana');
  });

  it('recusa resolver um achado ABERTO (sem responsável)', () => {
    expect(() => resolverAchado(novoAchado(), AGORA)).toThrow(TransicaoInvalida);
  });

  it('recusa resolver duas vezes', () => {
    const resolvido = resolverAchado(atribuirAchado(novoAchado(), 'ana'), AGORA);

    expect(() => resolverAchado(resolvido, AGORA)).toThrow(TransicaoInvalida);
  });
});

describe('estaVencido', () => {
  const achado = novoAchado('CRITICA'); // prazo: 7 dias

  it('não está vencido dentro do prazo', () => {
    expect(estaVencido(achado, new Date(AGORA.getTime() + 6 * UM_DIA))).toBe(false);
  });

  it('não está vencido exatamente no instante do prazo', () => {
    expect(estaVencido(achado, achado.prazo)).toBe(false);
  });

  it('está vencido depois do prazo', () => {
    expect(estaVencido(achado, new Date(AGORA.getTime() + 8 * UM_DIA))).toBe(true);
  });

  it('um achado resolvido nunca está vencido', () => {
    const resolvido = resolverAchado(atribuirAchado(achado, 'ana'), AGORA);

    expect(estaVencido(resolvido, new Date(AGORA.getTime() + 30 * UM_DIA))).toBe(false);
  });
});

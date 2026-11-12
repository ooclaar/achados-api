import { beforeEach, describe, expect, it } from 'vitest';
import { ServicoDeAchados } from '../../src/aplicacao/servico-de-achados';
import { AchadoNaoEncontrado, TransicaoInvalida } from '../../src/dominio/erros';
import { RepositorioEmMemoria } from '../../src/infra/repositorio-em-memoria';

describe('ServicoDeAchados', () => {
  let relogio: Date;
  let repositorio: RepositorioEmMemoria;
  let servico: ServicoDeAchados;

  beforeEach(() => {
    relogio = new Date('2026-11-10T12:00:00.000Z');
    repositorio = new RepositorioEmMemoria();
    let sequencia = 0;
    servico = new ServicoDeAchados(
      repositorio,
      () => relogio,
      () => `id-${++sequencia}`,
    );
  });

  it('registra e persiste o achado', async () => {
    const achado = await servico.registrar({ titulo: 'Senha fraca no admin', severidade: 'ALTA' });

    expect(achado.id).toBe('id-1');
    expect(await repositorio.buscarPorId('id-1')).toEqual(achado);
  });

  it('percorre o fluxo principal: registrar, atribuir e resolver', async () => {
    const { id } = await servico.registrar({ titulo: 'Senha fraca no admin', severidade: 'ALTA' });

    await servico.atribuir(id, 'ana');
    relogio = new Date('2026-11-12T09:00:00.000Z');
    await servico.resolver(id);

    const salvo = await servico.buscar(id);
    expect(salvo.status).toBe('RESOLVIDO');
    expect(salvo.responsavel).toBe('ana');
    expect(salvo.resolvidoEm).toEqual(new Date('2026-11-12T09:00:00.000Z'));
  });

  it('não persiste nada quando a regra de domínio recusa a transição', async () => {
    const { id } = await servico.registrar({ titulo: 'Senha fraca no admin', severidade: 'ALTA' });

    await expect(servico.resolver(id)).rejects.toThrow(TransicaoInvalida);

    expect((await servico.buscar(id)).status).toBe('ABERTO');
  });

  it('avisa quando o achado não existe', async () => {
    await expect(servico.buscar('inexistente')).rejects.toThrow(AchadoNaoEncontrado);
    await expect(servico.atribuir('inexistente', 'ana')).rejects.toThrow(AchadoNaoEncontrado);
    await expect(servico.resolver('inexistente')).rejects.toThrow(AchadoNaoEncontrado);
  });

  it('lista os mais recentes primeiro e filtra por status', async () => {
    const primeiro = await servico.registrar({ titulo: 'Primeiro achado', severidade: 'BAIXA' });
    relogio = new Date('2026-11-11T12:00:00.000Z');
    const segundo = await servico.registrar({ titulo: 'Segundo achado', severidade: 'MEDIA' });
    await servico.atribuir(primeiro.id, 'ana');

    const todos = await servico.listar();
    const abertos = await servico.listar({ status: 'ABERTO' });

    expect(todos.map((a) => a.id)).toEqual([segundo.id, primeiro.id]);
    expect(abertos.map((a) => a.id)).toEqual([segundo.id]);
  });
});

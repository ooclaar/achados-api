import { randomUUID } from 'node:crypto';
import {
  atribuirAchado,
  registrarAchado,
  resolverAchado,
  type Achado,
} from '../dominio/achado';
import { AchadoNaoEncontrado } from '../dominio/erros';
import type { Severidade } from '../dominio/severidade';
import type { FiltroDeAchados, RepositorioDeAchados } from './repositorio-de-achados';

export interface ComandoRegistrar {
  titulo: string;
  descricao?: string;
  severidade: Severidade;
}

/**
 * Casos de uso do fluxo principal: registrar -> atribuir -> resolver.
 * Relógio e gerador de id entram pelo construtor para os testes controlarem o tempo.
 */
export class ServicoDeAchados {
  constructor(
    private readonly repositorio: RepositorioDeAchados,
    private readonly agora: () => Date = () => new Date(),
    private readonly gerarId: () => string = randomUUID,
  ) {}

  async registrar(comando: ComandoRegistrar): Promise<Achado> {
    const achado = registrarAchado({ id: this.gerarId(), ...comando }, this.agora());
    await this.repositorio.salvar(achado);
    return achado;
  }

  async atribuir(id: string, responsavel: string): Promise<Achado> {
    const achado = atribuirAchado(await this.buscar(id), responsavel);
    await this.repositorio.salvar(achado);
    return achado;
  }

  async resolver(id: string): Promise<Achado> {
    const achado = resolverAchado(await this.buscar(id), this.agora());
    await this.repositorio.salvar(achado);
    return achado;
  }

  async buscar(id: string): Promise<Achado> {
    const achado = await this.repositorio.buscarPorId(id);
    if (!achado) {
      throw new AchadoNaoEncontrado(id);
    }
    return achado;
  }

  listar(filtro: FiltroDeAchados = {}): Promise<Achado[]> {
    return this.repositorio.listar(filtro);
  }
}

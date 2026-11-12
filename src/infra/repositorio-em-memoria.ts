import type { FiltroDeAchados, RepositorioDeAchados } from '../aplicacao/repositorio-de-achados';
import type { Achado } from '../dominio/achado';

/** Implementação usada nos testes unitários: mesma interface, sem banco. */
export class RepositorioEmMemoria implements RepositorioDeAchados {
  private readonly achados = new Map<string, Achado>();

  async salvar(achado: Achado): Promise<void> {
    this.achados.set(achado.id, achado);
  }

  async buscarPorId(id: string): Promise<Achado | null> {
    return this.achados.get(id) ?? null;
  }

  async listar(filtro: FiltroDeAchados): Promise<Achado[]> {
    return [...this.achados.values()]
      .filter((achado) => !filtro.status || achado.status === filtro.status)
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
      .slice(0, 100);
  }
}

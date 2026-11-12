import type { Achado, Status } from '../dominio/achado';

export interface FiltroDeAchados {
  status?: Status;
}

/**
 * Pattern Repository: o caso de uso conhece só esta interface.
 * Quem fala com o Postgres (ou com a memória, nos testes) fica em src/infra.
 */
export interface RepositorioDeAchados {
  /** Insere o achado ou atualiza o que já existe com o mesmo id. */
  salvar(achado: Achado): Promise<void>;
  buscarPorId(id: string): Promise<Achado | null>;
  /** Mais recentes primeiro, no máximo 100. */
  listar(filtro: FiltroDeAchados): Promise<Achado[]>;
}

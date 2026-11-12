/** Dados de entrada que violam uma regra do domínio (vira HTTP 400). */
export class ErroDeValidacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeValidacao';
  }
}

/** Mudança de status que o ciclo de vida do achado não permite (vira HTTP 409). */
export class TransicaoInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'TransicaoInvalida';
  }
}

/** O achado pedido não existe (vira HTTP 404). */
export class AchadoNaoEncontrado extends Error {
  constructor(id: string) {
    super(`Achado ${id} não encontrado`);
    this.name = 'AchadoNaoEncontrado';
  }
}

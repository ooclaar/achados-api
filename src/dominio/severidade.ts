export const SEVERIDADES = ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'] as const;
export type Severidade = (typeof SEVERIDADES)[number];

/** Quantos dias o time tem para tratar um achado, conforme a severidade. */
export const DIAS_PARA_TRATAR: Record<Severidade, number> = {
  CRITICA: 7,
  ALTA: 30,
  MEDIA: 90,
  BAIXA: 180,
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Prazo de tratamento: data de registro + dias da severidade. */
export function calcularPrazo(severidade: Severidade, criadoEm: Date): Date {
  return new Date(criadoEm.getTime() + DIAS_PARA_TRATAR[severidade] * MS_POR_DIA);
}

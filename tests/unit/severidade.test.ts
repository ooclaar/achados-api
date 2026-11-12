import { describe, expect, it } from 'vitest';
import { calcularPrazo } from '../../src/dominio/severidade';

describe('calcularPrazo', () => {
  const registro = new Date('2026-11-10T12:00:00.000Z');

  it.each([
    ['CRITICA', '2026-11-17T12:00:00.000Z'],
    ['ALTA', '2026-12-10T12:00:00.000Z'],
    ['MEDIA', '2027-02-08T12:00:00.000Z'],
    ['BAIXA', '2027-05-09T12:00:00.000Z'],
  ] as const)('severidade %s vence em %s', (severidade, esperado) => {
    expect(calcularPrazo(severidade, registro).toISOString()).toBe(esperado);
  });

  it('não altera a data de registro recebida', () => {
    calcularPrazo('CRITICA', registro);

    expect(registro.toISOString()).toBe('2026-11-10T12:00:00.000Z');
  });
});

import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../../src/config';

describe('carregarConfig', () => {
  it('lê os valores do ambiente', () => {
    const config = carregarConfig({
      DATABASE_URL: 'postgres://exemplo',
      PORT: '8080',
      LOG_LEVEL: 'debug',
    });

    expect(config).toEqual({ databaseUrl: 'postgres://exemplo', port: 8080, logLevel: 'debug' });
  });

  it('usa porta 3000 e nível info quando não informados', () => {
    const config = carregarConfig({ DATABASE_URL: 'postgres://exemplo' });

    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe('info');
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => carregarConfig({})).toThrow('DATABASE_URL');
  });

  it('falha com PORT inválida', () => {
    expect(() => carregarConfig({ DATABASE_URL: 'postgres://exemplo', PORT: 'abc' })).toThrow(
      'PORT inválida',
    );
  });
});

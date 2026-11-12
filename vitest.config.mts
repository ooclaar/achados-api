import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // server.ts só liga as peças e abre a porta; é exercitado pelo Compose e pelo k6.
      exclude: ['src/server.ts'],
      reporter: ['text', 'text-summary'],
      // Coverage mínimo declarado no README. Abaixo disso o comando falha e o CI fica vermelho.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});

import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

export interface Metricas {
  registro: Registry;
  duracaoHttp: Histogram<'method' | 'route' | 'status_code'>;
}

/**
 * Um histograma por requisição dá os três sinais RED:
 * taxa (_count), erros (label status_code) e duração (_bucket, de onde sai o p95).
 */
export function criarMetricas(): Metricas {
  const registro = new Registry();
  collectDefaultMetrics({ register: registro });

  const duracaoHttp = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições HTTP, em segundos',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2.5],
    registers: [registro],
  });

  return { registro, duracaoHttp };
}

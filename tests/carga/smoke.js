// Smoke test k6: percorre o fluxo principal com pouca carga e mede o p95.
// Rodar: docker compose --profile carga run --rm --build k6
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };
const SEVERIDADES = ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'];

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    // Mesmo número do SLO declarado no README: p95 abaixo de 200 ms.
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const severidade = SEVERIDADES[__ITER % SEVERIDADES.length];

  const registro = http.post(
    `${BASE_URL}/achados`,
    JSON.stringify({ titulo: `Achado de carga ${__VU}-${__ITER}`, severidade }),
    JSON_HEADERS,
  );
  check(registro, { 'registro: 201': (r) => r.status === 201 });
  if (registro.status !== 201) {
    return;
  }
  const id = registro.json('id');

  const atribuicao = http.post(
    `${BASE_URL}/achados/${id}/atribuicao`,
    JSON.stringify({ responsavel: `analista-${__VU}` }),
    JSON_HEADERS,
  );
  check(atribuicao, {
    'atribuição: 200 e EM_TRATAMENTO': (r) => r.status === 200 && r.json('status') === 'EM_TRATAMENTO',
  });

  const resolucao = http.post(`${BASE_URL}/achados/${id}/resolucao`, null);
  check(resolucao, { 'resolução: 200': (r) => r.status === 200 });

  const consulta = http.get(`${BASE_URL}/achados/${id}`);
  check(consulta, {
    'consulta: 200 e RESOLVIDO': (r) => r.status === 200 && r.json('status') === 'RESOLVIDO',
  });
}

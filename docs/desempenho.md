# Desempenho

## O que foi medido

Smoke test k6 ([tests/carga/smoke.js](../tests/carga/smoke.js)) contra a API e o
Postgres do Compose. Cada iteração percorre o fluxo principal: registrar, atribuir,
resolver e consultar (4 requisições).

- **Carga:** 5 usuários virtuais por 30 s, sem pausa entre iterações.
- **Critério de aprovação (igual ao SLO do README):** p95 abaixo de 200 ms, menos de
  1% de falhas e mais de 99% dos checks passando.

Como reproduzir:

```bash
docker compose up -d --build
docker compose --profile carga run --rm --build k6
```

## Resultado

Medido em 10/11/2026, k6 v2.3.0.

| Métrica | Valor | Limite | Situação |
|---|---|---|---|
| p95 de `http_req_duration` | **1,56 ms** | < 200 ms | aprovado |
| Falhas (`http_req_failed`) | **0,00%** (0 de 138.980) | < 1% | aprovado |
| Checks | **100%** (138.980 de 138.980) | > 99% | aprovado |

Outros números da mesma execução:

| Métrica | Valor |
|---|---|
| Requisições | 138.980 (4.632 por segundo) |
| Iterações do fluxo completo | 34.745 (1.158 por segundo) |
| Duração: média / mediana / p90 / máxima | 1,01 ms / 0,98 ms / 1,40 ms / 104,57 ms |

Ambiente: Windows 11, Docker Desktop 29.9.2 (VM com 16 CPUs e cerca de 3,9 GB de RAM),
processador Intel Core 7 240H, 64 GB de RAM. API, banco e k6 na mesma máquina.

## Consulta de listagem

A única consulta que cresce com o volume é a listagem por status. Depois do teste
(34.748 achados RESOLVIDO na tabela), o plano usa o índice
`idx_achados_status_criado_em` e lê só as 100 linhas devolvidas:

```
EXPLAIN ANALYZE
SELECT id FROM achados WHERE status = 'RESOLVIDO' ORDER BY criado_em DESC LIMIT 100;

Limit  (actual time=0.013..0.032 rows=100 loops=1)
  ->  Index Scan using idx_achados_status_criado_em on achados
        (actual time=0.013..0.029 rows=100 loops=1)
        Index Cond: (status = 'RESOLVIDO'::text)
Planning Time: 0.072 ms
Execution Time: 0.046 ms
```

Observação: o plano acima foi tirado com o filtro escrito direto na consulta. A
aplicação envia o status como parâmetro (`$1::text IS NULL OR status = $1`).

## Como ler estes números

- É um **smoke test**, não um teste de capacidade: prova que o fluxo aguenta carga
  leve dentro do SLO e dá uma linha de base para comparar depois.
- O gerador de carga roda na mesma máquina que a API, sem latência de rede. Em um
  ambiente hospedado o p95 será maior.
- A máxima de 104 ms aparece uma única vez, provavelmente no aquecimento das conexões
  com o banco; não foi investigada.

## O que faria diferente com mais tempo

- Teste em estágios (rampa, platô, pico) para achar o ponto em que o p95 degrada.
- Medir a listagem sem filtro e com paginação.
- Rodar o k6 de outra máquina, contra um ambiente hospedado.

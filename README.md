# Achados API — Projeto Final Full Cycle, nível B

API de domínio único para gestão de **achados de segurança** (vulnerabilidades
encontradas em sistemas). O fluxo principal funciona de ponta a ponta:

**registrar** um achado → **atribuir** um responsável → **resolver**.

Regras de negócio:

- O prazo de tratamento é calculado pela severidade: CRITICA 7 dias, ALTA 30, MEDIA 90, BAIXA 180.
- Ciclo de vida: `ABERTO` → `EM_TRATAMENTO` → `RESOLVIDO`.
- Só se resolve um achado que está em tratamento (ou seja, que tem responsável).
- Achado resolvido não pode ser reatribuído.
- `vencido` é verdadeiro quando o prazo passou e o achado não foi resolvido.

CI: <!-- TODO: cole aqui o link da execução verde do GitHub Actions -->

## Como subir (1 comando)

Pré-requisito: Docker com Compose.

```bash
docker compose up --build
```

A API fica em `http://localhost:3000`. O schema do banco é aplicado na inicialização.

### Exercitando o fluxo

```bash
# 1. registrar (a resposta traz o id e o prazo calculado)
curl -s -X POST http://localhost:3000/achados \
  -H 'Content-Type: application/json' \
  -d '{"titulo":"Credencial exposta no repositório","severidade":"CRITICA"}'

# 2. atribuir (troque <id> pelo id devolvido acima)
curl -s -X POST http://localhost:3000/achados/<id>/atribuicao \
  -H 'Content-Type: application/json' \
  -d '{"responsavel":"ana"}'

# 3. resolver
curl -s -X POST http://localhost:3000/achados/<id>/resolucao

# consultar e listar
curl -s http://localhost:3000/achados/<id>
curl -s 'http://localhost:3000/achados?status=RESOLVIDO'
```

O contrato completo está em [docs/openapi.yaml](docs/openapi.yaml).

## Como testar

Pré-requisito: Node.js 22 ou mais novo.

```bash
npm ci
npm run test:unit            # domínio, serviço e camada HTTP; não precisa de banco

docker compose up -d db      # o teste de integração usa o Postgres do Compose
npm test                     # unitários + integração, com coverage mínimo
```

Outras verificações (as mesmas do CI):

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run lint:api     # Spectral sobre docs/openapi.yaml
```

**Coverage mínimo declarado:** 80% de linhas, statements e funções; 75% de branches.
O limite está em [vitest.config.mts](vitest.config.mts): abaixo dele `npm test` falha
e o CI fica vermelho.

## Configuração e segredos

Toda configuração vem de variáveis de ambiente, listadas em [.env.example](.env.example).

| Variável | Para que serve | Padrão |
|---|---|---|
| `DATABASE_URL` | Conexão com o Postgres | obrigatória |
| `PORT` | Porta HTTP | `3000` |
| `LOG_LEVEL` | Nível do log (pino) | `info` |

- O arquivo `.env` está no `.gitignore` e nunca vai para o repositório.
- Os valores padrão do `docker-compose.yml` existem só para desenvolvimento local.
- O CI roda o gitleaks em todo push para barrar segredo commitado.

## Observabilidade

- **Logs estruturados:** JSON no stdout (pino, embutido no Fastify), com `reqId` em
  cada linha e eventos de negócio (`achado registrado`, `achado atribuído`, `achado resolvido`).
- **Métrica:** histograma `http_request_duration_seconds` por método, rota e status,
  em `GET /metrics` (formato Prometheus). Dele saem taxa, erros e duração.
- **Saúde:** `GET /health` responde 200 só se o banco responder.

### SLO

> 95% das requisições respondem em menos de **200 ms** e menos de **1%** falham,
> medido em janela de 7 dias.

Consulta do indicador no Prometheus:

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

O smoke test k6 usa o mesmo limite como critério de aprovação.

## Teste de carga

```bash
docker compose --profile carga run --rm --build k6
```

Roda [tests/carga/smoke.js](tests/carga/smoke.js) contra a API do Compose (5 usuários
virtuais, 30 s, fluxo completo). O resultado medido está em
[docs/desempenho.md](docs/desempenho.md).

## Estrutura

```
.
├─ docker-compose.yml         API + Postgres (+ k6 sob o profile "carga")
├─ Dockerfile
├─ db/schema.sql              schema idempotente
├─ docs/
│  ├─ adr/0001-sql-puro-com-repository.md
│  ├─ openapi.yaml
│  ├─ desempenho.md
│  └─ ia.md
├─ src/
│  ├─ dominio/                regras puras: achado, severidade, erros
│  ├─ aplicacao/              casos de uso e a interface do repositório
│  ├─ infra/                  Postgres e repositório em memória
│  ├─ http/                   rotas Fastify e métricas
│  ├─ config.ts
│  └─ server.ts               composição das dependências
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ carga/smoke.js
└─ .github/workflows/ci.yml
```

## Decisões de design

- **Pattern: Repository.** O serviço depende da interface `RepositorioDeAchados`; o
  Postgres é um detalhe trocável. É o que permite testar as regras sem banco.
  Justificativa e alternativa descartada (Prisma) em
  [docs/adr/0001-sql-puro-com-repository.md](docs/adr/0001-sql-puro-com-repository.md).
- **SOLID na prática:**
  - *Responsabilidade única:* regra de negócio em `dominio/`, orquestração em
    `aplicacao/`, HTTP em `http/`, SQL em `infra/`.
  - *Inversão de dependência:* `ServicoDeAchados` recebe o repositório, o relógio e o
    gerador de id pelo construtor.
  - *Aberto/fechado:* um novo armazenamento é uma nova classe que implementa a
    interface, sem alterar o serviço.
- **Domínio imutável:** `atribuirAchado` e `resolverAchado` devolvem um novo objeto.

## Limitações conhecidas

- Sem autenticação: fora do escopo do nível B.
- Sem ferramenta de migrations e sem trava de concorrência (detalhes no ADR).
- A listagem devolve no máximo 100 achados, sem paginação.

## Uso de IA

Declarado em [docs/ia.md](docs/ia.md). Contribuições em [CONTRIBUTORS.md](CONTRIBUTORS.md).

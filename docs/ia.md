# Uso de IA

Ferramenta: Claude Code (Anthropic), em 10/11/2026.

## O que a IA fez

A primeira versão deste repositório foi gerada pela IA em uma única sessão: estrutura
de pastas, código do domínio, serviço, repositórios, rotas, testes, Dockerfile, Compose,
workflow de CI, OpenAPI, ADR e esta documentação. A IA também rodou lint, testes e o
smoke test k6 localmente.

## Prompts que importaram

1. Enviei o link dos slides do projeto final e pedi:
   *"Poderia analisar esse projeto e elaborar algumas ideias? De como executar?"*
   A IA resumiu os requisitos, recomendou o nível B pelo prazo e propôs quatro domínios.
2. *"Vamos fazer o B então."*
   A IA perguntou o domínio e o framework. Escolhi **achados de segurança** e **Fastify**.

## Decisões que foram minhas

- Nível B, domínio (achados de segurança) e framework (Fastify).
- Todo o projeto foi feito usando inteligência artificial. Usei a IA para planejar tudo
  antes da implementação e, agora que está pronto, está tudo funcionando.

## Sugestões da IA que avaliei

| Sugestão | O que fiz | Por quê |
|---|---|---|
| SQL puro com `pg` + Repository em vez de Prisma | Aceitei | O projeto tem uma tabela e três consultas. Um ORM traria geração de cliente e um segundo schema para manter, sem ganho proporcional. Com o Repository, as regras são testadas sem banco. Detalhes em [adr/0001](adr/0001-sql-puro-com-repository.md). |
| Prazos 7/30/90/180 dias por severidade | Aceitei | Seguem a lógica usual de gestão de vulnerabilidades: quanto mais grave, menos tempo para tratar. Ficam em um único lugar (`src/dominio/severidade.ts`), então mudar a política é alterar uma tabela. |
| SLO de p95 < 200 ms | Aceitei | É um limite simples de comunicar e de verificar. O k6 mediu p95 em torno de 1,6 ms na máquina local, o que deixa folga para um ambiente hospedado, com latência de rede. |

## O que eu sei explicar

O projeto é dividido em quatro camadas, e cada uma só conhece a de dentro:

- **Domínio (`src/dominio`)**: as regras de negócio, em funções puras. `registrarAchado`
  cria o achado como `ABERTO` e calcula o prazo; `atribuirAchado` define o responsável e
  passa para `EM_TRATAMENTO`; `resolverAchado` só aceita achado em tratamento. Nenhuma
  delas acessa banco ou relógio: recebem os dados e devolvem um novo objeto. Por isso os
  testes unitários rodam em milissegundos.
- **Aplicação (`src/aplicacao`)**: o `ServicoDeAchados` orquestra cada caso de uso em três
  passos: busca o achado, aplica a função do domínio e salva. Ele depende apenas da
  interface `RepositorioDeAchados`, e recebe o relógio e o gerador de id pelo construtor,
  o que permite controlar o tempo nos testes.
- **Infra (`src/infra`)**: duas implementações da mesma interface. `RepositorioPostgres`
  usa SQL parametrizado (`$1`, `$2`) e um `INSERT ... ON CONFLICT` para inserir ou
  atualizar. `RepositorioEmMemoria` guarda os achados em um `Map` e existe para os testes.
- **HTTP (`src/http`)**: as rotas Fastify. A entrada é validada por JSON Schema antes de
  chegar à rota. Um único tratador traduz os erros do domínio: `ErroDeValidacao` vira 400,
  `AchadoNaoEncontrado` vira 404 e `TransicaoInvalida` vira 409. Um hook registra a
  duração de cada resposta no histograma exposto em `/metrics`.

O `src/server.ts` é o único lugar que escolhe a implementação Postgres e liga as peças.

Exemplo de uma requisição de ponta a ponta, `POST /achados/:id/resolucao`:

1. O Fastify valida que o `id` é um UUID; se não for, responde 400.
2. A rota chama `servico.resolver(id)`.
3. O serviço busca o achado no repositório; se não existir, lança `AchadoNaoEncontrado` (404).
4. `resolverAchado` confere o status; se não for `EM_TRATAMENTO`, lança `TransicaoInvalida` (409).
5. O serviço salva o achado resolvido e a rota devolve o JSON com `status: RESOLVIDO`.

A decisão que eu defenderia na apresentação é o Repository: é ele que separa a regra de
negócio do banco e que torna possível testar o fluxo inteiro sem Postgres.

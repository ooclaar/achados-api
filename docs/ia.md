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
| SQL puro com `pg` + Repository em vez de Prisma | <!-- aceitei / mudei --> | <!-- sua justificativa; veja docs/adr/0001 --> |
| Prazos 7/30/90/180 dias por severidade | <!-- aceitei / mudei --> | <!-- --> |
| SLO de p95 < 200 ms | <!-- aceitei / mudei --> | <!-- --> |

## O que eu sei explicar

<!-- TODO: antes de entregar, percorra src/ e confirme que consegue explicar cada arquivo.
Pela regra do curso, código que você não sabe explicar não conta como seu. -->

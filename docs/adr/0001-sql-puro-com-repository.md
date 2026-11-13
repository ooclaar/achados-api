# ADR 0001: SQL puro com `pg` atrás de um Repository, em vez de ORM

- **Status:** aceita
- **Data:** 2026-11-10
- **Decisores:** Ramon Alonso Costa

## Contexto e problema

A API tem um único agregado (`Achado`), uma tabela e três consultas: inserir/atualizar,
buscar por id e listar por status. As regras de negócio (prazo por severidade e
transições de status) precisam ser testadas sem banco, e o prazo do projeto é de poucos dias.

Como persistir o achado sem acoplar o domínio ao Postgres e sem gastar o prazo com
ferramenta?

## Opções consideradas

1. **SQL puro com o driver `pg`**, isolado por uma interface `RepositorioDeAchados`.
2. **Prisma** (ORM com schema próprio, cliente gerado e migrations).

## Decisão

Opção 1. O serviço depende apenas da interface `RepositorioDeAchados`
(`src/aplicacao/repositorio-de-achados.ts`). Existem duas implementações:
`RepositorioPostgres` (produção e teste de integração) e `RepositorioEmMemoria`
(testes unitários). A escolha da implementação acontece só em `src/server.ts`.

O schema fica em `db/schema.sql`, é idempotente e é aplicado na inicialização.

## Por que a alternativa foi descartada

O Prisma resolveria migrations e tipagem das consultas, mas para uma tabela e três
consultas o custo supera o ganho:

- exige etapa de geração de cliente no build, no Dockerfile e no CI;
- acrescenta um segundo schema (o `schema.prisma`) para manter em sincronia;
- esconde o SQL, e este projeto precisa mostrar e medir a consulta (índice por status,
  p95 no k6).

## Consequências

**Positivas**

- Os testes unitários rodam em milissegundos, sem banco.
- O SQL é visível e parametrizado (`$1`, `$2`), sem concatenação de strings.
- Trocar de banco ou de biblioteca significa escrever uma nova classe, sem tocar no domínio.

**Negativas**

- O mapeamento linha -> objeto é manual (`paraAchado`).
- Não há ferramenta de migrations. Enquanto o schema for um arquivo idempotente isso
  funciona; a primeira alteração de coluna em produção vai exigir adotar uma
  (node-pg-migrate, por exemplo).
- `atribuir` e `resolver` leem e depois gravam sem trava. Duas requisições simultâneas
  no mesmo achado podem se sobrescrever. É aceitável neste escopo; o caminho é uma
  coluna de versão (trava otimista).

## Quando revisar

Se o modelo passar de três ou quatro tabelas com relacionamentos, ou se o schema
precisar evoluir com dados em produção.

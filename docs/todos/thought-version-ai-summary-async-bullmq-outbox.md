# Tarefas: resumo de IA assíncrono (outbox + BullMQ)

Checklist derivada de [thought-version-ai-summary-async-bullmq-outbox.md](../research/thought-version-ai-summary-async-bullmq-outbox.md). Marque como concluída trocando `[ ]` por `[x]`.

## Modelo de dados e migração

- [x] Modelo Prisma `OutboxEvent` com enums `OutboxEventType` / `OutboxEventStatus`, campos de controle e índice único `(eventType, aggregateId)`.
- [x] Migração aplicada (`add_outbox_events`).

## Dependências e infra local

- [x] Dependências `bullmq` e `ioredis` no projeto; variável `REDIS_URL`.
- [x] Serviço Redis em [docker-compose.yml](../../docker-compose.yml) com volume persistente.

## Persistência transacional na criação de versão

- [x] `PrismaThoughtVersionCreationRepository`: transação criando `ThoughtVersion` (`PENDING`), `ThoughtDiff` e evento de outbox `AI_SUMMARY_REQUESTED` com payload `{ thoughtId, thoughtVersionId, fromVersionId, diffId, intent: "auto" }`.
- [x] `ThoughtVersionService.create` usa o repositório acima quando há predecessor; não chama mais a IA na request.

## BullMQ: filas, publisher e worker

- [x] Filas `ai-summary` e `ai-summary.dead-letter`; `jobId` determinístico `ai-summary:${thoughtVersionId}`; opções de retry/backoff (~5 tentativas, backoff exponencial 30s).
- [x] `AiSummaryJobPublisher` com deduplicação (job ativo esperando/processando não recria).
- [x] Processador (`processAiSummaryJob`) com idempotência, `UnrecoverableError` quando aplicável, `PENDING ↔ PROCESSING` em falhas transitórias, marcação `FAILED` após retries esgotados ou permanente via worker.
- [x] Evento `failed` no worker persistindo falha terminal e enfileirando payload auditável na DLQ.
- [x] Scripts `worker` / `worker:prod` e entrada [src/workers/index.ts](../../src/workers/index.ts) (dispatcher + worker).

## Outbox dispatcher

- [x] `OutboxDispatcher` consulta batch de eventos publicáveis, `queue.add` com mesmo `jobId` que o publisher, marca `PUBLISHED` só após sucesso; backoff ao falhar publicação.

## API de retry manual

- [x] `retryAiSummary` reenfileira com `intent: "manual"`; `COMPLETED` idempotente; `PROCESSING` retorna 422; `FAILED` volta a `PENDING` antes do enqueue quando necessário.

## Rotas, OpenAPI e testes

- [x] [thought.routes.ts](../../src/routes/thought.routes.ts) compõe Redis, fila e `ThoughtVersionService` atualizado.
- [x] Descrições OpenAPI ajustadas (resumo assíncrono ao criar versão com predecessor; retry não bloqueante).
- [x] Testes unitários atualizados/novos: service, processador BullMQ, dispatcher de outbox; integração de rotas com mocks de Redis/BullMQ.

# Tarefas: retry de resumo de IA e status de processamento

Checklist derivada de [thought-version-ai-summary-retry.md](../research/thought-version-ai-summary-retry.md). Marque como concluída trocando `[ ]` por `[x]`.

## Decisões e especificação

- [ ] Documentar comportamento quando o resumo já existe com status **concluído** (ex.: 200 com corpo existente, 409, ou 204) e aplicar na implementação da rota de retry.
- [ ] Definir o que a API expõe em falha (`aiSummaryErrorMessage`, código enum, mensagem genérica ou omitir detalhes sensíveis nos DTOs públicos).

## Modelo de dados e migração

- [ ] Adicionar ao `ThoughtVersion` no Prisma um enum de estado do processamento do resumo (valores sugeridos: pendente, em processamento, concluído, falha, não aplicável).
- [ ] Adicionar campo opcional para diagnóstico em falha (ex.: `aiSummaryErrorMessage` ou código interno), alinhado à política de exposição na API.
- [ ] Gerar e aplicar a migração; atualizar seeds ou dados de desenvolvimento se necessário.

## Domínio e tipos da aplicação

- [ ] Atualizar o modelo/tipo TypeScript da versão (`ThoughtVersion`) com o novo status e campo de erro opcional, coerentes com o schema.
- [ ] Ajustar contratos `create`/`update` do repositório para persistir status (e erro, quando aplicável) junto com `aiSummary` / `aiTags`.

## Fluxo `create` (alinhamento com estado)

- [ ] Ao criar versão **sem** versão anterior: marcar estado como **não aplicável** (ou equivalente) para o resumo, em vez de deixar ambíguo com apenas `aiSummary: null`.
- [ ] Ao criar versão **com** versão anterior, antes/despois da chamada à IA: definir transição de estado (ex.: pendente → em processamento → conclúido ou falha).
- [ ] Em falha de `generateAiSummary` no `create`: persistir status **falha** (e mensagem/diagnóstico conforme decidido), em vez de só registar erro em log e devolver versão sem semântica.

## Retry via API e caso de uso

- [ ] Implementar método de caso de uso / orquestração no service: validar `thoughtId` e `versionId`; garantir que a versão pertence ao pensamento.
- [ ] Resolver o par origem/destino para o diff: carregar via `ThoughtDiff` com `toVersionId` = versão alvo, ou definir e implementar comportamento explícito quando o diff não existir (ex.: erro 404/422 ou recálculo entre versões).
- [ ] Chamar `generateAiSummary` com os mesmos insumos que no `create` (`oldContent`, `newContent`, `addedWords`, `removedWords`, `metrics`).
- [ ] Persistir `aiSummary`, `aiTags` (se aplicável) e o novo status ao sucesso; em falha, persistir status **falha** e campo de erro conforme política.
- [ ] Registrar a rota REST (ex.: `POST …/thoughts/:thoughtId/versions/:versionId/ai-summary` ou prefixo equivalente ao projeto).
- [ ] No controller: validação de entrada, chamada ao caso de uso e mapeamento de resposta/erros HTTP; sem regra de negócio na rota.

## Testes e documentação da API

- [ ] Testes unitários do service: cenários primeiro versão (não aplicável), create com falha IA (status falha persistido), retry com diff existente e com diff ausente.
- [ ] Testes do controller/integração da nova rota: 200/4xx conforme especificação e idempotência acordada.
- [ ] Atualizar OpenAPI/Swagger (se o projeto mantiver) com o novo endpoint, status na resposta e códigos de erro.

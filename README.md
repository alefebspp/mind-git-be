# Criação de uma feature

Dentro da pasta src/feature, criar nova pasta com o nome da feature. Dentro da pasta da feature, devem conter os arquivos de service, controller, model, repository e testes unitários e de integração. Todas as classes devem seguir o princípio SOLID.

Não precisa criar uma pasta para cada arquivo de uma feature. Os arquivos devem estar tododos dentro da pasta da própria feature.

## Repository

Cada feature, caso tenha uma entidade no banco de dados, deve ter um interface repository. Para fazer operações ao banco de dados, uma classe deve implementar o repository e utilizar o ORM do projeto para fazer as operações.

## Service

Classe que recebe por injeção de dependência repositórios ou outras interfaces.

## Controller

Classe que chama os métodos do service e valida inputs enviados aos endpoints. No controller, validamos o body com o método parse do zod (quando necessário). No final, devolvemos uma resposta para o client juntament com status code e conteúdos de resposta.

## Testes unitários e de integração

Para testes unitários, utilizar vitest e fazer o mock dos services. Para testes de integração, utilizar os recursos do fastify.

## Padrão de nomenclatura de arquivos

Sempre nomeie arquivos e pastas com kebab case. O nome do arquivo deve explicitar seu propósito. Por exemplo, um model deve ter o nome: user.model.ts.

Interfaces não devem ter o "I" no começo de seu nome

# Modelos PRISMA

1. Thought

id string (cuid)
title string
createdAt Date

2. ThoughtVersion

id string (cuid)
thoughtId
content string
createdAt Date
aiSummary string?
aiTags string[]?

3. ThoughtDiff

id string
fromVersionId string
toVersionId string
addedWords string[]
removedWords string[]
metrics Json
createdAt Date
# mind-git-be

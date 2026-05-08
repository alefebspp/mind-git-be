---
description: Defines the standard folder and layer structure for backend features
globs:
  - src/feature/**/*.ts
alwaysApply: false
---

# Feature Structure Rule

Use `src/feature/<feature-name>/` as the root folder for each feature.

## Required structure

- `controller/<feature>.controller.ts`: HTTP layer only (request parsing, schema validation, response mapping).
- `service/<feature>.service.ts`: application/business orchestration and domain validations.
- `repository/<feature>.repository.ts`: repository contract (interface).
- `repository/prisma-<feature>.repository.ts`: Prisma implementation of the repository contract.
- `<feature>.model.ts`: main domain/entity shape used by the feature.
- `<feature>.types.ts`: input/update DTO-like types used by service/repository boundaries.
- Tests must live next to their layer files (`*.test.ts`) inside `controller/` and `service/`.

## Dependency direction

- `controller` depends on `service`.
- `service` depends on repository interface (`repository/<feature>.repository.ts`), not Prisma directly.
- `prisma-...repository` depends on Prisma client and implements the repository interface.
- Shared errors/utilities can come from common modules (for example `@/common/errors/...`).

## Behavioral rules

- Keep business rules out of controllers and inside services/domain logic.
- Validate HTTP payload shape in controller (e.g., `zod`), and validate business invariants in service.
- Repositories handle persistence concerns only (queries, ordering, mapping).
- Return consistent response envelope from controllers (`{ data: ... }`) when applicable.

## Naming conventions

- Keep singular and explicit names aligned with the feature (`ThoughtController`, `ThoughtService`, `ThoughtRepository`).
- Match file names to class/interface responsibility.

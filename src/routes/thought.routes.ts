import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { ThoughtController } from "@/feature/thought/controller/thought.controller";
import { ThoughtService } from "@/feature/thought/service/thought.service";
import { PrismaThoughtRepository } from "@/feature/thought/repository/prisma-thought.repository";
import { PrismaThoughtVersionRepository } from "@/feature/thought-version/repository/prisma-thought-version.repository";
import { PrismaThoughtDiffRepository } from "@/feature/thought-diff/repository/prisma-thought-diff.repository";
import { ThoughtVersionService } from "@/feature/thought-version/service/thought-version.service";
import { ThoughtVersionController } from "@/feature/thought-version/controller/thought-version.controller";
import { generateAiSummary } from "@/feature/thought-version/service/thought-version-ai.service";

export default async function thoughtRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  const thoughtRepository = new PrismaThoughtRepository(prisma);
  const thoughtService = new ThoughtService(thoughtRepository);
  const thoughtController = new ThoughtController(thoughtService);

  const thoughtVersionRepository = new PrismaThoughtVersionRepository(prisma);
  const thoughtDiffRepository = new PrismaThoughtDiffRepository(prisma);
  const thoughtVersionService = new ThoughtVersionService(
    thoughtRepository,
    thoughtVersionRepository,
    thoughtDiffRepository,
    generateAiSummary
  );
  const thoughtVersionController = new ThoughtVersionController(
    thoughtVersionService
  );

  fastify.post("/", async (request, reply) => {
    await thoughtController.create(request, reply);
  });

  fastify.post("/:thoughtId/versions", async (request, reply) => {
    await thoughtVersionController.create(request, reply);
  });
}

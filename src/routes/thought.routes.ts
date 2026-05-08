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

const thoughtVersionResponseProperties = {
  id: { type: "string" },
  thoughtId: { type: "string" },
  content: { type: "string" },
  createdAt: {
    type: "string",
    format: "date-time",
  },
  aiSummary: {
    type: "string",
    nullable: true,
  },
  aiTags: {
    type: "array",
    items: { type: "string" },
  },
  aiSummaryStatus: {
    type: "string",
    enum: [
      "NOT_APPLICABLE",
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
    ],
    description:
      "Lifecycle of AI-generated summary for this version (relative to predecessor diff when applicable).",
  },
  aiSummaryErrorMessage: {
    type: "string",
    nullable: true,
    description:
      "Optional sanitized failure detail when aiSummaryStatus is FAILED.",
  },
};

const errorResponses = {
  400: {
    description: "Validation error.",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
  404: {
    description: "Resource not found.",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
  422: {
    description:
      "Request cannot be processed (e.g. AI summary not applicable or diff missing).",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
  500: {
    description: "Internal server error.",
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};

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

  fastify.get(
    "/versions",
    {
      schema: {
        tags: ["Thought Versions"],
        summary: "List thought versions",
        description:
          "Lists all thought versions with pagination, ordering and optional filters by thoughtId and content.",
        querystring: {
          type: "object",
          properties: {
            thoughtId: { type: "string" },
            content: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            orderBy: {
              type: "string",
              enum: ["createdAt", "content"],
              default: "createdAt",
            },
            orderDirection: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
          },
        },
        response: {
          200: {
            description: "Thought versions listed successfully.",
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: thoughtVersionResponseProperties,
                },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  limit: { type: "integer" },
                  total: { type: "integer" },
                  totalPages: { type: "integer" },
                },
              },
            },
          },
          400: errorResponses[400],
          500: errorResponses[500],
        },
      },
    },
    async (request, reply) => {
      await thoughtVersionController.list(request, reply);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Thoughts"],
        summary: "Create thought",
        description: "Creates a new thought.",
        body: {
          type: "object",
          required: ["content"],
          properties: {
            title: { type: "string" },
            content: {
              type: "string",
            },
          },
        },
        response: {
          200: {
            description: "Thought created successfully.",
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error.",
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          500: {
            description: "Internal server error.",
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      await thoughtController.create(request, reply);
    }
  );

  fastify.post(
    "/:thoughtId/versions",
    {
      schema: {
        tags: ["Thought Versions"],
        summary: "Create thought version",
        description:
          "Creates a new version for a thought and computes diff metadata from the previous version.",
        params: {
          type: "object",
          required: ["thoughtId"],
          properties: {
            thoughtId: {
              type: "string",
            },
          },
        },
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "string",
            },
          },
        },
        response: {
          200: {
            description: "Thought version created successfully.",
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: thoughtVersionResponseProperties,
              },
            },
          },
          400: errorResponses[400],
          404: errorResponses[404],
          500: errorResponses[500],
        },
      },
    },
    async (request, reply) => {
      await thoughtVersionController.create(request, reply);
    }
  );

  fastify.post(
    "/:thoughtId/versions/:versionId/ai-summary",
    {
      schema: {
        tags: ["Thought Versions"],
        summary: "Retry AI summary for a thought version",
        description:
          "Regenerates the AI summary using the stored diff for this version (toVersionId). Returns 200 with existing data when the summary is already COMPLETED (idempotent).",
        params: {
          type: "object",
          required: ["thoughtId", "versionId"],
          properties: {
            thoughtId: { type: "string" },
            versionId: { type: "string" },
          },
        },
        response: {
          200: {
            description:
              "Summary regenerated, failed state persisted, or existing completed version returned.",
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: thoughtVersionResponseProperties,
              },
            },
          },
          400: errorResponses[400],
          404: errorResponses[404],
          422: errorResponses[422],
          500: errorResponses[500],
        },
      },
    },
    async (request, reply) => {
      await thoughtVersionController.retryAiSummary(request, reply);
    }
  );
}

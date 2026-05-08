import "dotenv/config";
import fastify, {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";
import thoughtRoutes from "@/routes/thought.routes";
import { AppError, ErrorCode } from "@/common/errors/app-error";

export function build(opts = {}): FastifyInstance {
  const app = fastify(opts);

  app.register(swagger, {
    openapi: {
      info: {
        title: "Mind Git API",
        description: "Documentation for Thought and Thought Version endpoints",
        version: "1.0.0",
      },
      servers: [{ url: "http://localhost:3000" }],
      tags: [{ name: "Thoughts" }, { name: "Thought Versions" }],
    },
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  // Error handler global
  app.setErrorHandler(
    (error: Error, request: FastifyRequest, reply: FastifyReply) => {
      // Tratamento de erros do Zod (validação)
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        return reply.status(400).send({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Validation error",
            details: errors,
          },
        });
      }

      // Tratamento de erros customizados (AppError)
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      // Tratamento de erros genéricos
      console.error("Unhandled error:", error);
      return reply.status(500).send({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      });
    }
  );

  app.register(thoughtRoutes, { prefix: "/api/thoughts" });

  return app;
}

if (require.main === module) {
  const app = build({});
  const start = async () => {
    try {
      await app.listen({ port: 3000, host: "0.0.0.0" });
      console.log("Server listening on http://localhost:3000");
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  };
  start();
}

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ThoughtVersionService } from "@/feature/thought-version/service/thought-version.service";

const createThoughtVersionSchema = z.object({
  content: z.string(),
});

const thoughtIdSchema = z.object({
  thoughtId: z.string(),
});

const listThoughtVersionsQuerySchema = z.object({
  thoughtId: z.string().optional(),
  content: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  orderBy: z.enum(["createdAt", "content"]).default("createdAt"),
  orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

export class ThoughtVersionController {
  constructor(private thoughtVersionService: ThoughtVersionService) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = listThoughtVersionsQuerySchema.parse(request.query);
    const thoughtVersions = await this.thoughtVersionService.list(query);
    reply.status(200).send(thoughtVersions);
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { thoughtId } = thoughtIdSchema.parse(request.params);

    const body = createThoughtVersionSchema.parse(request.body);
    const thoughtVersion = await this.thoughtVersionService.create(
      thoughtId,
      body
    );

    reply.status(200).send({ data: thoughtVersion });
  }
}

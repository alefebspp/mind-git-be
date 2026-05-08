import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ThoughtVersionService } from "@/feature/thought-version/service/thought-version.service";

const createThoughtVersionSchema = z.object({
  content: z.string(),
});

const thoughtIdSchema = z.object({
  thoughtId: z.string(),
});

export class ThoughtVersionController {
  constructor(private thoughtVersionService: ThoughtVersionService) {}

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

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ThoughtService } from "@/feature/thought/service/thought.service";

const createThoughtSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
});

export class ThoughtController {
  constructor(private thoughtService: ThoughtService) {}

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = createThoughtSchema.parse(request.body);
    const thought = await this.thoughtService.create(body);

    reply.status(200).send({ data: thought });
  }
}

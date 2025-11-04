import { z } from "zod/v4"

export const Env = z
  .object({
    DURABLE_QUEUE: z.string().url(),
    DURABLE_TABLE: z.string(),
    WORKFLOW_TABLE: z.string(),
    LOCKS_TABLE: z.string(),
    DURABLE_BUS_NAME: z.string(),
  })
  .parse(process.env)

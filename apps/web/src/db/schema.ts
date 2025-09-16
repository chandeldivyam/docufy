import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
export * from "./auth-schema"
import { users } from "./auth-schema"

const { createSelectSchema } = createSchemaFactory({ zodInstance: z })

export const selectUsersSchema = createSelectSchema(users)

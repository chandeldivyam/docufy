import { customType } from "drizzle-orm/pg-core"

export const bytea = customType<{
  data: Buffer
  notNull: false
  default: false
}>({
  dataType() {
    return "bytea"
  },
  fromDriver(value: unknown): Buffer {
    return Buffer.from((value as string).replace("\\x", ""), "hex")
  },
  toDriver(value: Buffer): string {
    return `\\x${value.toString("hex")}`
  },
})

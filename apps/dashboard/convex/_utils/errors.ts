import { ConvexError, v, type ObjectType } from 'convex/values';

export const AppErrorFields = {
  code: v.string(),
  message: v.optional(v.string()),
};

export type AppError = ObjectType<typeof AppErrorFields>;

export function appError(code: string, message?: string) {
  // Only include fields that are defined
  const errorObj: AppError = { code };
  if (message !== undefined) errorObj.message = message;

  return new ConvexError(errorObj);
}

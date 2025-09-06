// apps/dashboard/lib/errors.ts
type AppError = { code?: string; message?: string };

export function parseConvexError(err: unknown): AppError {
  if (err && typeof err === 'object') {
    const anyErr = err;

    // ConvexError typically has this structure
    if ('data' in anyErr && anyErr.data && typeof anyErr.data === 'object') {
      const { code, message } = anyErr.data as AppError;
      return { code, message };
    }

    // Sometimes the error is directly in the object
    if ('code' in anyErr || 'message' in anyErr) {
      const { code, message } = anyErr as AppError;
      return { code, message };
    }

    // Check for standard Error message
    if ('message' in anyErr && typeof anyErr.message === 'string') {
      return { code: 'UNKNOWN', message: anyErr.message };
    }
  }

  return { code: 'UNKNOWN', message: 'Something went wrong' };
}

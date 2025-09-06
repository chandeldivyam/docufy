type AppError = {
  code?: string;
  message?: string;
};

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
      // Try to parse Convex error patterns from the message
      const message = anyErr.message;

      // Common Convex error patterns
      if (message.includes('FORBIDDEN')) {
        return { code: 'FORBIDDEN', message: "You don't have permission to perform this action" };
      }
      if (message.includes('UNAUTHORIZED')) {
        return { code: 'UNAUTHORIZED', message: 'Please sign in to continue' };
      }
      if (message.includes('NOT_FOUND')) {
        return { code: 'NOT_FOUND', message: 'The requested resource was not found' };
      }

      return { code: 'UNKNOWN', message };
    }
  }

  return { code: 'UNKNOWN', message: 'Something went wrong' };
}

export function getErrorMessage(error: unknown): string {
  const parsed = parseConvexError(error);
  return parsed.message || parsed.code || 'An unexpected error occurred';
}

export function isAuthError(error: unknown): boolean {
  const parsed = parseConvexError(error);
  return parsed.code === 'FORBIDDEN' || parsed.code === 'UNAUTHORIZED';
}

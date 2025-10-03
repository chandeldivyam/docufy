type ErrorHandler = (
  error: Error,
  context: { operation: string; collectionId: string }
) => void

let errorHandler: ErrorHandler | null = null

export function setCollectionErrorHandler(handler: ErrorHandler) {
  errorHandler = handler
}

export function notifyCollectionError(
  error: Error,
  context: { operation: string; collectionId: string }
) {
  if (errorHandler) {
    errorHandler(error, context)
  } else {
    console.error("[Collection Error]", context, error)
  }
}

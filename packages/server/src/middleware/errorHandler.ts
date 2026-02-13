import { Request, Response, NextFunction } from 'express';

/**
 * Application-level error with HTTP status code and error classification.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Insufficient permissions', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new AppError(message, 500, code, false);
  }
}

/**
 * Global error handling middleware.
 * Produces structured JSON error responses with request correlation IDs.
 * Logs full error details server-side while returning sanitized messages to clients.
 */
export function globalErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.requestId || 'unknown';
  const timestamp = new Date().toISOString();

  // Determine status code and error classification
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    isOperational = err.isOperational;
  } else if ((err as any).statusCode) {
    statusCode = (err as any).statusCode;
    message = err.message;
    isOperational = true;
  }

  // Log the error with full context
  const logEntry = {
    level: statusCode >= 500 ? 'error' : 'warn',
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    message: err.message,
    stack: statusCode >= 500 ? err.stack : undefined,
    timestamp,
  };

  if (statusCode >= 500) {
    console.error(JSON.stringify(logEntry));
  } else {
    console.warn(JSON.stringify(logEntry));
  }

  // Return structured error response
  const responseBody: Record<string, any> = {
    error: {
      code,
      message: isOperational ? message : 'Internal server error',
      requestId,
      timestamp,
    },
  };

  // In non-production, include stack trace for debugging
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    responseBody.error.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
}

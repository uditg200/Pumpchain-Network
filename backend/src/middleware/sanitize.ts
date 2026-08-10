import type { Request, Response, NextFunction } from 'express';

/**
 * Sanitizes string fields in request body to prevent XSS / injection.
 * Strips HTML tags and trims whitespace from all string values.
 * Does NOT affect non-string fields.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        typeof v === 'string' ? sanitizeString(v) : typeof v === 'object' && v ? sanitizeObject(v as Record<string, unknown>) : v,
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeString(str: string): string {
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim()
    .slice(0, 10_000); // Hard limit on string length
}

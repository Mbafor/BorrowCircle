import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';

function formatFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body';
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', fields: formatFieldErrors(result.error) });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Same as validate(), but for req.query instead of req.body — query values
 * arrive as strings, so schemas passed here should coerce as needed
 * (e.g. z.coerce.number()).
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', fields: formatFieldErrors(result.error) });
      return;
    }

    res.locals.query = result.data;
    next();
  };
}

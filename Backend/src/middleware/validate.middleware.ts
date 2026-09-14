import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of (result.error as ZodError).issues) {
        const key = issue.path.join('.') || 'body';
        if (!(key in fields)) {
          fields[key] = issue.message;
        }
      }
      res.status(400).json({ error: 'Validation failed', fields });
      return;
    }

    req.body = result.data;
    next();
  };
}

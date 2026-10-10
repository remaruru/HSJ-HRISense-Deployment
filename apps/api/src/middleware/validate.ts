import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { issuesFromZod, validationError } from './errorHandler';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      // Update with validated and parsed data.
      //
      // Only overwrite a section the schema actually declared. A zod object
      // strips keys it does not define, so a body-only schema returns
      // `params: undefined` / `query: undefined` — assigning those blindly wiped
      // `req.params`, and every handler that then read `req.params.id` threw
      // "Cannot read properties of undefined". That silently broke
      // `PUT /attendance/:id`, `POST /employees/:employeeId/documents` and
      // `PUT /documents/:documentId`.
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // 400 VALIDATION_ERROR: a one-line summary a toast can show, plus each
        // field's problem so a form can highlight it.
        next(validationError(issuesFromZod(error)));
      } else {
        next(error);
      }
    }
  };
};

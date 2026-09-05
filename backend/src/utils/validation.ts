import Joi from 'joi';

// Kudos validation schemas
export const kudosSubmitSchema = Joi.object({
  recipient_id: Joi.string().uuid().required(),
  message: Joi.string().min(10).max(500).required(),
  is_anonymous: Joi.boolean().default(false)
});

export const kudosFlagSchema = Joi.object({
  reason: Joi.string().valid('offensive', 'spam', 'harassment', 'irrelevant', 'other').required(),
  details: Joi.string().max(1000).optional()
});

// User validation schemas
export const userSearchSchema = Joi.object({
  q: Joi.string().min(1).max(100).required(),
  limit: Joi.number().default(10).max(50)
});

export const userIdSchema = Joi.object({
  id: Joi.string().uuid().required()
});

// Pagination schema
export const paginationSchema = Joi.object({
  page: Joi.number().default(1).min(1),
  limit: Joi.number().default(10).min(1).max(50)
});

// Validation middleware
export function validate(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      return res.status(400).json({ errors: details });
    }
    
    req.body = value;
    next();
  };
}

export function validateQuery(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      return res.status(400).json({ errors: details });
    }
    
    req.query = value;
    next();
  };
}

export function validateParams(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      return res.status(400).json({ errors: details });
    }
    
    req.params = value;
    next();
  };
}

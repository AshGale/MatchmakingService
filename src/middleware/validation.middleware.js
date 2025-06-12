const Joi = require('joi');
const { ValidationError } = require('./error.middleware');

// Create a validation middleware factory
const createValidator = (schema) => {
  return (req, res, next) => {
    const dataToValidate = {};
    
    // Collect data from request based on what's in the schema
    if (schema.body) dataToValidate.body = req.body;
    if (schema.query) dataToValidate.query = req.query;
    if (schema.params) dataToValidate.params = req.params;
    
    const { error } = Joi.object(schema).validate(dataToValidate, { 
      abortEarly: false,
      allowUnknown: true
    });
    
    if (error) {
      // Format validation errors
      const details = error.details.reduce((acc, detail) => {
        const path = detail.path.join('.');
        acc[path] = detail.message;
        return acc;
      }, {});
      
      return next(new ValidationError('Validation failed', details));
    }
    
    next();
  };
};

// Create common schema validators
const schemas = {
  // POST /api/lobbies
  createLobby: {
    body: Joi.object({
      max_players: Joi.number().integer().min(2).max(4).required()
    })
  },
  
  // GET /api/lobbies
  getLobbies: {
    query: Joi.object({
      status: Joi.string().valid('waiting', 'active', 'finished')
    })
  },
  
  // GET /api/lobbies/:id
  getLobbyById: {
    params: Joi.object({
      id: Joi.string().uuid().required()
    })
  },
  
  // POST /api/lobbies/:id/join
  joinLobby: {
    params: Joi.object({
      id: Joi.string().uuid().required()
    }),
    body: Joi.object({
      session_id: Joi.string()
        .trim()
        .min(8)
        .max(128)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .required()
        .messages({
          'string.pattern.base': 'session_id must contain only alphanumeric characters, underscores, and hyphens',
          'string.min': 'session_id must be at least {#limit} characters long',
          'string.max': 'session_id must be at most {#limit} characters long',
          'any.required': 'session_id is required'
        })
    })
  },
  
  // POST /api/quick-join
  quickJoin: {
    body: Joi.object({
      session_id: Joi.string().required(),
      preferred_players: Joi.number().integer().min(2).max(4)
    })
  },
  
  // PUT /api/lobbies/:id/status
  updateLobbyStatus: {
    params: Joi.object({
      id: Joi.string().uuid().required()
    }),
    body: Joi.object({
      status: Joi.string().valid('waiting', 'active', 'finished').required(),
      player_id: Joi.string().uuid()
    })
  }
};

// Create validators from schemas
const validators = Object.entries(schemas).reduce((acc, [key, schema]) => {
  acc[key] = createValidator(schema);
  return acc;
}, {});

module.exports = {
  validators,
  createValidator
};

import Joi from 'joi';

/**
 * Express middleware factory for Joi validation.
 * @param {Joi.ObjectSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      return res.status(400).json({ error: 'Validation failed', details });
    }

    req[source] = value;
    next();
  };
}

// ---- Reusable schemas ----

export const schemas = {
  // Auth
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(4).required(),
  }),

  register: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    role: Joi.string().valid('admin', 'developer', 'designer', 'viewer', 'client').default('developer'),
  }),

  // Projects
  createProject: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    key: Joi.string().min(2).max(10).uppercase().pattern(/^[A-Z0-9]+$/).required(),
    description: Joi.string().max(2000).allow('').default(''),
    color: Joi.number().integer().min(0).max(5).default(0),
  }),

  updateProject: Joi.object({
    name: Joi.string().min(1).max(255),
    description: Joi.string().max(2000).allow(''),
    color: Joi.number().integer().min(0).max(5),
    starred: Joi.boolean(),
  }).min(1),

  // Tasks
  createTask: Joi.object({
    title: Joi.string().min(1).max(500).required(),
    description: Joi.string().max(5000).allow('').default(''),
    type: Joi.string().valid('Task', 'Bug', 'Story').default('Task'),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Highest').default('Medium'),
    status: Joi.string().valid('To Do', 'In Progress', 'In Review', 'Done').default('To Do'),
    assignee_id: Joi.string().uuid().allow(null, ''),
    sprint_id: Joi.string().uuid().allow(null, ''),
    due_date: Joi.date().iso().allow(null),
  }),

  updateTask: Joi.object({
    title: Joi.string().min(1).max(500),
    description: Joi.string().max(5000).allow(''),
    type: Joi.string().valid('Task', 'Bug', 'Story'),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Highest'),
    status: Joi.string().valid('To Do', 'In Progress', 'In Review', 'Done'),
    assignee_id: Joi.string().uuid().allow(null, ''),
    sprint_id: Joi.string().uuid().allow(null, ''),
    due_date: Joi.date().iso().allow(null),
    sort_order: Joi.number().integer(),
  }).min(1),

  // Members
  updateMember: Joi.object({
    role: Joi.string().valid('admin', 'developer', 'designer', 'viewer', 'lead').required(),
  }),

  // Invites
  createInvite: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    role: Joi.string().valid('admin', 'developer', 'designer', 'viewer').default('developer'),
  }),

  // Documents
  createDocument: Joi.object({
    title: Joi.string().min(1).max(500).required(),
    category: Joi.string().valid('requirements', 'design', 'technical', 'meeting', 'other').default('other'),
    content: Joi.string().max(100000).allow('').default(''),
  }),

  updateDocument: Joi.object({
    title: Joi.string().min(1).max(500),
    category: Joi.string().valid('requirements', 'design', 'technical', 'meeting', 'other'),
    content: Joi.string().max(100000).allow(''),
  }).min(1),

  // Flowcharts
  createFlowchart: Joi.object({
    title: Joi.string().min(1).max(500).required(),
    description: Joi.string().max(2000).allow('').default(''),
    nodes: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('start', 'process', 'decision', 'io', 'database', 'service').required(),
      label: Joi.string().max(200).required(),
      x: Joi.number().required(),
      y: Joi.number().required(),
      width: Joi.number().default(160),
      height: Joi.number().default(50),
    })).default([]),
    connections: Joi.array().items(Joi.object({
      from: Joi.string().required(),
      to: Joi.string().required(),
      label: Joi.string().max(100).allow('').default(''),
    })).default([]),
  }),

  updateFlowchart: Joi.object({
    title: Joi.string().min(1).max(500),
    description: Joi.string().max(2000).allow(''),
    nodes: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('start', 'process', 'decision', 'io', 'database', 'service').required(),
      label: Joi.string().max(200).required(),
      x: Joi.number().required(),
      y: Joi.number().required(),
      width: Joi.number().default(160),
      height: Joi.number().default(50),
    })),
    connections: Joi.array().items(Joi.object({
      from: Joi.string().required(),
      to: Joi.string().required(),
      label: Joi.string().max(100).allow('').default(''),
    })),
  }).min(1),

  // Sprints
  createSprint: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    status: Joi.string().valid('active', 'planned', 'completed', 'backlog').default('planned'),
    start_date: Joi.date().iso().allow(null),
    end_date: Joi.date().iso().allow(null),
    goal: Joi.string().max(2000).allow('').default(''),
  }),

  updateSprint: Joi.object({
    name: Joi.string().min(1).max(255),
    status: Joi.string().valid('active', 'planned', 'completed', 'backlog'),
    start_date: Joi.date().iso().allow(null),
    end_date: Joi.date().iso().allow(null),
    goal: Joi.string().max(2000).allow(''),
  }).min(1),

  // GitHub connection
  connectGitHub: Joi.object({
    owner: Joi.string().min(1).max(255).required(),
    repo: Joi.string().min(1).max(255).required(),
    access_token: Joi.string().max(500).allow('', null),
  }),

  // Pagination query
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().max(200).allow(''),
    sort: Joi.string().max(50).default('created_at'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

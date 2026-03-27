import Joi from 'joi';

/**
 * Express middleware factory for Joi validation.
 * @param {Joi.ObjectSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    console.log(`Validating ${source}:`, req[source]);
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      console.log('Validation error:', error.details);
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
    role: Joi.string().valid('admin', 'developer', 'designer', 'viewer', 'client').default('admin'),
    org_name: Joi.string().min(2).max(255).allow('', null),
    org_domain: Joi.string().max(255).allow('', null),
    org_industry: Joi.string().max(100).allow('', null),
    org_size: Joi.string().valid('1-10', '11-50', '51-200', '201-500', '500+').allow('', null),
  }),

  // Organizations
  createOrganization: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    domain: Joi.string().max(255).allow('', null),
    industry: Joi.string().max(100).allow('', null),
    size: Joi.string().valid('1-10', '11-50', '51-200', '201-500', '500+').allow('', null),
    website: Joi.string().uri().max(500).allow('', null),
    address: Joi.string().max(1000).allow('', null),
    logo_url: Joi.string().uri().allow('', null),
  }),

  updateOrganization: Joi.object({
    name: Joi.string().min(2).max(255),
    domain: Joi.string().max(255).allow('', null),
    description: Joi.string().max(2000).allow('', null),
    industry: Joi.string().max(100).allow('', null),
    size: Joi.string().valid('1-10', '11-50', '51-200', '201-500', '500+').allow('', null),
    website: Joi.string().uri().max(500).allow('', null),
    address: Joi.string().max(1000).allow('', null),
    logo_url: Joi.string().uri().allow('', null),
    settings: Joi.object(),
  }).min(1),

  createTeam: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(2000).allow('').default(''),
    color: Joi.number().integer().min(0).max(10).default(0),
    lead_id: Joi.string().uuid().allow(null),
  }),

  updateTeam: Joi.object({
    name: Joi.string().min(1).max(255),
    description: Joi.string().max(2000).allow(''),
    color: Joi.number().integer().min(0).max(10),
    lead_id: Joi.string().uuid().allow(null),
  }).min(1),

  // Departments
  createDepartment: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(2000).allow('').default(''),
    head_id: Joi.string().uuid().allow(null),
    parent_department_id: Joi.string().uuid().allow(null),
    color: Joi.number().integer().min(0).max(10).default(0),
  }),

  updateDepartment: Joi.object({
    name: Joi.string().min(1).max(255),
    description: Joi.string().max(2000).allow(''),
    head_id: Joi.string().uuid().allow(null),
    parent_department_id: Joi.string().uuid().allow(null),
    color: Joi.number().integer().min(0).max(10),
  }).min(1),

  // People / Employee Profile
  createPerson: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    org_role: Joi.string().valid('admin', 'hr', 'manager', 'developer', 'designer', 'viewer').default('developer'),
    designation: Joi.string().max(255).allow('', null),
    department_id: Joi.string().uuid().allow('', null),
    employee_code: Joi.string().max(50).allow('', null),
    phone: Joi.string().max(50).allow('', null),
    employment_type: Joi.string().valid('full-time', 'part-time', 'contract', 'internship', 'freelance').default('full-time'),
    employee_status: Joi.string().valid('active', 'onboarding', 'on-leave', 'offboarded', 'suspended').default('onboarding'),
    reports_to: Joi.string().uuid().allow('', null),
    bio: Joi.string().max(1000).allow('', null),
    date_of_joining: Joi.date().iso().allow(null),
  }),

  updatePerson: Joi.object({
    name: Joi.string().min(2).max(255),
    designation: Joi.string().max(255).allow('', null),
    employee_code: Joi.string().max(50).allow('', null),
    phone: Joi.string().max(50).allow('', null),
    date_of_joining: Joi.date().iso().allow(null),
    reports_to: Joi.string().uuid().allow(null),
    employment_type: Joi.string().valid('full-time', 'part-time', 'contract', 'internship', 'freelance'),
    employee_status: Joi.string().valid('active', 'onboarding', 'on-leave', 'offboarded', 'suspended'),
    department_id: Joi.string().uuid().allow(null),
    address: Joi.string().max(2000).allow('', null),
    bio: Joi.string().max(1000).allow('', null),
    avatar: Joi.string().max(10).allow('', null),
  }).min(1),

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
    story_points: Joi.number().integer().min(0).max(100).allow(null),
    time_estimate: Joi.number().integer().min(0).allow(null),
    labels: Joi.array().items(Joi.string().max(50)).default([]),
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
    story_points: Joi.number().integer().min(0).max(100).allow(null),
    time_estimate: Joi.number().integer().min(0).allow(null),
    time_spent: Joi.number().integer().min(0).allow(null),
    labels: Joi.array().items(Joi.string().max(50)),
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

  aiGenerateDocument: Joi.object({
    prompt: Joi.string().min(10).max(8000).required(),
    title: Joi.string().min(1).max(500).allow(''),
    category: Joi.string().valid('requirements', 'design', 'technical', 'meeting', 'other'),
    tone: Joi.string().max(100).allow('').default('professional'),
    targetAudience: Joi.string().max(200).allow('').default('engineering team'),
    additionalContext: Joi.string().max(10000).allow('').default(''),
    contextWindow: Joi.object({
      maxTasks: Joi.number().integer().min(1).max(100),
      maxSprints: Joi.number().integer().min(1).max(50),
      maxDocs: Joi.number().integer().min(1).max(50),
    }).default({}),
  }),

  aiAnalyzeDocument: Joi.object({
    docId: Joi.string().uuid(),
    title: Joi.string().min(1).max(500).allow(''),
    content: Joi.string().max(100000).allow(''),
    analysisGoal: Joi.string().max(2000).allow('').default(''),
    contextWindow: Joi.object({
      maxTasks: Joi.number().integer().min(1).max(100),
      maxSprints: Joi.number().integer().min(1).max(50),
      maxDocs: Joi.number().integer().min(1).max(50),
    }).default({}),
  }).or('docId', 'content'),

  aiDocumentSuggestions: Joi.object({
    content: Joi.string().max(100000).required(),
    title: Joi.string().min(1).max(500).allow('').default(''),
    category: Joi.string().valid('requirements', 'design', 'technical', 'meeting', 'other').default('other'),
    contextWindow: Joi.object({
      maxTasks: Joi.number().integer().min(1).max(100),
      maxSprints: Joi.number().integer().min(1).max(50),
      maxDocs: Joi.number().integer().min(1).max(50),
    }).default({}),
  }),

  aiDocumentAutocomplete: Joi.object({
    content: Joi.string().max(50000).required(),
    cursorContext: Joi.string().max(1000).required(),
    title: Joi.string().min(1).max(500).allow('').default(''),
    category: Joi.string().valid('requirements', 'design', 'technical', 'meeting', 'other').default('other'),
  }),

  aiDocumentChat: Joi.object({
    content: Joi.string().max(100000).required(),
    message: Joi.string().min(1).max(4000).required(),
    title: Joi.string().min(1).max(500).allow('').default(''),
    category: Joi.string().valid('requirements', 'design', 'technical', 'meeting', 'other').default('other'),
    chatHistory: Joi.array().items(Joi.object({
      user: Joi.string().required(),
      assistant: Joi.string().required(),
    })).default([]),
    contextWindow: Joi.object({
      maxTasks: Joi.number().integer().min(1).max(100),
      maxSprints: Joi.number().integer().min(1).max(50),
      maxDocs: Joi.number().integer().min(1).max(50),
    }).default({}),
  }),

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

  // Chat - Channels
  createChannel: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).allow('').default(''),
    type: Joi.string().valid('public', 'private', 'direct').default('public'),
    member_ids: Joi.array().items(Joi.string().uuid()).default([]),
  }),

  updateChannel: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().max(500).allow(''),
  }).min(1),

  // Chat - Messages
  sendMessage: Joi.object({
    content: Joi.string().min(1).max(10000).required(),
    parent_id: Joi.string().uuid().allow(null),
    attachments: Joi.array().items(Joi.object({
      type: Joi.string().valid('image', 'file', 'code').required(),
      url: Joi.string().uri().allow(''),
      name: Joi.string().max(255).required(),
      size: Joi.number().integer().min(0),
      mimeType: Joi.string().max(100),
    })).default([]),
    mentions: Joi.array().items(Joi.string().uuid()).default([]),
  }),

  updateMessage: Joi.object({
    content: Joi.string().min(1).max(10000).required(),
  }),

  // Meetings
  createMeeting: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(5000).allow('').default(''),
    start_time: Joi.date().iso().required(),
    end_time: Joi.date().iso().required(),
    meeting_type: Joi.string().valid('video', 'audio', 'in_person').default('video'),
    recurring: Joi.string().valid('none', 'daily', 'weekly', 'biweekly', 'monthly').default('none'),
    location: Joi.string().max(500).allow('').default(''),
    participant_ids: Joi.array().items(Joi.string().uuid()).default([]),
    channel_id: Joi.string().uuid().allow(null),
  }),

  updateMeeting: Joi.object({
    title: Joi.string().min(1).max(255),
    description: Joi.string().max(5000).allow(''),
    start_time: Joi.date().iso(),
    end_time: Joi.date().iso(),
    meeting_type: Joi.string().valid('video', 'audio', 'in_person'),
    recurring: Joi.string().valid('none', 'daily', 'weekly', 'biweekly', 'monthly'),
    location: Joi.string().max(500).allow(''),
    participant_ids: Joi.array().items(Joi.string().uuid()),
  }).min(1),

  meetingResponse: Joi.object({
    response: Joi.string().valid('accepted', 'declined', 'tentative').required(),
  }),

  // Task Comments
  createTaskComment: Joi.object({
    content: Joi.string().min(1).max(10000).required(),
    parent_id: Joi.string().uuid().allow(null, '').optional(),
  }),

  updateTaskComment: Joi.object({
    content: Joi.string().min(1).max(10000).required(),
  }),

  // Task Document Link
  linkTaskDocument: Joi.object({
    document_id: Joi.string().uuid().required(),
  }),

  // HR - Offer Letters
  createOfferLetter: Joi.object({
    candidate_name: Joi.string().min(1).max(255).required(),
    candidate_email: Joi.string().email().required(),
    candidate_phone: Joi.string().max(50).allow('', null),
    candidate_address: Joi.string().max(1000).allow('', null),
    
    position_title: Joi.string().min(1).max(255).required(),
    department: Joi.string().max(255).allow('', null),
    employment_type: Joi.string().valid('full-time', 'part-time', 'contract', 'internship').default('full-time'),
    start_date: Joi.date().iso().required(),
    reporting_to: Joi.string().max(255).allow('', null),
    work_location: Joi.string().max(255).allow('', null),
    
    base_salary: Joi.number().positive().required(),
    salary_currency: Joi.string().max(10).default('USD'),
    salary_frequency: Joi.string().valid('hourly', 'weekly', 'bi-weekly', 'monthly', 'annual').default('annual'),
    bonus_percentage: Joi.number().min(0).max(100).allow(null, ''),
    equity_shares: Joi.number().integer().min(0).allow(null, ''),
    equity_vesting_period: Joi.string().max(100).allow('', null),
    
    benefits: Joi.array().items(Joi.object({
      name: Joi.string().max(100).required(),
      description: Joi.string().max(500).allow(''),
    })).default([]),
    
    additional_terms: Joi.string().max(5000).allow('', null),
    offer_expiry_date: Joi.date().iso().allow(null, ''),
    offer_date: Joi.date().iso().allow(null, ''),
    
    company_name: Joi.string().min(1).max(255).required(),
    company_address: Joi.string().max(1000).allow('', null),
    company_logo_url: Joi.string().uri().allow('', null),
    signatory_name: Joi.string().max(255).allow('', null),
    signatory_title: Joi.string().max(255).allow('', null),
    
    status: Joi.string().valid('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn').default('draft'),
  }),

  updateOfferLetter: Joi.object({
    candidate_name: Joi.string().min(1).max(255),
    candidate_email: Joi.string().email(),
    candidate_phone: Joi.string().max(50).allow('', null),
    candidate_address: Joi.string().max(1000).allow('', null),
    
    position_title: Joi.string().min(1).max(255),
    department: Joi.string().max(255).allow('', null),
    employment_type: Joi.string().valid('full-time', 'part-time', 'contract', 'internship'),
    start_date: Joi.date().iso(),
    reporting_to: Joi.string().max(255).allow('', null),
    work_location: Joi.string().max(255).allow('', null),
    
    base_salary: Joi.number().positive(),
    salary_currency: Joi.string().max(10),
    salary_frequency: Joi.string().valid('hourly', 'weekly', 'bi-weekly', 'monthly', 'annual'),
    bonus_percentage: Joi.number().min(0).max(100).allow(null, ''),
    equity_shares: Joi.number().integer().min(0).allow(null, ''),
    equity_vesting_period: Joi.string().max(100).allow('', null),
    
    benefits: Joi.array().items(Joi.object({
      name: Joi.string().max(100).required(),
      description: Joi.string().max(500).allow(''),
    })),
    
    additional_terms: Joi.string().max(5000).allow('', null),
    offer_expiry_date: Joi.date().iso().allow(null, ''),
    offer_date: Joi.date().iso().allow(null, ''),
    
    company_name: Joi.string().min(1).max(255),
    company_address: Joi.string().max(1000).allow('', null),
    company_logo_url: Joi.string().uri().allow('', null),
    signatory_name: Joi.string().max(255).allow('', null),
    signatory_title: Joi.string().max(255).allow('', null),
    
    status: Joi.string().valid('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn'),
  }).min(1),

  // HR - Payslips
  createPayslip: Joi.object({
    employee_id: Joi.string().uuid().allow(null),
    employee_name: Joi.string().min(1).max(255).required(),
    employee_email: Joi.string().email().required(),
    employee_code: Joi.string().max(50).allow('', null),
    department: Joi.string().max(255).allow('', null),
    designation: Joi.string().max(255).allow('', null),
    date_of_joining: Joi.date().iso().allow(null),
    bank_name: Joi.string().max(255).allow('', null),
    bank_account_number: Joi.string().max(100).allow('', null),
    pan_number: Joi.string().max(50).allow('', null),
    
    pay_period_start: Joi.date().iso().required(),
    pay_period_end: Joi.date().iso().required(),
    payment_date: Joi.date().iso().required(),
    
    basic_salary: Joi.number().min(0).required(),
    hra: Joi.number().min(0).default(0),
    conveyance_allowance: Joi.number().min(0).default(0),
    medical_allowance: Joi.number().min(0).default(0),
    special_allowance: Joi.number().min(0).default(0),
    bonus: Joi.number().min(0).default(0),
    overtime_pay: Joi.number().min(0).default(0),
    other_earnings: Joi.array().items(Joi.object({
      name: Joi.string().max(100).required(),
      amount: Joi.number().min(0).required(),
    })).default([]),
    
    provident_fund: Joi.number().min(0).default(0),
    professional_tax: Joi.number().min(0).default(0),
    income_tax: Joi.number().min(0).default(0),
    health_insurance: Joi.number().min(0).default(0),
    other_deductions: Joi.array().items(Joi.object({
      name: Joi.string().max(100).required(),
      amount: Joi.number().min(0).required(),
    })).default([]),
    
    currency: Joi.string().max(10).default('USD'),
    company_name: Joi.string().min(1).max(255).required(),
    company_address: Joi.string().max(1000).allow('', null),
    company_logo_url: Joi.string().uri().allow('', null),
    status: Joi.string().valid('draft', 'generated', 'sent', 'paid').default('draft'),
  }),

  updatePayslip: Joi.object({
    employee_id: Joi.string().uuid().allow(null),
    employee_name: Joi.string().min(1).max(255),
    employee_email: Joi.string().email(),
    employee_code: Joi.string().max(50).allow('', null),
    department: Joi.string().max(255).allow('', null),
    designation: Joi.string().max(255).allow('', null),
    date_of_joining: Joi.date().iso().allow(null),
    bank_name: Joi.string().max(255).allow('', null),
    bank_account_number: Joi.string().max(100).allow('', null),
    pan_number: Joi.string().max(50).allow('', null),
    
    pay_period_start: Joi.date().iso(),
    pay_period_end: Joi.date().iso(),
    payment_date: Joi.date().iso(),
    
    basic_salary: Joi.number().min(0),
    hra: Joi.number().min(0),
    conveyance_allowance: Joi.number().min(0),
    medical_allowance: Joi.number().min(0),
    special_allowance: Joi.number().min(0),
    bonus: Joi.number().min(0),
    overtime_pay: Joi.number().min(0),
    other_earnings: Joi.array().items(Joi.object({
      name: Joi.string().max(100).required(),
      amount: Joi.number().min(0).required(),
    })),
    
    provident_fund: Joi.number().min(0),
    professional_tax: Joi.number().min(0),
    income_tax: Joi.number().min(0),
    health_insurance: Joi.number().min(0),
    other_deductions: Joi.array().items(Joi.object({
      name: Joi.string().max(100).required(),
      amount: Joi.number().min(0).required(),
    })),
    
    currency: Joi.string().max(10),
    company_name: Joi.string().min(1).max(255),
    company_address: Joi.string().max(1000).allow('', null),
    company_logo_url: Joi.string().uri().allow('', null),
    status: Joi.string().valid('draft', 'generated', 'sent', 'paid'),
  }).min(1),
};

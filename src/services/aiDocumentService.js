import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { query } from '../config/database.js';
import { createDocument, getDocumentById } from './documentService.js';

function getModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('OPENAI_API_KEY is not configured'), { status: 400 });
  }

  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.25,
  });
}

function toPlainText(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeJsonParse(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Try fenced JSON block
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        // ignore
      }
    }

    // Try first object-like block
    const firstCurly = text.indexOf('{');
    const lastCurly = text.lastIndexOf('}');
    if (firstCurly !== -1 && lastCurly > firstCurly) {
      const candidate = text.slice(firstCurly, lastCurly + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // ignore
      }
    }

    return null;
  }
}

function messageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

async function gatherProjectContext(projectId, contextWindow = {}) {
  const maxTasks = Math.min(Math.max(Number(contextWindow.maxTasks) || 15, 5), 50);
  const maxSprints = Math.min(Math.max(Number(contextWindow.maxSprints) || 5, 1), 20);
  const maxDocs = Math.min(Math.max(Number(contextWindow.maxDocs) || 8, 2), 25);

  const [projectRes, tasksRes, sprintsRes, docsRes] = await Promise.all([
    query(
      `SELECT p.id, p.name, p.key, p.description, p.color,
              u.name AS owner_name
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       WHERE p.id = $1`,
      [projectId]
    ),
    query(
      `SELECT t.id, t.title, t.description, t.type, t.priority, t.status, t.due_date,
              a.name AS assignee_name
       FROM tasks t
       LEFT JOIN users a ON a.id = t.assignee_id
       WHERE t.project_id = $1
       ORDER BY t.updated_at DESC
       LIMIT $2`,
      [projectId, maxTasks]
    ),
    query(
      `SELECT id, name, status, start_date, end_date, goal
       FROM sprints
       WHERE project_id = $1
       ORDER BY COALESCE(end_date, start_date, created_at) DESC
       LIMIT $2`,
      [projectId, maxSprints]
    ),
    query(
      `SELECT id, title, category, word_count,
              LEFT(REGEXP_REPLACE(content, '<[^>]*>', '', 'g'), 1200) AS content_excerpt
       FROM documents
       WHERE project_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [projectId, maxDocs]
    ),
  ]);

  if (!projectRes.rows[0]) {
    throw Object.assign(new Error('Project not found'), { status: 404 });
  }

  return {
    project: projectRes.rows[0],
    tasks: tasksRes.rows,
    sprints: sprintsRes.rows,
    relatedDocs: docsRes.rows,
  };
}

function contextAsText(context) {
  const project = context.project;
  const taskLines = context.tasks.map((t, i) => {
    const due = t.due_date ? `, due ${new Date(t.due_date).toISOString().slice(0, 10)}` : '';
    const assignee = t.assignee_name ? `, assignee ${t.assignee_name}` : '';
    const desc = (t.description || '').slice(0, 180);
    return `${i + 1}. [${t.type}/${t.priority}/${t.status}] ${t.title}${assignee}${due}${desc ? ` :: ${desc}` : ''}`;
  }).join('\n');

  const sprintLines = context.sprints.map((s, i) => {
    const range = [s.start_date, s.end_date]
      .filter(Boolean)
      .map((d) => new Date(d).toISOString().slice(0, 10))
      .join(' → ');
    return `${i + 1}. ${s.name} [${s.status}]${range ? ` (${range})` : ''}${s.goal ? ` :: ${s.goal.slice(0, 200)}` : ''}`;
  }).join('\n');

  const docLines = context.relatedDocs.map((d, i) => (
    `${i + 1}. ${d.title} [${d.category}, ${d.word_count || 0} words] :: ${(d.content_excerpt || '').slice(0, 220)}`
  )).join('\n');

  return [
    `Project: ${project.name} (${project.key})`,
    `Owner: ${project.owner_name}`,
    `Project Description: ${project.description || 'N/A'}`,
    '',
    `Recent Tasks (${context.tasks.length}):`,
    taskLines || 'No tasks found.',
    '',
    `Recent Sprints (${context.sprints.length}):`,
    sprintLines || 'No sprints found.',
    '',
    `Related Docs (${context.relatedDocs.length}):`,
    docLines || 'No related docs found.',
  ].join('\n');
}

function normalizeDraft(data, fallbackTitle) {
  const title = (data?.title || fallbackTitle || 'AI Generated Document').slice(0, 500);
  const category = ['requirements', 'design', 'technical', 'meeting', 'other'].includes(data?.category)
    ? data.category
    : 'other';

  const content = String(data?.content_html || data?.content || '').trim();
  const htmlContent = content.startsWith('<') ? content : `<h1>${title}</h1><p>${content || 'No content generated.'}</p>`;

  return {
    title,
    category,
    content: htmlContent,
    summary: data?.summary || '',
    analysis: {
      quality_score: Number(data?.analysis?.quality_score) || null,
      strengths: Array.isArray(data?.analysis?.strengths) ? data.analysis.strengths : [],
      gaps: Array.isArray(data?.analysis?.gaps) ? data.analysis.gaps : [],
      risks: Array.isArray(data?.analysis?.risks) ? data.analysis.risks : [],
      action_items: Array.isArray(data?.analysis?.action_items) ? data.analysis.action_items : [],
    },
  };
}

export async function generateDocumentDraft(projectId, payload) {
  const {
    prompt,
    title,
    category,
    tone = 'professional',
    targetAudience = 'engineering team',
    additionalContext = '',
    contextWindow = {},
  } = payload;

  const context = await gatherProjectContext(projectId, contextWindow);
  const model = getModel();

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are an expert technical writer and project analyst.
Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "category": "requirements|design|technical|meeting|other",
  "summary": "string",
  "content_html": "string (full rich HTML doc)",
  "analysis": {
    "quality_score": number (0-100),
    "strengths": ["string"],
    "gaps": ["string"],
    "risks": ["string"],
    "action_items": ["string"]
  }
}
Use project context heavily. Keep content practical, specific, and execution-focused.`],
    ['human', `User request:\n{prompt}\n\nPreferred title: {title}\nPreferred category: {category}\nTone: {tone}\nTarget audience: {targetAudience}\nAdditional context: {additionalContext}\n\nProject context:\n{projectContext}`],
  ]);

  const response = await model.invoke(await template.formatMessages({
    prompt,
    title: title || 'AI Generated Document',
    category: category || 'other',
    tone,
    targetAudience,
    additionalContext: additionalContext || 'None',
    projectContext: contextAsText(context),
  }));

  const parsed = safeJsonParse(messageText(response.content));
  const draft = normalizeDraft(parsed, title || 'AI Generated Document');

  if (category && ['requirements', 'design', 'technical', 'meeting', 'other'].includes(category)) {
    draft.category = category;
  }

  return {
    draft,
    context,
  };
}

export async function analyzeDocument(projectId, payload) {
  const { content, title = 'Untitled Document', analysisGoal = '' } = payload;
  const context = await gatherProjectContext(projectId, payload.contextWindow || {});
  const model = getModel();

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are a senior reviewer for product/engineering docs.
Return ONLY valid JSON:
{
  "summary": "string",
  "analysis": {
    "quality_score": number (0-100),
    "strengths": ["string"],
    "gaps": ["string"],
    "risks": ["string"],
    "action_items": ["string"]
  }
}`],
    ['human', `Title: {title}\nAnalysis goal: {analysisGoal}\n\nDocument content:\n{content}\n\nProject context:\n{projectContext}`],
  ]);

  const response = await model.invoke(await template.formatMessages({
    title,
    analysisGoal: analysisGoal || 'Find missing details, risks, and concrete next steps.',
    content: toPlainText(content).slice(0, 12000),
    projectContext: contextAsText(context),
  }));

  const parsed = safeJsonParse(messageText(response.content)) || {};

  return {
    title,
    summary: parsed.summary || '',
    analysis: {
      quality_score: Number(parsed?.analysis?.quality_score) || null,
      strengths: Array.isArray(parsed?.analysis?.strengths) ? parsed.analysis.strengths : [],
      gaps: Array.isArray(parsed?.analysis?.gaps) ? parsed.analysis.gaps : [],
      risks: Array.isArray(parsed?.analysis?.risks) ? parsed.analysis.risks : [],
      action_items: Array.isArray(parsed?.analysis?.action_items) ? parsed.analysis.action_items : [],
    },
    context,
  };
}

export async function createDocumentWithAI(projectId, userId, payload) {
  const { draft, context } = await generateDocumentDraft(projectId, payload);

  const created = await createDocument(projectId, userId, {
    title: draft.title,
    category: draft.category,
    content: draft.content,
  });

  return {
    document: created,
    ai: {
      summary: draft.summary,
      analysis: draft.analysis,
      context,
    },
  };
}

export async function analyzeExistingDocument(projectId, docId, payload = {}) {
  const doc = await getDocumentById(projectId, docId);
  if (!doc) return null;

  return analyzeDocument(projectId, {
    content: doc.content,
    title: doc.title,
    analysisGoal: payload.analysisGoal,
    contextWindow: payload.contextWindow,
  });
}

/**
 * Get AI suggestions for improving the document
 */
export async function getDocumentSuggestions(projectId, payload) {
  const { content, title = 'Untitled Document', category = 'other' } = payload;
  const context = await gatherProjectContext(projectId, payload.contextWindow || {});
  const model = getModel();

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are a senior technical writer and document consultant.
Analyze the provided document and give actionable suggestions for improvement.
Return ONLY valid JSON with this exact shape:
{{
  "suggestions": [
    {{
      "type": "content|structure|clarity|formatting|completeness",
      "title": "short title",
      "description": "detailed description of the suggestion",
      "example": "optional example of improved text",
      "priority": "high|medium|low"
    }}
  ],
  "overall_feedback": "string (2-3 sentence summary)",
  "readability_score": number (0-100),
  "completeness_score": number (0-100)
}}
Focus on practical, actionable improvements. Consider project context.`],
    ['human', `Document Title: {title}
Category: {category}

Document Content:
{content}

Project Context:
{projectContext}

Provide suggestions to improve this document.`],
  ]);

  const response = await model.invoke(await template.formatMessages({
    title,
    category,
    content: toPlainText(content).slice(0, 12000),
    projectContext: contextAsText(context),
  }));

  const parsed = safeJsonParse(messageText(response.content)) || {};

  return {
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    overall_feedback: parsed.overall_feedback || '',
    readability_score: Number(parsed.readability_score) || null,
    completeness_score: Number(parsed.completeness_score) || null,
  };
}

/**
 * Autocomplete text based on current context
 */
export async function getAutoComplete(projectId, payload) {
  const { content, cursorContext, title = '', category = 'other' } = payload;
  const model = getModel();

  // Get minimal context for speed
  const contextData = await gatherProjectContext(projectId, { maxTasks: 5, maxSprints: 2, maxDocs: 3 });

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are an intelligent writing assistant. Complete the user's text naturally.
Return ONLY valid JSON:
{{
  "completion": "string (the suggested completion text, 1-3 sentences max)",
  "alternatives": ["string"] (2-3 alternative completions)
}}
Keep completions concise and contextually relevant. Match the writing style and tone.`],
    ['human', `Document: {title} ({category})
Current text ending:
"{cursorContext}"

Full document preview:
{content}

Project info: {projectName}

Complete the text naturally.`],
  ]);

  const response = await model.invoke(await template.formatMessages({
    title,
    category,
    cursorContext: (cursorContext || '').slice(-500),
    content: toPlainText(content).slice(0, 2000),
    projectName: contextData.project?.name || 'Unknown Project',
  }));

  const parsed = safeJsonParse(messageText(response.content)) || {};

  return {
    completion: parsed.completion || '',
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3) : [],
  };
}

/**
 * Chat with AI about document improvements
 */
export async function chatAboutDocument(projectId, payload) {
  const { content, title = '', category = 'other', message, chatHistory = [] } = payload;
  const context = await gatherProjectContext(projectId, payload.contextWindow || {});
  const model = getModel();

  // Build chat history messages
  const historyMessages = chatHistory.slice(-6).flatMap(msg => [
    ['human', msg.user],
    ['assistant', msg.assistant],
  ]);

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are a helpful AI assistant for document editing. You help users improve their documents.
You have access to the document content and project context.
Provide specific, actionable advice. You can suggest rewrites, improvements, or answer questions about the document.
Keep responses concise but helpful. Use markdown for formatting when appropriate.`],
    ...historyMessages,
    ['human', `Document: {title} ({category})

Current document content:
{content}

Project context:
{projectContext}

User message: {message}`],
  ]);

  const response = await model.invoke(await template.formatMessages({
    title,
    category,
    content: toPlainText(content).slice(0, 8000),
    projectContext: contextAsText(context),
    message,
  }));

  return {
    response: messageText(response.content),
  };
}

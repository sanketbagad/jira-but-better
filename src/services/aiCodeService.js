import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { getConnection, githubFetch } from './githubService.js';

/* ── Model ──────────────────────────────────────────────────── */

function getModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('OPENAI_API_KEY is not configured'), { status: 400 });
  }
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
  });
}

/* ── Helpers ────────────────────────────────────────────────── */

function messageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(c => c.text || '').join('');
  return String(content ?? '');
}

/**
 * Fetch the repo's file tree (recursive, first level + top subdirs).
 * Returns a concise structure summary.
 */
async function fetchRepoStructure(conn) {
  try {
    const tree = await githubFetch(
      `/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/git/trees/HEAD?recursive=1`,
      conn.access_token
    );
    if (!tree?.tree) return 'Could not fetch repository structure.';

    // Take up to 200 entries for context
    const entries = tree.tree
      .filter(e => e.type === 'blob' || e.type === 'tree')
      .slice(0, 200)
      .map(e => `${e.type === 'tree' ? '📁' : '  '} ${e.path}`)
      .join('\n');

    return entries || 'Empty repository.';
  } catch {
    return 'Could not fetch repository structure.';
  }
}

/**
 * Fetch file content from GitHub.  Returns decoded text (max 100 KB).
 */
async function fetchFileContent(conn, filePath) {
  try {
    const data = await githubFetch(
      `/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/contents/${encodeURIComponent(filePath)}`,
      conn.access_token
    );
    if (data?.content) {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
      return decoded.slice(0, 100_000); // cap at 100 KB
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch multiple files in parallel.
 * @param {object} conn   GitHub connection
 * @param {string[]} paths  File paths to fetch
 * @returns {object}  { path: content } map
 */
async function fetchMultipleFiles(conn, paths) {
  const results = {};
  const fetches = paths.slice(0, 10).map(async (p) => {
    const content = await fetchFileContent(conn, p);
    if (content) results[p] = content;
  });
  await Promise.all(fetches);
  return results;
}

/**
 * Smart file discovery — find key files that give the best overview.
 */
async function fetchKeyFiles(conn) {
  const keyPaths = [
    'package.json',
    'README.md',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
    'requirements.txt',
    'Gemfile',
    'pom.xml',
    'build.gradle',
  ];
  return fetchMultipleFiles(conn, keyPaths);
}

/* ── Main chat function ─────────────────────────────────────── */

/**
 * Chat with the codebase.
 *
 * @param {string} projectId  Project ID
 * @param {object} payload
 * @param {string} payload.message          User's message
 * @param {Array}  payload.chatHistory      Previous messages [{role, content}]
 * @param {string[]} [payload.filePaths]    Specific files to include as context
 * @param {boolean} [payload.includeStructure]  Whether to include repo file tree
 */
export async function chatWithCode(projectId, payload) {
  const { message, chatHistory = [], filePaths = [], includeStructure = true } = payload;

  const conn = await getConnection(projectId);
  if (!conn) {
    throw Object.assign(new Error('No GitHub repository connected to this project'), { status: 404 });
  }

  const model = getModel();

  // Gather context in parallel
  const [structure, keyFiles, requestedFiles] = await Promise.all([
    includeStructure ? fetchRepoStructure(conn) : Promise.resolve(''),
    fetchKeyFiles(conn),
    filePaths.length > 0 ? fetchMultipleFiles(conn, filePaths) : Promise.resolve({}),
  ]);

  // Format file contents for the prompt
  const allFiles = { ...keyFiles, ...requestedFiles };
  const filesContext = Object.entries(allFiles)
    .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 15000)}`)
    .join('\n\n');

  // Build chat history for the prompt
  const historyMessages = chatHistory.slice(-8).flatMap(msg => {
    if (msg.role === 'user') return [['human', msg.content]];
    if (msg.role === 'assistant') return [['assistant', msg.content]];
    return [];
  });

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are an expert AI code assistant. You help developers understand, improve, and work with their codebase.

Repository: {owner}/{repo}

Your capabilities:
- Explain code architecture, patterns, and design decisions
- Suggest improvements, refactoring, and best practices
- Help find and fix bugs or potential issues
- Suggest new features and how to implement them
- Review code quality, security, and performance
- Help with documentation and comments
- Explain dependencies and how they're used

Guidelines:
- Be specific and reference actual file paths and code when possible
- Use markdown formatting with code blocks for code suggestions
- When suggesting changes, show the exact code with file paths
- Be concise but thorough — prioritize actionable advice
- If you need to see specific files to answer better, tell the user which files would help
- For improvement suggestions, explain WHY the change is beneficial

{structureSection}

{filesSection}`],
    ...historyMessages,
    ['human', '{message}'],
  ]);

  const structureSection = structure
    ? `Repository structure:\n\`\`\`\n${structure}\n\`\`\``
    : '';

  const filesSection = filesContext
    ? `Key files content:\n${filesContext}`
    : '';

  const response = await model.invoke(await template.formatMessages({
    owner: conn.owner,
    repo: conn.repo,
    structureSection,
    filesSection,
    message,
  }));

  return {
    response: messageText(response.content),
    filesUsed: Object.keys(allFiles),
  };
}

/**
 * Get improvement suggestions for a specific file.
 */
export async function getCodeImprovements(projectId, payload) {
  const { filePath } = payload;

  const conn = await getConnection(projectId);
  if (!conn) {
    throw Object.assign(new Error('No GitHub repository connected to this project'), { status: 404 });
  }

  const model = getModel();
  const content = await fetchFileContent(conn, filePath);

  if (!content) {
    throw Object.assign(new Error(`Could not fetch file: ${filePath}`), { status: 404 });
  }

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are an expert code reviewer. Analyze the given file and provide improvement suggestions.

Return your analysis in this JSON format:
{{
  "overallScore": number (1-10),
  "summary": "Brief overall assessment",
  "improvements": [
    {{
      "type": "bug" | "performance" | "security" | "readability" | "best-practice" | "refactor",
      "severity": "low" | "medium" | "high",
      "line": number or null,
      "title": "Short title",
      "description": "Detailed explanation",
      "suggestion": "Code suggestion or fix"
    }}
  ],
  "positives": ["Things done well"]
}}`],
    ['human', `Repository: {owner}/{repo}
File: {filePath}

\`\`\`
{content}
\`\`\`

Analyze this file and provide improvement suggestions.`],
  ]);

  const response = await model.invoke(await template.formatMessages({
    owner: conn.owner,
    repo: conn.repo,
    filePath,
    content: content.slice(0, 30000),
  }));

  const text = messageText(response.content);

  // Try to parse JSON response
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch {
    // Fall through
  }

  return { response: text };
}

/**
 * Explain a specific file or code snippet.
 */
export async function explainCode(projectId, payload) {
  const { filePath, snippet, question } = payload;

  const conn = await getConnection(projectId);
  if (!conn) {
    throw Object.assign(new Error('No GitHub repository connected to this project'), { status: 404 });
  }

  const model = getModel();
  let codeContent = snippet;

  if (!codeContent && filePath) {
    codeContent = await fetchFileContent(conn, filePath);
  }

  if (!codeContent) {
    throw Object.assign(new Error('No code provided to explain'), { status: 400 });
  }

  const template = ChatPromptTemplate.fromMessages([
    ['system', `You are an expert code educator. Explain code clearly and thoroughly.
Use markdown formatting. Include:
- What the code does at a high level
- Key functions/classes and their purposes
- Important patterns or techniques used
- Any dependencies or external integrations
- Potential gotchas or things to be aware of`],
    ['human', `Repository: {owner}/{repo}
${filePath ? `File: {filePath}` : ''}

\`\`\`
{code}
\`\`\`

${question ? `Specific question: {question}` : 'Explain this code thoroughly.'}`],
  ]);

  const response = await model.invoke(await template.formatMessages({
    owner: conn.owner,
    repo: conn.repo,
    filePath: filePath || '',
    code: codeContent.slice(0, 30000),
    question: question || '',
  }));

  return {
    explanation: messageText(response.content),
  };
}

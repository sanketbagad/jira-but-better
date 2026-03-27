# ToDoApp Backend

Comprehensive Node.js backend for the ToDoApp (Jira-but-better) project management platform.

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express.js
- **Database**: PostgreSQL with raw SQL (pg driver)
- **Caching**: Upstash Redis
- **Background Jobs**: Upstash QStash
- **Realtime**: Socket.io (WebSockets)
- **Auth**: JWT + bcrypt
- **Email**: Nodemailer (SMTP)
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Upstash Redis account (optional - gracefully degrades)
- Upstash QStash account (optional - gracefully degrades)
- OpenAI API key (required for AI document generation/analysis)

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database URL and API keys
```

At minimum, set `DATABASE_URL`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/todoapp
```

For AI-powered document generation/analysis, also set:
```
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

### 3. Create Database

```sql
CREATE DATABASE todoapp;
```

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Seed Demo Data

```bash
npm run seed
```

### 6. Start Server

```bash
npm run dev    # Development (auto-restart)
npm start      # Production
```

Server runs on `http://localhost:3001` by default.

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@gmail.com | admin123 | Admin |
| client@gmail.com | client123 | Client |
| sarah@gmail.com | dev123 | Developer |
| james@gmail.com | dev123 | Developer |
| maria@gmail.com | dev123 | Designer |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |
| PATCH | `/api/auth/password` | Change password |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/:id` | Get project details |
| POST | `/api/projects` | Create project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/tasks` | List tasks (filterable) |
| GET | `/api/projects/:id/tasks/:taskId` | Get task details |
| POST | `/api/projects/:id/tasks` | Create task |
| PATCH | `/api/projects/:id/tasks/:taskId` | Update task |
| DELETE | `/api/projects/:id/tasks/:taskId` | Delete task |

### Sprints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/sprints` | List sprints with tasks |
| POST | `/api/projects/:id/sprints` | Create sprint |
| PATCH | `/api/projects/:id/sprints/:sprintId` | Update sprint |
| DELETE | `/api/projects/:id/sprints/:sprintId` | Delete sprint |

### Team Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/members` | List members |
| PATCH | `/api/projects/:id/members/:memberId` | Change role |
| DELETE | `/api/projects/:id/members/:memberId` | Remove member |

### Invites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/invites` | List invites |
| POST | `/api/projects/:id/invites` | Create & send invite |
| POST | `/api/projects/:id/invites/:inviteId/resend` | Resend invite |
| POST | `/api/projects/:id/invites/:inviteId/accept` | Accept invite |
| DELETE | `/api/projects/:id/invites/:inviteId` | Revoke invite |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/documents` | List documents |
| GET | `/api/projects/:id/documents/:docId` | Get document |
| POST | `/api/projects/:id/documents` | Create document |
| PATCH | `/api/projects/:id/documents/:docId` | Update document |
| POST | `/api/projects/:id/documents/:docId/duplicate` | Duplicate document |
| DELETE | `/api/projects/:id/documents/:docId` | Delete document |
| POST | `/api/projects/:id/documents/ai/generate` | Generate a context-aware draft + analysis |
| POST | `/api/projects/:id/documents/ai/create` | Generate draft with AI and persist as document |
| POST | `/api/projects/:id/documents/ai/analyze` | Analyze doc content or existing `docId` |

### Flowcharts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/flowcharts` | List flowcharts |
| GET | `/api/projects/:id/flowcharts/:flowchartId` | Get flowchart |
| POST | `/api/projects/:id/flowcharts` | Create flowchart |
| PATCH | `/api/projects/:id/flowcharts/:flowchartId` | Update flowchart |
| DELETE | `/api/projects/:id/flowcharts/:flowchartId` | Delete flowchart |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard?projectId=x` | Get dashboard stats |

### GitHub Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/github/connect/:projectId` | Connect repo |
| DELETE | `/api/github/disconnect/:projectId` | Disconnect repo |
| GET | `/api/github/:projectId/repo` | Repo info |
| GET | `/api/github/:projectId/commits` | Recent commits |
| GET | `/api/github/:projectId/branches` | Branches |
| GET | `/api/github/:projectId/pulls` | Pull requests |
| GET | `/api/github/:projectId/files` | File tree |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |

## WebSocket Events

Connect to the server URL with Socket.io, then:

```javascript
// Join a project room for realtime updates
socket.emit('join-project', projectId);

// Listen for events
socket.on('task:created', (task) => { ... });
socket.on('task:updated', (task) => { ... });
socket.on('task:deleted', ({ id }) => { ... });
socket.on('member:updated', (member) => { ... });
socket.on('member:removed', ({ id }) => { ... });
socket.on('document:created', (doc) => { ... });
socket.on('document:updated', (doc) => { ... });
socket.on('document:deleted', ({ id }) => { ... });
socket.on('flowchart:created', (fc) => { ... });
socket.on('flowchart:updated', (fc) => { ... });
socket.on('sprint:created', (sprint) => { ... });
socket.on('invite:created', (invite) => { ... });
socket.on('activity:new', (activity) => { ... });
socket.on('project:deleted', ({ projectId }) => { ... });

// User-specific notifications
socket.emit('join-user', userId);
socket.on('notification:task-assigned', (data) => { ... });
socket.on('notification:daily-digest', (data) => { ... });
```

## Background Jobs (QStash)

| Job | Trigger | Purpose |
|-----|---------|---------|
| `send-invite-email` | When invite created/resent | Sends email with credentials |
| `task-assigned` | When task assigned | Email + realtime notification |
| `cleanup-expired-invites` | Scheduled (cron) | Marks expired invites |
| `daily-digest` | Scheduled (cron) | Overdue task notifications |

## Database Schema

12 tables with proper constraints, indexes, and auto-updating `updated_at` triggers:

- `users` - User accounts
- `projects` - Project workspaces
- `project_members` - User ↔ Project relationship
- `sprints` - Sprint management
- `tasks` - Tasks/issues/stories
- `task_attachments` - File references per task
- `invites` - Team invitations with tokens
- `documents` - Rich text documents
- `document_collaborators` - Document editors
- `flowcharts` - Visual flowcharts (JSONB nodes/connections)
- `github_connections` - GitHub repo links
- `activity_log` - Audit trail + realtime feed

## Rollback Migrations

```bash
npm run migrate:down
```

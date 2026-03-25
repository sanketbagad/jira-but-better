export async function up(pool) {
  await pool.query(`
    CREATE TABLE tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT DEFAULT '',
      type VARCHAR(20) NOT NULL DEFAULT 'Task'
        CHECK (type IN ('Task', 'Bug', 'Story')),
      priority VARCHAR(20) NOT NULL DEFAULT 'Medium'
        CHECK (priority IN ('Low', 'Medium', 'High', 'Highest')),
      status VARCHAR(30) NOT NULL DEFAULT 'To Do'
        CHECK (status IN ('To Do', 'In Progress', 'In Review', 'Done')),
      assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
      reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
      due_date DATE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_tasks_project ON tasks (project_id);
    CREATE INDEX idx_tasks_sprint ON tasks (sprint_id);
    CREATE INDEX idx_tasks_status ON tasks (status);
    CREATE INDEX idx_tasks_assignee ON tasks (assignee_id);
    CREATE INDEX idx_tasks_priority ON tasks (priority);
    CREATE INDEX idx_tasks_project_status ON tasks (project_id, status);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS tasks CASCADE');
}

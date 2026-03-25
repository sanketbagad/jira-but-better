/**
 * Add composite indexes for frequently-used query patterns.
 */
export async function up(client) {
  await client.query(`
    -- tasks: sprint + status for sprint progress queries
    CREATE INDEX IF NOT EXISTS idx_tasks_sprint_status ON tasks (sprint_id, status);

    -- tasks: project + sort + created for ORDER BY in task listings
    CREATE INDEX IF NOT EXISTS idx_tasks_project_sort ON tasks (project_id, sort_order ASC, created_at DESC);

    -- tasks: project + assignee for member task counts
    CREATE INDEX IF NOT EXISTS idx_tasks_project_assignee ON tasks (project_id, assignee_id);

    -- tasks: due_date + status for overdue queries
    CREATE INDEX IF NOT EXISTS idx_tasks_due_status ON tasks (due_date, status) WHERE due_date IS NOT NULL;

    -- tasks: project + sprint (NULL) for backlog queries
    CREATE INDEX IF NOT EXISTS idx_tasks_project_no_sprint ON tasks (project_id, sort_order ASC, created_at DESC) WHERE sprint_id IS NULL;

    -- sprints: project + sort + created for ordered sprint listings
    CREATE INDEX IF NOT EXISTS idx_sprints_project_sort ON sprints (project_id, sort_order ASC, created_at ASC);

    -- documents: project + updated_at for sorted document listings
    CREATE INDEX IF NOT EXISTS idx_documents_project_updated ON documents (project_id, updated_at DESC);

    -- invites: project + email + status for duplicate invite checks
    CREATE INDEX IF NOT EXISTS idx_invites_project_email_status ON invites (project_id, email, status);

    -- invites: status + expires_at for cleanup batch
    CREATE INDEX IF NOT EXISTS idx_invites_status_expires ON invites (status, expires_at) WHERE status = 'pending';
  `);
}

export async function down(client) {
  await client.query(`
    DROP INDEX IF EXISTS idx_tasks_sprint_status;
    DROP INDEX IF EXISTS idx_tasks_project_sort;
    DROP INDEX IF EXISTS idx_tasks_project_assignee;
    DROP INDEX IF EXISTS idx_tasks_due_status;
    DROP INDEX IF EXISTS idx_tasks_project_no_sprint;
    DROP INDEX IF EXISTS idx_sprints_project_sort;
    DROP INDEX IF EXISTS idx_documents_project_updated;
    DROP INDEX IF EXISTS idx_invites_project_email_status;
    DROP INDEX IF EXISTS idx_invites_status_expires;
  `);
}

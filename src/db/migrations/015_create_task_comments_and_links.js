export async function up(pool) {
  await pool.query(`
    -- Task Comments table
    CREATE TABLE task_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      parent_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
      is_edited BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_task_comments_task ON task_comments(task_id);
    CREATE INDEX idx_task_comments_user ON task_comments(user_id);
    CREATE INDEX idx_task_comments_parent ON task_comments(parent_id);

    -- Task Document Links table (links documents to tasks)
    CREATE TABLE task_document_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      linked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(task_id, document_id)
    );

    CREATE INDEX idx_task_doc_links_task ON task_document_links(task_id);
    CREATE INDEX idx_task_doc_links_doc ON task_document_links(document_id);

    -- Task Watchers table (users who want notifications about a task)
    CREATE TABLE task_watchers (
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (task_id, user_id)
    );

    -- Add story points and time tracking to tasks
    ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS story_points INTEGER,
      ADD COLUMN IF NOT EXISTS time_estimate INTEGER, -- in minutes
      ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0, -- in minutes
      ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';

    -- Task history/changelog for tracking changes
    CREATE TABLE task_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      field_name VARCHAR(100) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_task_history_task ON task_history(task_id);
    CREATE INDEX idx_task_history_created ON task_history(created_at DESC);

    -- Trigger function to track task changes
    CREATE OR REPLACE FUNCTION track_task_changes()
    RETURNS TRIGGER AS $$
    DECLARE
      field_name TEXT;
      old_val TEXT;
      new_val TEXT;
      tracked_fields TEXT[] := ARRAY['title', 'description', 'status', 'priority', 'type', 'assignee_id', 'sprint_id', 'due_date', 'story_points', 'time_estimate'];
    BEGIN
      FOREACH field_name IN ARRAY tracked_fields LOOP
        EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', field_name, field_name)
          INTO old_val, new_val
          USING OLD, NEW;
        
        IF old_val IS DISTINCT FROM new_val THEN
          INSERT INTO task_history (task_id, user_id, field_name, old_value, new_value)
          VALUES (NEW.id, COALESCE(current_setting('app.current_user_id', true)::UUID, NEW.reporter_id), field_name, old_val, new_val);
        END IF;
      END LOOP;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS task_changes_trigger ON tasks;
    CREATE TRIGGER task_changes_trigger
      AFTER UPDATE ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION track_task_changes();
  `);
}

export async function down(pool) {
  await pool.query(`
    DROP TRIGGER IF EXISTS task_changes_trigger ON tasks;
    DROP FUNCTION IF EXISTS track_task_changes;
    DROP TABLE IF EXISTS task_history CASCADE;
    DROP TABLE IF EXISTS task_watchers CASCADE;
    DROP TABLE IF EXISTS task_document_links CASCADE;
    DROP TABLE IF EXISTS task_comments CASCADE;
    ALTER TABLE tasks 
      DROP COLUMN IF EXISTS story_points,
      DROP COLUMN IF EXISTS time_estimate,
      DROP COLUMN IF EXISTS time_spent,
      DROP COLUMN IF EXISTS labels;
  `);
}

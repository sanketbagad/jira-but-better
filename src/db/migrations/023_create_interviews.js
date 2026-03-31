import { query } from '../../config/database.js';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS interviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      candidate_name VARCHAR(255) NOT NULL,
      candidate_email VARCHAR(255) NOT NULL,
      candidate_phone VARCHAR(50),
      position_title VARCHAR(255) NOT NULL,
      department VARCHAR(255),
      round VARCHAR(100) NOT NULL DEFAULT 'screening',
      round_number INTEGER NOT NULL DEFAULT 1,
      interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
      scheduled_by UUID REFERENCES users(id) ON DELETE SET NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      meeting_link TEXT,
      meeting_room_id VARCHAR(100),
      interview_type VARCHAR(50) NOT NULL DEFAULT 'video',
      status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      feedback TEXT,
      rating INTEGER,
      resume_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT interviews_round_check CHECK (round IN ('screening', 'technical', 'coding', 'system_design', 'behavioral', 'hr', 'culture_fit', 'final', 'other')),
      CONSTRAINT interviews_type_check CHECK (interview_type IN ('video', 'in_person', 'phone')),
      CONSTRAINT interviews_status_check CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled')),
      CONSTRAINT interviews_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
    );

    CREATE INDEX idx_interviews_candidate_email ON interviews (candidate_email);
    CREATE INDEX idx_interviews_status ON interviews (status);
    CREATE INDEX idx_interviews_scheduled_at ON interviews (scheduled_at);
    CREATE INDEX idx_interviews_interviewer ON interviews (interviewer_id);
    CREATE INDEX idx_interviews_scheduled_by ON interviews (scheduled_by);
  `);
}

export async function down() {
  await query('DROP TABLE IF EXISTS interviews CASCADE');
}

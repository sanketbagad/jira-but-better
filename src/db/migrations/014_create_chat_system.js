export async function up(pool) {
  await pool.query(`
    -- Channels table for team communication
    CREATE TABLE channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      type VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (type IN ('public', 'private', 'direct')),
      created_by UUID NOT NULL REFERENCES users(id),
      is_archived BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(project_id, name)
    );

    -- Channel members for private channels and direct messages
    CREATE TABLE channel_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),
      is_muted BOOLEAN DEFAULT false,
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(channel_id, user_id)
    );

    -- Messages table
    CREATE TABLE messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type VARCHAR(20) DEFAULT 'text'
        CHECK (type IN ('text', 'file', 'image', 'system', 'meeting')),
      reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
      metadata JSONB DEFAULT '{}',
      is_edited BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Message reactions
    CREATE TABLE message_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, user_id, emoji)
    );

    -- Meetings table
    CREATE TABLE meetings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      host_id UUID NOT NULL REFERENCES users(id),
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      timezone VARCHAR(50) DEFAULT 'UTC',
      meeting_link VARCHAR(500),
      meeting_type VARCHAR(20) DEFAULT 'video'
        CHECK (meeting_type IN ('video', 'audio', 'in_person')),
      status VARCHAR(20) DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
      recurrence JSONB DEFAULT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Meeting participants
    CREATE TABLE meeting_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
      is_required BOOLEAN DEFAULT true,
      joined_at TIMESTAMPTZ,
      left_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(meeting_id, user_id)
    );

    -- User presence/online status
    CREATE TABLE user_presence (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'offline'
        CHECK (status IN ('online', 'away', 'busy', 'offline')),
      custom_status VARCHAR(100),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Indexes for performance
    CREATE INDEX idx_channels_project ON channels(project_id);
    CREATE INDEX idx_channels_type ON channels(type);
    CREATE INDEX idx_channel_members_channel ON channel_members(channel_id);
    CREATE INDEX idx_channel_members_user ON channel_members(user_id);
    CREATE INDEX idx_messages_channel ON messages(channel_id);
    CREATE INDEX idx_messages_sender ON messages(sender_id);
    CREATE INDEX idx_messages_created ON messages(created_at DESC);
    CREATE INDEX idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
    CREATE INDEX idx_meetings_project ON meetings(project_id);
    CREATE INDEX idx_meetings_host ON meetings(host_id);
    CREATE INDEX idx_meetings_start ON meetings(start_time);
    CREATE INDEX idx_meetings_status ON meetings(status);
    CREATE INDEX idx_meeting_participants_meeting ON meeting_participants(meeting_id);
    CREATE INDEX idx_meeting_participants_user ON meeting_participants(user_id);

    -- Trigger to update updated_at
    CREATE TRIGGER update_channels_timestamp
      BEFORE UPDATE ON channels
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    CREATE TRIGGER update_messages_timestamp
      BEFORE UPDATE ON messages
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    CREATE TRIGGER update_meetings_timestamp
      BEFORE UPDATE ON meetings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    CREATE TRIGGER update_user_presence_timestamp
      BEFORE UPDATE ON user_presence
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

export async function down(pool) {
  await pool.query(`
    DROP TABLE IF EXISTS message_reactions CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS channel_members CASCADE;
    DROP TABLE IF EXISTS channels CASCADE;
    DROP TABLE IF EXISTS meeting_participants CASCADE;
    DROP TABLE IF EXISTS meetings CASCADE;
    DROP TABLE IF EXISTS user_presence CASCADE;
  `);
}

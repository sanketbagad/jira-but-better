import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, query } from '../config/database.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create demo users
  const adminHash = await bcrypt.hash('admin123', 12);
  const clientHash = await bcrypt.hash('client123', 12);
  const devHash = await bcrypt.hash('dev123', 12);

  const { rows: users } = await query(`
    INSERT INTO users (name, email, password_hash, role, avatar) VALUES
      ('Admin User', 'admin@gmail.com', $1, 'admin', 'AU'),
      ('Client User', 'client@gmail.com', $2, 'client', 'CU'),
      ('Sarah Chen', 'sarah@gmail.com', $3, 'developer', 'SC'),
      ('James Kim', 'james@gmail.com', $3, 'developer', 'JK'),
      ('Maria Lopez', 'maria@gmail.com', $3, 'designer', 'ML')
    ON CONFLICT (email) DO NOTHING
    RETURNING id, name, email, role, avatar
  `, [adminHash, clientHash, devHash]);

  if (users.length === 0) {
    console.log('Users already exist, skipping seed');
    await pool.end();
    return;
  }

  const admin = users[0];
  const sarah = users[2];
  const james = users[3];

  // Create demo project
  const { rows: projects } = await query(`
    INSERT INTO projects (name, key, description, color, owner_id) VALUES
      ('TaskForge', 'TF', 'Main project management platform', 0, $1),
      ('Mobile App', 'MA', 'React Native mobile application', 2, $1)
    RETURNING id, name, key
  `, [admin.id]);

  const projTF = projects[0];
  const projMA = projects[1];

  // Add members to project
  await query(`
    INSERT INTO project_members (project_id, user_id, role) VALUES
      ($1, $2, 'admin'),
      ($1, $3, 'developer'),
      ($1, $4, 'developer'),
      ($1, $5, 'designer'),
      ($6, $2, 'admin'),
      ($6, $3, 'developer')
  `, [projTF.id, admin.id, sarah.id, james.id, users[4].id, projMA.id]);

  // Create sprints
  const { rows: sprints } = await query(`
    INSERT INTO sprints (project_id, name, status, start_date, end_date, sort_order) VALUES
      ($1, 'Sprint 1', 'active', '2026-03-10', '2026-03-24', 0),
      ($1, 'Sprint 2', 'planned', '2026-03-24', '2026-04-07', 1)
    RETURNING id, name
  `, [projTF.id]);

  // Create tasks
  await query(`
    INSERT INTO tasks (project_id, sprint_id, title, description, type, priority, status, assignee_id, reporter_id) VALUES
      ($1, $3, 'Setup project authentication', 'Implement JWT-based auth flow', 'Task', 'High', 'Done', $5, $4),
      ($1, $3, 'Design dashboard layout', 'Create responsive dashboard UI', 'Story', 'Medium', 'In Review', $6, $4),
      ($1, $3, 'Fix login redirect bug', 'Users not redirected after login', 'Bug', 'Highest', 'In Progress', $5, $4),
      ($1, $3, 'Add drag-drop to board', 'Implement DnD for kanban columns', 'Task', 'High', 'To Do', $6, $4),
      ($1, NULL, 'Write API documentation', 'Document all REST endpoints', 'Task', 'Low', 'To Do', NULL, $4),
      ($2, NULL, 'Setup React Native project', 'Initialize mobile app', 'Task', 'High', 'To Do', $5, $4)
  `, [projTF.id, projMA.id, sprints[0].id, admin.id, sarah.id, james.id]);

  // Create sample documents
  await query(`
    INSERT INTO documents (project_id, title, category, content, author_id, word_count) VALUES
      ($1, 'Project Requirements', 'requirements', '<h1>Requirements</h1><p>Core features for v1.0</p>', $2, 25),
      ($1, 'API Design Spec', 'technical', '<h1>API Design</h1><p>RESTful API specifications</p>', $2, 40)
  `, [projTF.id, admin.id]);

  // Create sample flowchart
  await query(`
    INSERT INTO flowcharts (project_id, title, description, author_id, nodes, connections) VALUES
      ($1, 'Auth Flow', 'User authentication flow', $2,
        '[{"id":"n1","type":"start","label":"Start","x":300,"y":50,"width":160,"height":50},{"id":"n2","type":"process","label":"Login Form","x":300,"y":150,"width":160,"height":50},{"id":"n3","type":"decision","label":"Valid?","x":300,"y":260,"width":160,"height":70},{"id":"n4","type":"process","label":"Dashboard","x":150,"y":380,"width":160,"height":50},{"id":"n5","type":"process","label":"Show Error","x":450,"y":380,"width":160,"height":50}]',
        '[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"},{"from":"n3","to":"n4","label":"Yes"},{"from":"n3","to":"n5","label":"No"}]'
      )
  `, [projTF.id, admin.id]);

  // Log activity
  await query(`
    INSERT INTO activity_log (project_id, user_id, action, entity_type, entity_title) VALUES
      ($1, $2, 'created', 'project', 'TaskForge'),
      ($1, $2, 'created', 'task', 'Setup project authentication'),
      ($1, $3, 'completed', 'task', 'Setup project authentication')
  `, [projTF.id, admin.id, sarah.id]);

  console.log('✅ Seed data inserted successfully');
  console.log(`   ${users.length} users, ${projects.length} projects, ${sprints.length} sprints`);
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

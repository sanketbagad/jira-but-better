import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { cleanupChannels } from './src/config/socket.js';
import { supabase } from './src/config/supabase.js';
import { pool, testConnection, warmPool } from './src/config/database.js';
import { redis } from './src/config/redis.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import authRoutes from './src/routes/auth.js';
import projectRoutes from './src/routes/projects.js';
import taskRoutes from './src/routes/tasks.js';
import memberRoutes from './src/routes/members.js';
import inviteRoutes from './src/routes/invites.js';
import documentRoutes from './src/routes/documents.js';
import flowchartRoutes from './src/routes/flowcharts.js';
import sprintRoutes from './src/routes/sprints.js';
import dashboardRoutes from './src/routes/dashboard.js';
import githubRoutes from './src/routes/github.js';
import webhookRoutes from './src/routes/webhooks.js';
import storageRoutes from './src/routes/storage.js';

const app = express();
const server = http.createServer(app);

// Security & parsing middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', async (_req, res) => {
  const dbOk = await testConnection();
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch { /* ignore */ }
  const supabaseOk = !!supabase;

  res.json({
    status: dbOk ? 'healthy' : 'degraded',
    services: { database: dbOk, redis: redisOk, supabase: supabaseOk },
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', taskRoutes);
app.use('/api/projects', memberRoutes);
app.use('/api/projects', inviteRoutes);
app.use('/api/projects', documentRoutes);
app.use('/api/projects', flowchartRoutes);
app.use('/api/projects', sprintRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/projects', storageRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  const dbOk = await testConnection();
  console.log(`📦 Database: ${dbOk ? 'connected' : 'disconnected'}`);
  if (dbOk) {
    await warmPool();
    console.log('📦 Database pool pre-warmed');
  }
  console.log(`🟢 Supabase: ${supabase ? 'connected' : 'not configured'}`);
  try {
    await redis.ping();
    console.log('🔴 Redis: connected');
  } catch {
    console.log('🔴 Redis: not available (caching disabled)');
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close();
  await cleanupChannels();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;

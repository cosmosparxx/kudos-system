import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';

// Load environment variables
config();

import { createDbPool } from './database/db.js';
import { createRedisClient } from './cache/redis.js';
import logger from './utils/logger.js';

// Route imports
import kudosRoutes from './routes/kudos.js';
import userRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/kudos', kudosRoutes);
app.use('/api/v1/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Initialize server
async function startServer() {
  try {
    // Initialize database connection pool
    const dbPool = await createDbPool();
    logger.info('Database connection pool initialized');

    // Initialize Redis client
    const redisClient = await createRedisClient();
    logger.info('Redis client connected');

    // Store in app context for use in routes
    app.locals.dbPool = dbPool;
    app.locals.redisClient = redisClient;

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Kudos API server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;

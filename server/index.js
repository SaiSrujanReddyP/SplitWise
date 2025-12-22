require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const connectDB = require('./config/db');
const { initRedis } = require('./config/redis');
const { initDistributedLock } = require('./utils/distributedLock');
const { initQueues } = require('./services/queueService');
const { generalLimiter } = require('./middleware/rateLimiter');
const routes = require('./routes');

const app = express();

// Initialize services
const initializeServices = async () => {
  // Connect to MongoDB
  await connectDB();
  
  // Initialize Redis (optional - graceful fallback if unavailable)
  initRedis();
  
  // Initialize distributed lock manager
  initDistributedLock();
  
  // Initialize job queues
  initQueues();
};

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(compression()); // Gzip compression for responses
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(generalLimiter); // Global rate limiting

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Request logging (simple APM)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) { // Log slow requests
      console.log(`⚠️ Slow request: ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Routes
app.use('/api', routes);

// Health check with service status
app.get('/health', async (req, res) => {
  const { isRedisConnected } = require('./config/redis');
  const { getActiveLockCount } = require('./utils/distributedLock');
  const { activityQueue, balanceQueue } = require('./utils/queue');
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: isRedisConnected() ? 'connected' : 'disconnected',
      locks: getActiveLockCount()
    },
    queues: {
      activities: activityQueue.getStats(),
      balances: balanceQueue.getStats()
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;

initializeServices()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize services:', err);
    process.exit(1);
  });

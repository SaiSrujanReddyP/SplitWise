/**
 * Simple In-Memory Job Queue
 * 
 * Design Decision: Lightweight async job processing
 * - Decouples write-heavy operations (activity logging, notifications)
 * - Processes jobs in background without blocking API responses
 * - Falls back gracefully - jobs run synchronously if queue fails
 * 
 * For production at scale, replace with:
 * - Bull/BullMQ (Redis-based)
 * - AWS SQS
 * - RabbitMQ
 * 
 * This implementation provides the abstraction layer so swapping
 * to a production queue requires minimal code changes.
 */

class JobQueue {
  constructor(name, options = {}) {
    this.name = name;
    this.concurrency = options.concurrency || 5;
    this.jobs = [];
    this.processing = 0;
    this.handlers = new Map();
    this.isProcessing = false;
    
    // Stats for monitoring
    this.stats = {
      processed: 0,
      failed: 0,
      pending: 0
    };
  }

  /**
   * Register a job handler
   */
  process(jobType, handler) {
    this.handlers.set(jobType, handler);
  }

  /**
   * Add a job to the queue
   */
  async add(jobType, data, options = {}) {
    const job = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: jobType,
      data,
      attempts: 0,
      maxAttempts: options.attempts || 3,
      delay: options.delay || 0,
      createdAt: new Date()
    };

    this.jobs.push(job);
    this.stats.pending++;

    // Start processing if not already
    if (!this.isProcessing) {
      this.processJobs();
    }

    return job;
  }

  /**
   * Process jobs from queue
   */
  async processJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.jobs.length > 0 && this.processing < this.concurrency) {
      const job = this.jobs.shift();
      if (!job) continue;

      this.processing++;
      this.stats.pending--;

      // Handle delayed jobs
      if (job.delay > 0) {
        const elapsed = Date.now() - job.createdAt.getTime();
        if (elapsed < job.delay) {
          setTimeout(() => {
            this.jobs.push(job);
            this.stats.pending++;
          }, job.delay - elapsed);
          this.processing--;
          continue;
        }
      }

      // Process job
      this.executeJob(job).finally(() => {
        this.processing--;
        if (this.jobs.length > 0) {
          setImmediate(() => this.processJobs());
        }
      });
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single job
   */
  async executeJob(job) {
    const handler = this.handlers.get(job.type);
    
    if (!handler) {
      console.error(`No handler for job type: ${job.type}`);
      this.stats.failed++;
      return;
    }

    try {
      job.attempts++;
      await handler(job.data);
      this.stats.processed++;
    } catch (err) {
      console.error(`Job ${job.type} failed:`, err.message);
      
      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        job.delay = Math.pow(2, job.attempts) * 1000;
        this.jobs.push(job);
        this.stats.pending++;
      } else {
        this.stats.failed++;
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.jobs.length,
      processing: this.processing
    };
  }

  /**
   * Clear all pending jobs
   */
  clear() {
    this.jobs = [];
    this.stats.pending = 0;
  }
}

// Create queues for different job types
const activityQueue = new JobQueue('activities', { concurrency: 10 });
const notificationQueue = new JobQueue('notifications', { concurrency: 5 });
const balanceQueue = new JobQueue('balances', { concurrency: 3 });

// Export queues and factory
module.exports = {
  JobQueue,
  activityQueue,
  notificationQueue,
  balanceQueue
};

// worker/PhoenixBaseWorker.js
// Aligned with Project Phoenix spec - Failure-Resilient Workers
import { MongoClient } from 'mongodb';
import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

// Task status enum (matches spec exactly)
export const TaskStatus = {
  BLOCKED: 'BLOCKED',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

// Task types (matches spec)
export const TaskType = {
  SEARCH: 'SEARCH',
  SUMMARIZE: 'SUMMARIZE',
  PROVISION_INFRA: 'PROVISION_INFRA',
  CODE_GENERATE: 'CODE_GENERATE',
  ANALYZE: 'ANALYZE',
  VALIDATE: 'VALIDATE',
  SYNTHESIZE: 'SYNTHESIZE',
  PLAN: 'PLAN'
};

// Log levels
export const LogLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

export class PhoenixBaseWorker {
  constructor(config) {
    this.workerId = config.workerId || `worker_${uuidv4().slice(0, 8)}`;
    this.name = config.name;
    this.taskTypes = config.taskTypes || []; // Task types this worker handles
    this.mongoClient = null;
    this.db = null;
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.isRunning = false;
    this.lockTimeoutMs = 5 * 60 * 1000; // 5 minutes (spec requirement)
    this.pollIntervalMs = 1000; // 1 second
  }

  async connect() {
    try {
      this.mongoClient = new MongoClient(process.env.MONGODB_URI);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('phoenix');
      
      // Register worker
      await this.db.collection('workers').updateOne(
        { workerId: this.workerId },
        { 
          $set: {
            workerId: this.workerId,
            name: this.name,
            taskTypes: this.taskTypes,
            status: 'ONLINE',
            lastHeartbeat: new Date()
          }
        },
        { upsert: true }
      );

      await this.log(LogLevel.INFO, `Worker ${this.name} connected`, null, null);
      logger.info(`Worker ${this.name} (${this.workerId}) connected to Phoenix DB`);
    } catch (error) {
      logger.error('Connection failed:', error);
      throw error;
    }
  }

  // Immutable log entry (spec requirement)
  async log(level, message, workflowId = null, taskId = null) {
    await this.db.collection('logs').insertOne({
      timestamp: new Date().toISOString(),
      level,
      component: `${this.name}_${this.workerId.slice(-4)}`,
      message,
      workflow_id: workflowId,
      task_id: taskId
    });
  }

  // ATOMIC DISTRIBUTED LOCK (spec section 5.2)
  async claimTask() {
    const now = new Date();
    
    // Find and atomically claim a PENDING task matching our types
    const task = await this.db.collection('tasks').findOneAndUpdate(
      {
        status: TaskStatus.PENDING,
        type: { $in: this.taskTypes }
      },
      {
        $set: {
          status: TaskStatus.IN_PROGRESS,
          worker_lock: this.workerId,
          locked_at: now
        }
      },
      { 
        sort: { created_at: 1 }, // FIFO
        returnDocument: 'after' 
      }
    );

    return task;
  }

  // Main polling loop
  async startPolling() {
    this.isRunning = true;
    logger.info(`Worker ${this.name} starting poll loop...`);

    while (this.isRunning) {
      try {
        // Update heartbeat
        await this.db.collection('workers').updateOne(
          { workerId: this.workerId },
          { $set: { lastHeartbeat: new Date(), status: 'ONLINE' } }
        );

        // Try to claim a task
        const task = await this.claimTask();

        if (task) {
          await this.executeTask(task);
        }

        await this.sleep(this.pollIntervalMs);
      } catch (error) {
        logger.error(`Poll error: ${error.message}`);
        await this.log(LogLevel.ERROR, `Poll error: ${error.message}`, null, null);
        await this.sleep(5000); // Back off on error
      }
    }
  }

  async executeTask(task) {
    const startTime = Date.now();
    
    await this.log(
      LogLevel.INFO, 
      `Starting task execution: ${task.type}`,
      task.workflow_id,
      task._id.toString()
    );

    logger.info(`Worker ${this.name} executing task ${task._id} (${task.type})`);

    try {
      // Execute the task (override in subclass)
      const result = await this.processTask(task);

      // Mark task as COMPLETED
      await this.db.collection('tasks').updateOne(
        { _id: task._id },
        {
          $set: {
            status: TaskStatus.COMPLETED,
            output_artifact: result,
            completed_at: new Date(),
            worker_lock: null,
            locked_at: null
          }
        }
      );

      await this.log(
        LogLevel.INFO,
        `Task completed in ${Date.now() - startTime}ms`,
        task.workflow_id,
        task._id.toString()
      );

      logger.info(`Task ${task._id} completed successfully`);

    } catch (error) {
      await this.handleTaskFailure(task, error);
    }
  }

  // RETRY LOGIC (spec requirement)
  async handleTaskFailure(task, error) {
    const newRetryCount = (task.retry_count || 0) + 1;
    const maxRetries = task.max_retries || 3;

    await this.log(
      LogLevel.ERROR,
      `Task failed: ${error.message} (retry ${newRetryCount}/${maxRetries})`,
      task.workflow_id,
      task._id.toString()
    );

    if (newRetryCount <= maxRetries) {
      // Reset to PENDING for retry
      await this.db.collection('tasks').updateOne(
        { _id: task._id },
        {
          $set: {
            status: TaskStatus.PENDING,
            worker_lock: null,
            locked_at: null,
            retry_count: newRetryCount,
            last_error: error.message
          }
        }
      );

      logger.warn(`Task ${task._id} will be retried (${newRetryCount}/${maxRetries})`);
    } else {
      // Max retries exceeded - FAILED
      await this.db.collection('tasks').updateOne(
        { _id: task._id },
        {
          $set: {
            status: TaskStatus.FAILED,
            worker_lock: null,
            locked_at: null,
            retry_count: newRetryCount,
            last_error: error.message,
            failed_at: new Date()
          }
        }
      );

      logger.error(`Task ${task._id} permanently FAILED after ${maxRetries} retries`);
    }
  }

  // Override in subclass
  async processTask(task) {
    throw new Error('processTask must be implemented by subclass');
  }

  async callLLM(prompt, systemPrompt = '') {
    const response = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });
    return response.choices[0].message.content;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown() {
    this.isRunning = false;
    
    await this.db.collection('workers').updateOne(
      { workerId: this.workerId },
      { $set: { status: 'OFFLINE', lastHeartbeat: new Date() } }
    );

    await this.log(LogLevel.INFO, `Worker ${this.name} shutting down`, null, null);
    await this.mongoClient.close();
    logger.info(`Worker ${this.name} shut down`);
  }
}
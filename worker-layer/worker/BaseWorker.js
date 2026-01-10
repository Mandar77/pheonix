// worker/BaseWorker.js
import { MongoClient, ObjectId } from 'mongodb';
import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'worker.log' })
  ]
});

export class BaseWorker {
  constructor(config) {
    this.workerId = config.workerId || uuidv4();
    this.name = config.name;
    this.capabilities = config.capabilities || [];
    this.status = 'idle';
    this.currentTask = null;
    this.mongoClient = null;
    this.db = null;
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL;
    this.watchdogUrl = process.env.WATCHDOG_URL;
  }

  async connect() {
    try {
      this.mongoClient = new MongoClient(process.env.MONGODB_URI);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('hackathon_agents');
      logger.info(`Worker ${this.name} connected to MongoDB`);
      await this.registerWithOrchestrator();
      await this.reportToWatchdog('online');
    } catch (error) {
      logger.error('Connection failed:', error);
      throw error;
    }
  }

  async registerWithOrchestrator() {
    const registration = {
      workerId: this.workerId,
      name: this.name,
      capabilities: this.capabilities,
      status: this.status,
      registeredAt: new Date()
    };
    
    // Store in MongoDB for orchestrator to discover
    await this.db.collection('workers').updateOne(
      { workerId: this.workerId },
      { $set: registration },
      { upsert: true }
    );
    
    // Also notify orchestrator directly (if URL is configured)
    if (this.orchestratorUrl) {
      try {
        await fetch(`${this.orchestratorUrl}/workers/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registration)
        });
      } catch (e) {
        // Silently ignore - orchestrator not running yet, data is in MongoDB
      }
    }
    
    logger.info(`Worker ${this.name} registered with capabilities: ${this.capabilities.join(', ')}`);
  }

  async reportToWatchdog(event, details = {}) {
    const report = {
      workerId: this.workerId,
      workerName: this.name,
      event,
      status: this.status,
      currentTask: this.currentTask?.taskId || null,
      timestamp: new Date(),
      details
    };
    
    // Store in MongoDB for watchdog to monitor
    await this.db.collection('worker_heartbeats').insertOne(report);
    
    // Direct notification to watchdog (only if URL is configured)
    if (this.watchdogUrl) {
      try {
        await fetch(`${this.watchdogUrl}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
      } catch (e) {
        // Silently ignore - watchdog not running yet, data is in MongoDB
      }
    }
  }

  async pollForTasks() {
    logger.info(`Worker ${this.name} polling for tasks...`);
    
    while (true) {
      try {
        if (this.status === 'idle') {
          // Find task matching our capabilities
          const task = await this.db.collection('task_queue').findOneAndUpdate(
            {
              status: 'pending',
              requiredCapability: { $in: this.capabilities }
            },
            {
              $set: {
                status: 'assigned',
                assignedTo: this.workerId,
                assignedAt: new Date()
              }
            },
            { sort: { priority: -1, createdAt: 1 }, returnDocument: 'after' }
          );

          if (task) {
            await this.executeTask(task);
          }
        }
        
        await this.reportToWatchdog('heartbeat');
        await new Promise(r => setTimeout(r, 1000)); // Poll every second
      } catch (error) {
        logger.error('Polling error:', error);
        await this.reportToWatchdog('error', { error: error.message });
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  async executeTask(task) {
    this.status = 'busy';
    this.currentTask = task;
    
    logger.info(`Worker ${this.name} executing task: ${task.taskId}`);
    await this.reportToWatchdog('task_started', { taskId: task.taskId });

    try {
      // Load context from MongoDB
      const context = await this.loadContext(task.contextId);
      
      // Execute the task (override in subclass)
      const result = await this.processTask(task, context);
      
      // Store result
      await this.storeResult(task, result);
      
      // Update task status
      await this.db.collection('task_queue').updateOne(
        { _id: task._id },
        { 
          $set: { 
            status: 'completed', 
            completedAt: new Date(),
            result 
          } 
        }
      );

      await this.reportToWatchdog('task_completed', { 
        taskId: task.taskId, 
        success: true 
      });
      
      logger.info(`Task ${task.taskId} completed successfully`);
    } catch (error) {
      logger.error(`Task ${task.taskId} failed:`, error);
      
      await this.db.collection('task_queue').updateOne(
        { _id: task._id },
        { 
          $set: { 
            status: 'failed', 
            error: error.message,
            failedAt: new Date()
          } 
        }
      );
      
      await this.reportToWatchdog('task_failed', { 
        taskId: task.taskId, 
        error: error.message 
      });
    } finally {
      this.status = 'idle';
      this.currentTask = null;
    }
  }

  async loadContext(contextId) {
    if (!contextId) return {};
    const ctx = await this.db.collection('contexts').findOne({ contextId });
    return ctx?.data || {};
  }

  async storeResult(task, result) {
    await this.db.collection('task_results').insertOne({
      taskId: task.taskId,
      workerId: this.workerId,
      workerName: this.name,
      result,
      completedAt: new Date()
    });
    
    // Update shared context if needed
    if (result.contextUpdate) {
      await this.db.collection('contexts').updateOne(
        { contextId: task.contextId },
        { $set: { data: result.contextUpdate, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  }

  // Override this in specialized workers
  async processTask(task, context) {
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

  async shutdown() {
    this.status = 'offline';
    await this.reportToWatchdog('shutdown');
    await this.db.collection('workers').updateOne(
      { workerId: this.workerId },
      { $set: { status: 'offline', lastSeen: new Date() } }
    );
    await this.mongoClient.close();
    logger.info(`Worker ${this.name} shut down`);
  }
}
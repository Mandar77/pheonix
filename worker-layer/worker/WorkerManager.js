// worker/WorkerManager.js
import express from 'express';
import { ResearchWorker, CodeWorker, AnalysisWorker, CommunicationWorker } from './SpecializedWorkers.js';
import { PlannerWorker, WebScraperWorker, SynthesisWorker, MemoryWorker, ValidatorWorker } from './AdvancedWorkers.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

export class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      const workerStatuses = Array.from(this.workers.values()).map(w => ({
        id: w.workerId,
        name: w.name,
        status: w.status,
        capabilities: w.capabilities,
        currentTask: w.currentTask?.taskId || null
      }));
      res.json({ status: 'healthy', workers: workerStatuses });
    });

    // Get all workers
    this.app.get('/workers', (req, res) => {
      const workers = Array.from(this.workers.values()).map(w => ({
        workerId: w.workerId,
        name: w.name,
        capabilities: w.capabilities,
        status: w.status
      }));
      res.json(workers);
    });

    // Direct task assignment (from orchestrator)
    this.app.post('/tasks/assign', async (req, res) => {
      const { taskId, requiredCapability, payload, contextId, priority } = req.body;
      
      // Find available worker with capability
      const worker = Array.from(this.workers.values()).find(
        w => w.capabilities.includes(requiredCapability) && w.status === 'idle'
      );

      if (!worker) {
        // Queue in MongoDB for polling
        await this.queueTask(req.body);
        return res.json({ queued: true, message: 'No available worker, task queued' });
      }

      // Execute immediately
      const task = {
        taskId,
        requiredCapability,
        payload,
        contextId,
        priority: priority || 1,
        status: 'assigned'
      };

      worker.executeTask(task).catch(err => logger.error('Task execution error:', err));
      res.json({ assigned: true, workerId: worker.workerId });
    });

    // Query worker capabilities
    this.app.get('/capabilities', (req, res) => {
      const allCapabilities = new Set();
      this.workers.forEach(w => w.capabilities.forEach(c => allCapabilities.add(c)));
      res.json({ capabilities: Array.from(allCapabilities) });
    });

    // Find workers by capability
    this.app.get('/workers/by-capability/:capability', (req, res) => {
      const { capability } = req.params;
      const matching = Array.from(this.workers.values())
        .filter(w => w.capabilities.includes(capability))
        .map(w => ({
          workerId: w.workerId,
          name: w.name,
          status: w.status,
          capabilities: w.capabilities
        }));
      res.json(matching);
    });

    // Get worker status
    this.app.get('/workers/:workerId/status', (req, res) => {
      const worker = this.workers.get(req.params.workerId);
      if (!worker) return res.status(404).json({ error: 'Worker not found' });
      res.json({
        workerId: worker.workerId,
        name: worker.name,
        status: worker.status,
        currentTask: worker.currentTask,
        capabilities: worker.capabilities
      });
    });

    // Stop a worker
    this.app.post('/workers/:workerId/stop', async (req, res) => {
      const worker = this.workers.get(req.params.workerId);
      if (!worker) return res.status(404).json({ error: 'Worker not found' });
      await worker.shutdown();
      this.workers.delete(req.params.workerId);
      res.json({ stopped: true });
    });

    // Spawn new worker
    this.app.post('/workers/spawn', async (req, res) => {
      const { type } = req.body;
      try {
        const worker = await this.spawnWorker(type);
        res.json({ 
          spawned: true, 
          workerId: worker.workerId, 
          name: worker.name,
          capabilities: worker.capabilities 
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
  }

  async queueTask(taskData) {
    const worker = Array.from(this.workers.values())[0];
    if (worker && worker.db) {
      await worker.db.collection('task_queue').insertOne({
        ...taskData,
        status: 'pending',
        createdAt: new Date()
      });
    }
  }

  async spawnWorker(type) {
    const workerId = `${type}_${Date.now()}`;
    let worker;

    switch (type) {
      case 'research':
        worker = new ResearchWorker(workerId);
        break;
      case 'code':
        worker = new CodeWorker(workerId);
        break;
      case 'analysis':
        worker = new AnalysisWorker(workerId);
        break;
      case 'communication':
        worker = new CommunicationWorker(workerId);
        break;
      case 'planner':
        worker = new PlannerWorker(workerId);
        break;
      case 'scraper':
        worker = new WebScraperWorker(workerId);
        break;
      case 'synthesis':
        worker = new SynthesisWorker(workerId);
        break;
      case 'memory':
        worker = new MemoryWorker(workerId);
        break;
      case 'validator':
        worker = new ValidatorWorker(workerId);
        break;
      default:
        throw new Error(`Unknown worker type: ${type}`);
    }

    await worker.connect();
    this.workers.set(worker.workerId, worker);
    
    // Start polling in background
    worker.pollForTasks().catch(err => logger.error(`Worker ${workerId} polling error:`, err));
    
    return worker;
  }

  async start(port = process.env.WORKER_PORT || 3001) {
    // Spawn initial workers - all 9 types
    const workerTypes = [
      'research', 
      'code', 
      'analysis', 
      'communication',
      'planner',
      'scraper',
      'synthesis',
      'memory',
      'validator'
    ];
    
    for (const type of workerTypes) {
      try {
        const worker = await this.spawnWorker(type);
        logger.info(`Spawned ${type} worker: ${worker.workerId}`);
      } catch (error) {
        logger.error(`Failed to spawn ${type} worker:`, error);
      }
    }

    this.app.listen(port, () => {
      logger.info(`Worker Manager running on port ${port}`);
      logger.info(`Active workers: ${this.workers.size}`);
    });
  }

  async shutdown() {
    logger.info('Shutting down all workers...');
    for (const worker of this.workers.values()) {
      await worker.shutdown();
    }
    this.workers.clear();
    logger.info('All workers shut down');
  }
}
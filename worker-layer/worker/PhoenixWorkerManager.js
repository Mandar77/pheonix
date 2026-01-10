// worker/PhoenixWorkerManager.js
// Worker Manager aligned with Project Phoenix spec
import express from 'express';
import cors from 'cors';
import { 
  SearcherWorker, 
  SummarizerWorker, 
  InfraWorker, 
  CodeGenWorker,
  AnalyzerWorker,
  ValidatorWorker,
  PlannerWorker
} from './PhoenixWorkers.js';
import { TaskStatus, LogLevel } from './PhoenixBaseWorker.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => 
      `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [new winston.transports.Console()]
});

export class PhoenixWorkerManager {
  constructor() {
    this.workers = new Map();
    this.app = express();
    
    // CORS - Allow frontend (localhost:3000) to access backend
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      const workerStatuses = Array.from(this.workers.values()).map(w => ({
        id: w.workerId,
        name: w.name,
        taskTypes: w.taskTypes,
        isRunning: w.isRunning
      }));
      res.json({ 
        status: 'healthy', 
        workers: workerStatuses,
        workerCount: this.workers.size
      });
    });

    // List all workers
    this.app.get('/workers', (req, res) => {
      const workers = Array.from(this.workers.values()).map(w => ({
        workerId: w.workerId,
        name: w.name,
        taskTypes: w.taskTypes,
        isRunning: w.isRunning
      }));
      res.json(workers);
    });

    // Get worker capabilities
    this.app.get('/capabilities', (req, res) => {
      const allTypes = new Set();
      this.workers.forEach(w => w.taskTypes.forEach(t => allTypes.add(t)));
      res.json({ 
        taskTypes: Array.from(allTypes),
        workers: Array.from(this.workers.values()).map(w => ({
          name: w.name,
          handles: w.taskTypes
        }))
      });
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
          taskTypes: worker.taskTypes 
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Stop worker
    this.app.post('/workers/:workerId/stop', async (req, res) => {
      const worker = this.workers.get(req.params.workerId);
      if (!worker) return res.status(404).json({ error: 'Worker not found' });
      await worker.shutdown();
      this.workers.delete(req.params.workerId);
      res.json({ stopped: true });
    });

    // Get logs (for frontend)
    this.app.get('/logs', async (req, res) => {
      const { workflow_id, limit = 50 } = req.query;
      const worker = Array.from(this.workers.values())[0];
      if (!worker?.db) return res.status(500).json({ error: 'No DB connection' });

      const filter = workflow_id ? { workflow_id } : {};
      const logs = await worker.db.collection('logs')
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .toArray();
      
      res.json(logs);
    });

    // Get tasks (for frontend)
    this.app.get('/tasks', async (req, res) => {
      const { workflow_id, status } = req.query;
      const worker = Array.from(this.workers.values())[0];
      if (!worker?.db) return res.status(500).json({ error: 'No DB connection' });

      const filter = {};
      if (workflow_id) filter.workflow_id = workflow_id;
      if (status) filter.status = status;

      const tasks = await worker.db.collection('tasks')
        .find(filter)
        .sort({ created_at: 1 })
        .toArray();
      
      res.json(tasks);
    });

    // Manual task trigger (for demo)
    this.app.post('/tasks', async (req, res) => {
      const worker = Array.from(this.workers.values())[0];
      if (!worker?.db) return res.status(500).json({ error: 'No DB connection' });

      const task = {
        _id: req.body._id || `task_${Date.now()}`,
        workflow_id: req.body.workflow_id,
        type: req.body.type,
        description: req.body.description || '',
        status: TaskStatus.PENDING,
        dependencies: req.body.dependencies || [],
        retry_count: 0,
        max_retries: req.body.max_retries || 3,
        worker_lock: null,
        locked_at: null,
        input_context: req.body.input_context || {},
        output_artifact: null,
        created_at: new Date()
      };

      await worker.db.collection('tasks').insertOne(task);
      res.json({ created: true, task });
    });
  }

  async spawnWorker(type) {
    const workerId = `${type}_${Date.now()}`;
    let worker;

    switch (type) {
      case 'searcher':
        worker = new SearcherWorker(workerId);
        break;
      case 'summarizer':
        worker = new SummarizerWorker(workerId);
        break;
      case 'infra':
        worker = new InfraWorker(workerId);
        break;
      case 'codegen':
        worker = new CodeGenWorker(workerId);
        break;
      case 'analyzer':
        worker = new AnalyzerWorker(workerId);
        break;
      case 'validator':
        worker = new ValidatorWorker(workerId);
        break;
      case 'planner':
        worker = new PlannerWorker(workerId);
        break;
      default:
        throw new Error(`Unknown worker type: ${type}. Valid: searcher, summarizer, infra, codegen, analyzer, validator, planner`);
    }

    await worker.connect();
    this.workers.set(worker.workerId, worker);
    
    // Start polling in background
    worker.startPolling().catch(err => 
      logger.error(`Worker ${workerId} polling error: ${err.message}`)
    );
    
    return worker;
  }

  async start(port = process.env.WORKER_PORT || 3001) {
    // Spawn one of each worker type
    const workerTypes = [
      'searcher',
      'summarizer', 
      'infra',
      'codegen',
      'analyzer',
      'validator',
      'planner'
    ];

    logger.info('🐦‍🔥 Starting Phoenix Worker Fleet...');

    for (const type of workerTypes) {
      try {
        const worker = await this.spawnWorker(type);
        logger.info(`   ✅ Spawned ${type}: ${worker.workerId}`);
      } catch (error) {
        logger.error(`   ❌ Failed to spawn ${type}: ${error.message}`);
      }
    }

    this.app.listen(port, () => {
      logger.info(`\n🔥 Phoenix Worker Manager running on port ${port}`);
      logger.info(`   Active workers: ${this.workers.size}`);
      logger.info(`   Task types handled: SEARCH, SUMMARIZE, PROVISION_INFRA, CODE_GENERATE, ANALYZE, VALIDATE, PLAN`);
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
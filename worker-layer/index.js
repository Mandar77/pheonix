// index.js
import 'dotenv/config';
import { WorkerManager } from './worker/WorkerManager.js';

const manager = new WorkerManager();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down...');
  await manager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down...');
  await manager.shutdown();
  process.exit(0);
});

// Start the worker manager
manager.start().catch(console.error);
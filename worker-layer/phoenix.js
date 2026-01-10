// phoenix.js - Main entry point for Phoenix Worker Layer
import 'dotenv/config';
import { PhoenixWorkerManager } from './worker/PhoenixWorkerManager.js';

console.log(`
🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥
    PROJECT PHOENIX - Worker Layer
    The Failure-Resilient Autonomous SRE
🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥🐦‍🔥
`);

const manager = new PhoenixWorkerManager();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, initiating graceful shutdown...');
  await manager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, initiating graceful shutdown...');
  await manager.shutdown();
  process.exit(0);
});

// Start the Phoenix worker fleet
manager.start().catch(err => {
  console.error('❌ Failed to start Phoenix:', err);
  process.exit(1);
});
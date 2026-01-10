import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 1. Setup path handling (Different in ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 2. Load .env from the root folder (one level up)
dotenv.config({ path: join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("❌ ERROR: MONGODB_URI is missing. Check your .env file!");
  process.exit(1);
}

const client = new MongoClient(uri);

async function startOrchestrator() {
  try {
    await client.connect();
    console.log("🧠 Orchestrator connected to Phoenix Core.");
    
    const db = client.db('phoenix');
    const tasksCollection = db.collection('tasks');

    console.log("🦅 Orchestrator is flying... (Press Ctrl+C to stop)");

    // The Infinite Loop
    while (true) {
      
      // --- MISSION 1: UNBLOCK TRAFFIC (Dependency Resolution) ---
      const blockedTasks = await tasksCollection.find({ status: 'BLOCKED' }).toArray();

      for (const task of blockedTasks) {
        // Look up parents
        const parents = await tasksCollection.find({ 
            _id: { $in: task.dependencies } 
        }).toArray();

        // Check if ALL parents are COMPLETED
        // (If dependencies array is empty, it shouldn't be blocked, so we default to true)
        const allParentsDone = parents.every(p => p.status === 'COMPLETED');

        if (allParentsDone) {
          await tasksCollection.updateOne(
            { _id: task._id },
            { $set: { status: 'PENDING', updated_at: new Date() } }
          );
          console.log(`🚦 UNBLOCKED Task: ${task._id} (Sent to workers)`);
        }
      }

      // --- MISSION 2: RESCUE ZOMBIES (Resilience) ---
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const zombies = await tasksCollection.find({
        status: 'IN_PROGRESS',
        locked_at: { $lt: fiveMinutesAgo }
      }).toArray();

      for (const zombie of zombies) {
        if (zombie.retry_count < (zombie.max_retries || 3)) {
          console.log(`🔥 ZOMBIE DETECTED: ${zombie._id}. Resurrecting...`);
          await tasksCollection.updateOne(
            { _id: zombie._id },
            { 
              $set: { 
                status: 'PENDING', 
                worker_lock: null, 
                locked_at: null 
              },
              $inc: { retry_count: 1 }
            }
          );
        } else {
           console.log(`💀 Task ${zombie._id} died permanently (Max retries).`);
           await tasksCollection.updateOne(
            { _id: zombie._id },
            { $set: { status: 'FAILED' } }
          );
        }
      }

      // Sleep for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    console.error("❌ Orchestrator Error:", error);
  }
}

startOrchestrator();
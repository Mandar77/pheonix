import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 1. Setup path handling (Required for ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 2. Load .env from the root worker-layer folder
dotenv.config({ path: join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ MONGODB_URI is missing from .env");
  process.exit(1);
}

const client = new MongoClient(uri);

async function createTest() {
  try {
    await client.connect();
    const db = client.db('phoenix');
    
    // --- 1. Create a Unique Workflow ID ---
    const wf_id = "test_wf_" + Date.now();
    console.log(`\n🧪 Creating Test Workflow: ${wf_id}`);

    // --- 2. Create the Parent Workflow Document ---
    await db.collection('workflows').insertOne({
        _id: wf_id,
        goal: "Find the best coffee in San Francisco",
        status: "PENDING",
        created_at: new Date()
    });

    // --- 3. Create Task A (The Trigger) ---
    // Status: PENDING (Workers will pick this up immediately)
    const taskA = {
      _id: `task_${wf_id}_A`,
      workflow_id: wf_id,
      type: "SEARCH",
      description: "Find high-rated coffee shops in SF",
      status: "PENDING",
      dependencies: [],
      retry_count: 0,
      input_context: { query: "best coffee shops in San Francisco 2024" },
      created_at: new Date()
    };

    // --- 4. Create Task B (The Dependent) ---
    // Status: BLOCKED (It waits for Task A. YOUR Orchestrator must unblock this.)
    const taskB = {
      _id: `task_${wf_id}_B`,
      workflow_id: wf_id,
      type: "SUMMARIZE",
      description: "Summarize the coffee reviews",
      status: "BLOCKED", 
      dependencies: [taskA._id], // <--- This link is what we are testing!
      retry_count: 0,
      input_context: {},
      created_at: new Date()
    };

    // Insert them into the DB
    await db.collection('tasks').insertMany([taskA, taskB]);

    console.log("✅ Tasks inserted successfully!");
    console.log(`   1. Task A (${taskA._id}) is PENDING. Workers should grab it.`);
    console.log(`   2. Task B (${taskB._id}) is BLOCKED. Orchestrator should unblock it after A finishes.`);
    console.log("\n👀 Watch your terminals now!");

  } catch (err) {
    console.error("❌ Error creating test:", err);
  } finally {
    await client.close();
  }
}

createTest();
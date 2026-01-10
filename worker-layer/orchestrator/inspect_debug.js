// inspect_debug.js
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const client = new MongoClient(process.env.MONGODB_URI);

async function debug() {
  await client.connect();
  const db = client.db('phoenix');

  // Find the PLAN task (the parent)
  const task = await db.collection('tasks').findOne({ 
    workflow_id: "complex_test_01", 
    type: "PLAN" 
  });

  if (task) {
    console.log("🔍 PARENT TASK DEBUG INFO:");
    console.log("------------------------------------------");
    console.log("ID:", task._id);
    console.log("Status:", task.status); // Should be COMPLETED
    console.log("\n📦 OUTPUT ARTIFACT (What the AI returned):");
    console.log(JSON.stringify(task.output_artifact, null, 2)); 
  } else {
    console.log("❌ Could not find the task. Did you clean the DB?");
  }

  await client.close();
}

debug();
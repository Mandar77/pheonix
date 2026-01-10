import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const client = new MongoClient(process.env.MONGODB_URI);

async function inspect() {
  try {
    await client.connect();
    const db = client.db('phoenix');
    
    // 1. Get all tasks for the demo
    const tasks = await db.collection('tasks')
      .find({ workflow_id: "hackathon_demo_01" }) // matches your curl command
      .toArray();

    console.log(`\n🔍 FOUND ${tasks.length} TASKS FOR 'hackathon_demo_01':`);
    console.log("---------------------------------------------------");
    
    tasks.forEach(t => {
      console.log(`[${t.type}] ID: ${t._id}`);
      console.log(`    Status: ${t.status}`);
      console.log(`    Deps:   ${JSON.stringify(t.dependencies)}`);
      console.log("---------------------------------------------------");
    });

  } catch (e) { console.error(e); } 
  finally { await client.close(); }
}

inspect();
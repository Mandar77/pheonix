// verify_plan.js
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const client = new MongoClient(process.env.MONGODB_URI);

async function verify() {
  try {
    await client.connect();
    const db = client.db('phoenix');
    
    // FETCH TASKS
    const tasks = await db.collection('tasks')
      .find({ workflow_id: "complex_test_01" })
      .toArray();

    console.log(`\n🧠 PLAN REPORT for 'complex_test_01'`);
    console.log(`Found ${tasks.length} tasks.`);
    console.log("---------------------------------------------------");

    tasks.sort((a, b) => a.created_at - b.created_at);

    tasks.forEach(t => {
      // Show dependencies
      const deps = t.dependencies.map(d => d.replace("complex_test_01_", ""));
      
      if (deps.length > 0) {
        console.log(`[${t.type}] ${t._id.split('_').pop()}`);
        console.log(`   └─ 🔒 BLOCKED BY: [ ${deps.join(', ')} ]`);
        console.log(`      (✅ AI created a dependency!)`);
      } else {
        console.log(`[${t.type}] ${t._id.split('_').pop()}`);
        console.log(`   └─ 🚀 Starts Immediately`);
      }
      console.log("");
    });

  } catch (e) { console.error(e); } 
  finally { await client.close(); }
}

verify();
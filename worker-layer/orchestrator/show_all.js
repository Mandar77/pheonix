import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const client = new MongoClient(process.env.MONGODB_URI);

async function showAll() {
  try {
    await client.connect();
    const db = client.db('phoenix');
    
    // Get ALL tasks, sorted by time
    const tasks = await db.collection('tasks').find({}).sort({ created_at: -1 }).toArray();

    console.log(`\n🌎 DATABASE DUMP (${tasks.length} Total Tasks)`);
    console.log("===================================================");

    if (tasks.length === 0) {
      console.log("❌ Database is EMPTY. (Did the Planner crash?)");
    }

    // Group by Workflow ID
    const grouped = {};
    tasks.forEach(t => {
      if (!grouped[t.workflow_id]) grouped[t.workflow_id] = [];
      grouped[t.workflow_id].push(t);
    });

    for (const [wfId, group] of Object.entries(grouped)) {
      console.log(`\n📂 WORKFLOW: ${wfId}`);
      
      // Sort tasks to make DAG readable
      group.sort((a, b) => a.created_at - b.created_at);

      group.forEach(t => {
        const shortId = t._id.replace(`${wfId}_`, "");
        const deps = t.dependencies.map(d => d.replace(`${wfId}_`, ""));
        
        let statusIcon = "⚪";
        if (t.status === 'COMPLETED') statusIcon = "🟢";
        if (t.status === 'IN_PROGRESS') statusIcon = "🔵";
        if (t.status === 'BLOCKED') statusIcon = "🔴";
        if (t.status === 'PENDING') statusIcon = "🟡";

        console.log(`  ${statusIcon} [${t.type}] ${shortId}`);
        if (deps.length > 0) {
          console.log(`      └─ 🔒 BLOCKED BY: [ ${deps.join(', ')} ]`);
        }
      });
    }

  } catch (e) { console.error(e); } 
  finally { await client.close(); }
}

showAll();
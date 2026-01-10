// create_workflow.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function createDemoWorkflow() {
  try {
    await client.connect();
    const db = client.db('phoenix');
    
    // 1. Define the Workflow ID
    const wf_id = "wf_demo_" + Date.now();
    console.log(`📝 Creating Workflow: ${wf_id}`);

    // 2. Insert the Workflow Parent
    await db.collection('workflows').insertOne({
      _id: wf_id,
      goal: "Research and Deploy a Web Server",
      status: "PENDING",
      created_at: new Date()
    });

    // 3. Create the Tasks (The DAG)
    // Task A: Search for info (Starts immediately)
    const taskA = {
      _id: `task_${wf_id}_A`,
      workflow_id: wf_id,
      type: "SEARCH",
      description: "Find best practices for Node.js deployment",
      status: "PENDING", // Ready to go!
      dependencies: [],
      retry_count: 0,
      input_context: { query: "Node.js deployment guide" }
    };

    // Task B: Summarize the search (Waits for A)
    const taskB = {
      _id: `task_${wf_id}_B`,
      workflow_id: wf_id,
      type: "SUMMARIZE",
      description: "Summarize deployment steps",
      status: "BLOCKED", // Wait for A
      dependencies: [taskA._id],
      retry_count: 0,
      input_context: {}
    };

    // Task C: Generate Code (Waits for B)
    const taskC = {
      _id: `task_${wf_id}_C`,
      workflow_id: wf_id,
      type: "CODE_GENERATE",
      description: "Write the deployment script",
      status: "BLOCKED", // Wait for B
      dependencies: [taskB._id],
      retry_count: 0,
      input_context: { language: "bash" }
    };

    await db.collection('tasks').insertMany([taskA, taskB, taskC]);
    console.log("✅ Workflow Created! Start the Orchestrator to run it.");

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

createDemoWorkflow();
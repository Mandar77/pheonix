// tests/phoenix.test.js
// End-to-end test for Project Phoenix workflow execution
import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPhoenixWorkflow() {
  console.log('🐦‍🔥 Phoenix Workflow Test\n');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('phoenix');

  const workflowId = 'wf_demo_001';

  try {
    // Check initial state
    console.log('📊 Initial State:');
    let tasks = await db.collection('tasks')
      .find({ workflow_id: workflowId })
      .sort({ _id: 1 })
      .toArray();

    tasks.forEach(t => console.log(`   ${t._id}: ${t.status} (${t.type})`));

    // Watch workflow execution
    console.log('\n⏳ Watching workflow execution...');
    console.log('   (Workers will process PENDING tasks and unlock BLOCKED tasks)\n');

    let allCompleted = false;
    let iterations = 0;
    const maxIterations = 120; // 2 minutes max

    while (!allCompleted && iterations < maxIterations) {
      tasks = await db.collection('tasks')
        .find({ workflow_id: workflowId })
        .sort({ _id: 1 })
        .toArray();

      // Print status
      process.stdout.write('\r   ');
      tasks.forEach(t => {
        const icon = {
          'PENDING': '🟡',
          'IN_PROGRESS': '🔵',
          'COMPLETED': '✅',
          'BLOCKED': '⬜',
          'FAILED': '❌'
        }[t.status] || '❓';
        process.stdout.write(`${icon} `);
      });

      // Check if all completed or failed
      const completed = tasks.filter(t => t.status === 'COMPLETED').length;
      const failed = tasks.filter(t => t.status === 'FAILED').length;
      
      process.stdout.write(` (${completed}/${tasks.length} done)`);

      if (completed + failed === tasks.length) {
        allCompleted = true;
      }

      iterations++;
      await sleep(1000);
    }

    console.log('\n');

    // Final state
    console.log('📊 Final State:');
    tasks = await db.collection('tasks')
      .find({ workflow_id: workflowId })
      .sort({ _id: 1 })
      .toArray();

    tasks.forEach(t => {
      const icon = t.status === 'COMPLETED' ? '✅' : t.status === 'FAILED' ? '❌' : '⬜';
      console.log(`   ${icon} ${t._id}: ${t.status} (${t.type})`);
      if (t.output_artifact) {
        console.log(`      └─ Output: ${JSON.stringify(t.output_artifact).substring(0, 80)}...`);
      }
    });

    // Check logs
    console.log('\n📜 Recent Logs:');
    const logs = await db.collection('logs')
      .find({ workflow_id: workflowId })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    logs.reverse().forEach(l => {
      const icon = l.level === 'ERROR' ? '❌' : l.level === 'WARN' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} [${l.component}] ${l.message}`);
    });

    // Summary
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const failed = tasks.filter(t => t.status === 'FAILED').length;
    
    console.log('\n========================================');
    if (completed === tasks.length) {
      console.log('🎉 WORKFLOW COMPLETED SUCCESSFULLY!');
    } else if (failed > 0) {
      console.log(`⚠️ Workflow has ${failed} failed tasks`);
    } else {
      console.log('⏳ Workflow still in progress...');
    }
    console.log(`   Completed: ${completed}/${tasks.length}`);
    console.log('========================================');

  } finally {
    await client.close();
  }
}

// Test recovery by simulating stuck task
async function testRecovery() {
  console.log('\n🔄 Testing Recovery (Simulating Stuck Task)\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('phoenix');

  // Create a task that appears stuck
  const stuckTaskId = `stuck_task_${Date.now()}`;
  await db.collection('tasks').insertOne({
    _id: stuckTaskId,
    workflow_id: 'wf_recovery_test',
    type: 'SEARCH',
    description: 'Task that will be simulated as stuck',
    status: 'IN_PROGRESS',
    dependencies: [],
    retry_count: 0,
    max_retries: 3,
    worker_lock: 'dead_worker_xyz',
    locked_at: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago (> 5 min timeout)
    input_context: { query: 'test' },
    output_artifact: null,
    created_at: new Date()
  });

  console.log(`   Created stuck task: ${stuckTaskId}`);
  console.log('   Lock time: 6 minutes ago (should be recovered by orchestrator)');
  console.log('   ℹ️ The orchestrator should detect this and reset it to PENDING');

  await client.close();
}

// Run tests
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--recovery')) {
    await testRecovery();
  } else {
    await testPhoenixWorkflow();
  }
}

main().catch(console.error);
// orchestrator/simpleLoop.js
// Simple orchestrator loop for demo - Aarzoo should replace this
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function orchestratorLoop() {
  console.log('🧠 Phoenix Orchestrator Loop Starting...\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('phoenix');

  let iteration = 0;

  while (true) {
    try {
      iteration++;
      
      // =============================================
      // STEP 1: Dependency Resolution (Spec 5.1)
      // Find BLOCKED tasks and check if deps are done
      // =============================================
      const blockedTasks = await db.collection('tasks')
        .find({ status: 'BLOCKED' })
        .toArray();

      for (const task of blockedTasks) {
        if (!task.dependencies || task.dependencies.length === 0) {
          // No dependencies, unblock immediately
          await db.collection('tasks').updateOne(
            { _id: task._id },
            { $set: { status: 'PENDING' } }
          );
          console.log(`   ✅ Unblocked ${task._id} (no dependencies)`);
          continue;
        }

        // Check if all dependencies are COMPLETED
        const deps = await db.collection('tasks')
          .find({ _id: { $in: task.dependencies } })
          .toArray();

        const allDepsCompleted = deps.every(d => d.status === 'COMPLETED');
        const anyDepFailed = deps.some(d => d.status === 'FAILED');

        if (allDepsCompleted) {
          // Collect output artifacts from dependencies as input context
          const depOutputs = {};
          deps.forEach(d => {
            if (d.output_artifact) {
              depOutputs[d._id] = d.output_artifact;
            }
          });

          await db.collection('tasks').updateOne(
            { _id: task._id },
            { 
              $set: { 
                status: 'PENDING',
                'input_context.dependency_outputs': depOutputs
              } 
            }
          );
          console.log(`   ✅ Unblocked ${task._id} (all ${deps.length} deps completed)`);
        } else if (anyDepFailed) {
          // Dependency failed, mark this as failed too
          await db.collection('tasks').updateOne(
            { _id: task._id },
            { $set: { status: 'FAILED', last_error: 'Dependency failed' } }
          );
          console.log(`   ❌ Failed ${task._id} (dependency failed)`);
        }
      }

      // =============================================
      // STEP 2: Lock Timeout Recovery (Spec 5.3)
      // Find IN_PROGRESS tasks locked > 5 minutes
      // =============================================
      const stuckThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);
      
      const stuckTasks = await db.collection('tasks')
        .find({
          status: 'IN_PROGRESS',
          locked_at: { $lt: stuckThreshold }
        })
        .toArray();

      for (const task of stuckTasks) {
        const newRetryCount = (task.retry_count || 0) + 1;
        const maxRetries = task.max_retries || 3;

        if (newRetryCount <= maxRetries) {
          // Reset to PENDING for retry
          await db.collection('tasks').updateOne(
            { _id: task._id },
            {
              $set: {
                status: 'PENDING',
                worker_lock: null,
                locked_at: null,
                retry_count: newRetryCount
              }
            }
          );
          console.log(`   🔄 Recovered stuck task ${task._id} (retry ${newRetryCount}/${maxRetries})`);
        } else {
          // Max retries exceeded
          await db.collection('tasks').updateOne(
            { _id: task._id },
            {
              $set: {
                status: 'FAILED',
                worker_lock: null,
                locked_at: null,
                last_error: 'Lock timeout after max retries'
              }
            }
          );
          console.log(`   ❌ Failed ${task._id} after ${maxRetries} retries`);
        }
      }

      // =============================================
      // STEP 3: Update Workflow Status
      // =============================================
      const workflows = await db.collection('workflows')
        .find({ status: { $in: ['PENDING', 'RUNNING'] } })
        .toArray();

      for (const wf of workflows) {
        const tasks = await db.collection('tasks')
          .find({ workflow_id: wf._id })
          .toArray();

        if (tasks.length === 0) continue;

        const allCompleted = tasks.every(t => t.status === 'COMPLETED');
        const anyFailed = tasks.some(t => t.status === 'FAILED');
        const anyInProgress = tasks.some(t => 
          t.status === 'IN_PROGRESS' || t.status === 'PENDING'
        );

        let newStatus = wf.status;
        if (allCompleted) {
          newStatus = 'COMPLETED';
        } else if (anyFailed && !anyInProgress) {
          newStatus = 'FAILED';
        } else if (anyInProgress) {
          newStatus = 'RUNNING';
        }

        if (newStatus !== wf.status) {
          await db.collection('workflows').updateOne(
            { _id: wf._id },
            { $set: { status: newStatus } }
          );
          console.log(`   📊 Workflow ${wf._id}: ${wf.status} → ${newStatus}`);
        }
      }

      // Status summary every 10 iterations
      if (iteration % 10 === 0) {
        const summary = await db.collection('tasks').aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]).toArray();
        
        const counts = {};
        summary.forEach(s => counts[s._id] = s.count);
        
        console.log(`\n   📈 [Iteration ${iteration}] Tasks: ` +
          `✅${counts.COMPLETED || 0} ` +
          `🔵${counts.IN_PROGRESS || 0} ` +
          `🟡${counts.PENDING || 0} ` +
          `⬜${counts.BLOCKED || 0} ` +
          `❌${counts.FAILED || 0}\n`);
      }

      await sleep(1000); // Poll every second

    } catch (error) {
      console.error('❌ Orchestrator error:', error.message);
      await sleep(5000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

orchestratorLoop().catch(console.error);
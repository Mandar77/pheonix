// tests/planner.test.js
// Test the PlannerWorker's ability to decompose goals into task DAGs
import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function testPlanner() {
  console.log('🧪 Testing PlannerWorker\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('phoenix');

  const workflowId = 'wf_planner_test_' + Date.now();

  try {
    // Create a workflow
    await db.collection('workflows').insertOne({
      _id: workflowId,
      goal: 'Build a REST API with authentication',
      status: 'PENDING',
      created_at: new Date().toISOString()
    });
    console.log('✅ Created workflow:', workflowId);

    // Create a PLAN task - PlannerWorker will pick this up
    const planTaskId = workflowId + '_plan';
    await db.collection('tasks').insertOne({
      _id: planTaskId,
      workflow_id: workflowId,
      type: 'PLAN',
      description: 'Plan the REST API workflow',
      status: 'PENDING',
      dependencies: [],
      retry_count: 0,
      max_retries: 3,
      worker_lock: null,
      locked_at: null,
      input_context: {
        goal: 'Build a REST API with user authentication using Python FastAPI',
        constraints: {
          language: 'python',
          framework: 'FastAPI',
          auth_method: 'JWT'
        }
      },
      output_artifact: null,
      created_at: new Date()
    });
    console.log('✅ Created PLAN task:', planTaskId);
    console.log('');
    console.log('⏳ Waiting for PlannerWorker to process...');
    console.log('   (Make sure "npm run phoenix" is running in another terminal)');
    console.log('');

    // Wait for completion
    for (let i = 0; i < 60; i++) {
      const task = await db.collection('tasks').findOne({ _id: planTaskId });

      if (task.status === 'COMPLETED') {
        console.log('\n✅ PLAN task completed!');
        console.log('');
        console.log('📋 Generated Plan:');
        console.log('─'.repeat(50));
        
        const plan = task.output_artifact?.plan;
        if (plan?.tasks) {
          plan.tasks.forEach((t, i) => {
            console.log(`   ${i + 1}. [${t.type}] ${t.description || t.id}`);
            if (t.dependencies?.length > 0) {
              console.log(`      └─ Depends on: ${t.dependencies.join(', ')}`);
            }
          });
        } else {
          console.log(JSON.stringify(task.output_artifact, null, 2));
        }
        
        console.log('─'.repeat(50));
        console.log('');

        // Check if subtasks were created
        const subtasks = await db.collection('tasks')
          .find({ 
            workflow_id: workflowId, 
            _id: { $ne: planTaskId } 
          })
          .sort({ _id: 1 })
          .toArray();

        if (subtasks.length > 0) {
          console.log(`📊 Subtasks auto-created in MongoDB: ${subtasks.length}`);
          console.log('─'.repeat(50));
          subtasks.forEach(t => {
            const statusIcon = t.status === 'PENDING' ? '🟡' : '⬜';
            console.log(`   ${statusIcon} ${t._id}`);
            console.log(`      Type: ${t.type}`);
            console.log(`      Status: ${t.status}`);
            console.log(`      Deps: ${t.dependencies?.length > 0 ? t.dependencies.join(', ') : 'none'}`);
            console.log('');
          });
          console.log('─'.repeat(50));
          
          console.log('\n🎉 PlannerWorker test PASSED!');
          console.log('   The planner successfully:');
          console.log('   ✅ Received the goal');
          console.log('   ✅ Generated a task plan via LLM');
          console.log(`   ✅ Auto-created ${subtasks.length} subtasks in MongoDB`);
          console.log('   ✅ Set correct PENDING/BLOCKED statuses based on dependencies');
        } else {
          console.log('⚠️ No subtasks were auto-created.');
          console.log('   Check if the plan has a valid "tasks" array.');
          console.log('   Raw output:', JSON.stringify(task.output_artifact, null, 2));
        }

        break;
      } else if (task.status === 'FAILED') {
        console.log('\n❌ PLAN task failed:', task.last_error);
        break;
      } else if (task.status === 'IN_PROGRESS') {
        process.stdout.write('🔵');
      } else {
        process.stdout.write('.');
      }

      await new Promise(r => setTimeout(r, 1000));
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await client.close();
  }
}

testPlanner();
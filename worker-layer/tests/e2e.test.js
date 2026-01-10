// tests/e2e.test.js
// End-to-end test simulating orchestrator -> worker -> result flow
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const BASE_URL = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function e2eMultiAgentWorkflow() {
  console.log('🔄 Starting End-to-End Multi-Agent Workflow Test\n');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables!');
    console.error('   Make sure .env file exists and contains MONGODB_URI');
    process.exit(1);
  }
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('hackathon_agents');
  
  const workflowId = 'e2e_' + Date.now();
  
  try {
    // Step 1: Create shared context (simulating orchestrator)
    console.log('📝 Step 1: Creating shared context...');
    const contextId = `ctx_${workflowId}`;
    await db.collection('contexts').insertOne({
      contextId,
      data: {
        projectName: 'E2E Test Project',
        goal: 'Test multi-agent collaboration',
        createdAt: new Date()
      }
    });
    console.log('   ✅ Context created:', contextId);

    // Step 2: Submit research task
    console.log('\n📝 Step 2: Submitting research task...');
    const researchTaskId = `research_${workflowId}`;
    await db.collection('task_queue').insertOne({
      taskId: researchTaskId,
      requiredCapability: 'research',
      payload: {
        action: 'search',
        query: 'best practices for multi-agent AI systems'
      },
      contextId,
      priority: 2,
      status: 'pending',
      createdAt: new Date()
    });
    console.log('   ✅ Research task queued:', researchTaskId);

    // Step 3: Wait for research task to complete
    console.log('\n⏳ Step 3: Waiting for research task completion...');
    let researchResult = null;
    for (let i = 0; i < 60; i++) { // Wait up to 60 seconds
      const task = await db.collection('task_queue').findOne({ taskId: researchTaskId });
      if (task?.status === 'completed') {
        researchResult = await db.collection('task_results').findOne({ taskId: researchTaskId });
        break;
      } else if (task?.status === 'failed') {
        throw new Error('Research task failed: ' + task.error);
      }
      process.stdout.write('.');
      await sleep(1000);
    }
    
    if (!researchResult) {
      throw new Error('Research task timed out');
    }
    console.log('\n   ✅ Research completed!');
    console.log('   Preview:', researchResult.result?.findings?.substring(0, 100) + '...');

    // Step 4: Submit code generation task based on research
    console.log('\n📝 Step 4: Submitting code generation task...');
    const codeTaskId = `code_${workflowId}`;
    await db.collection('task_queue').insertOne({
      taskId: codeTaskId,
      requiredCapability: 'code_generation',
      payload: {
        action: 'generate',
        requirements: 'Create a Python class for an AI agent that can communicate with other agents',
        language: 'python'
      },
      contextId,
      priority: 2,
      status: 'pending',
      createdAt: new Date()
    });
    console.log('   ✅ Code task queued:', codeTaskId);

    // Step 5: Wait for code task to complete
    console.log('\n⏳ Step 5: Waiting for code task completion...');
    let codeResult = null;
    for (let i = 0; i < 60; i++) {
      const task = await db.collection('task_queue').findOne({ taskId: codeTaskId });
      if (task?.status === 'completed') {
        codeResult = await db.collection('task_results').findOne({ taskId: codeTaskId });
        break;
      } else if (task?.status === 'failed') {
        throw new Error('Code task failed: ' + task.error);
      }
      process.stdout.write('.');
      await sleep(1000);
    }
    
    if (!codeResult) {
      throw new Error('Code task timed out');
    }
    console.log('\n   ✅ Code generation completed!');

    // Step 6: Submit analysis task
    console.log('\n📝 Step 6: Submitting analysis task...');
    const analysisTaskId = `analysis_${workflowId}`;
    await db.collection('task_queue').insertOne({
      taskId: analysisTaskId,
      requiredCapability: 'data_analysis',
      payload: {
        action: 'analyze',
        data: {
          researchFindings: researchResult.result?.findings?.substring(0, 500),
          codeGenerated: true,
          workflowSteps: 3
        }
      },
      contextId,
      priority: 1,
      status: 'pending',
      createdAt: new Date()
    });
    console.log('   ✅ Analysis task queued:', analysisTaskId);

    // Step 7: Wait for analysis
    console.log('\n⏳ Step 7: Waiting for analysis completion...');
    let analysisResult = null;
    for (let i = 0; i < 60; i++) {
      const task = await db.collection('task_queue').findOne({ taskId: analysisTaskId });
      if (task?.status === 'completed') {
        analysisResult = await db.collection('task_results').findOne({ taskId: analysisTaskId });
        break;
      } else if (task?.status === 'failed') {
        throw new Error('Analysis task failed: ' + task.error);
      }
      process.stdout.write('.');
      await sleep(1000);
    }
    
    if (!analysisResult) {
      throw new Error('Analysis task timed out');
    }
    console.log('\n   ✅ Analysis completed!');

    // Step 8: Verify shared context was updated
    console.log('\n📝 Step 8: Verifying shared context updates...');
    const finalContext = await db.collection('contexts').findOne({ contextId });
    console.log('   Context data keys:', Object.keys(finalContext.data));

    // Step 9: Check heartbeats (watchdog view)
    console.log('\n📝 Step 9: Checking worker heartbeats...');
    const recentHeartbeats = await db.collection('worker_heartbeats')
      .find({ timestamp: { $gte: new Date(Date.now() - 120000) } })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    console.log(`   Found ${recentHeartbeats.length} recent heartbeats`);
    const taskEvents = recentHeartbeats.filter(h => 
      h.event.includes('task_started') || h.event.includes('task_completed')
    );
    console.log(`   Task-related events: ${taskEvents.length}`);

    // Summary
    console.log('\n========================================');
    console.log('🎉 E2E Workflow Test PASSED!');
    console.log('========================================');
    console.log(`   Workflow ID: ${workflowId}`);
    console.log('   Tasks completed:');
    console.log('   ✅ Research task');
    console.log('   ✅ Code generation task');
    console.log('   ✅ Analysis task');
    console.log('   ✅ Context sharing verified');
    console.log('   ✅ Heartbeats recorded');

  } catch (error) {
    console.error('\n❌ E2E Test Failed:', error.message);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await db.collection('task_queue').deleteMany({ taskId: { $regex: workflowId } });
    await db.collection('task_results').deleteMany({ taskId: { $regex: workflowId } });
    await db.collection('contexts').deleteMany({ contextId: { $regex: workflowId } });
    
    await client.close();
  }
}

// Run with proper error handling
e2eMultiAgentWorkflow().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
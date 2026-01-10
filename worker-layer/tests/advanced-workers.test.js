// tests/advanced-workers.test.js
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const BASE_URL = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitAndWait(db, taskId, capability, payload, timeout = 60000) {
  // Submit task
  await db.collection('task_queue').insertOne({
    taskId,
    requiredCapability: capability,
    payload,
    status: 'pending',
    priority: 1,
    createdAt: new Date()
  });

  // Wait for completion
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const task = await db.collection('task_queue').findOne({ taskId });
    if (task?.status === 'completed') {
      const result = await db.collection('task_results').findOne({ taskId });
      return { success: true, result: result?.result };
    }
    if (task?.status === 'failed') {
      return { success: false, error: task.error };
    }
    await sleep(1000);
  }
  return { success: false, error: 'Timeout' };
}

async function testPlannerWorker(db) {
  console.log('\n=== Test: Planner Worker ===');
  
  const taskId = `planner_test_${Date.now()}`;
  const result = await submitAndWait(db, taskId, 'planning', {
    action: 'decompose',
    goal: 'Build a web scraper that collects news articles and summarizes them',
    availableAgents: ['research', 'code_generation', 'web_scraping', 'summarization']
  });

  if (result.success) {
    console.log('✅ Planner worker test passed');
    console.log('   Subtasks planned:', result.result?.plan?.subtasks?.length || 'N/A');
  } else {
    console.log('❌ Planner worker test failed:', result.error);
  }
  return result.success;
}

async function testSynthesisWorker(db) {
  console.log('\n=== Test: Synthesis Worker ===');
  
  const taskId = `synthesis_test_${Date.now()}`;
  const result = await submitAndWait(db, taskId, 'synthesis', {
    action: 'combine',
    results: [
      { agent: 'research', finding: 'AI market growing 40% annually' },
      { agent: 'analysis', finding: 'Key players: OpenAI, Google, Anthropic' },
      { agent: 'code', finding: 'Python most popular for AI development' }
    ]
  });

  if (result.success) {
    console.log('✅ Synthesis worker test passed');
  } else {
    console.log('❌ Synthesis worker test failed:', result.error);
  }
  return result.success;
}

async function testMemoryWorker(db) {
  console.log('\n=== Test: Memory Worker ===');
  
  // Store memory
  const storeTaskId = `memory_store_${Date.now()}`;
  const storeResult = await submitAndWait(db, storeTaskId, 'memory_store', {
    action: 'store',
    key: 'test_memory_key',
    value: { important: 'data', number: 42 },
    tags: ['test', 'hackathon']
  });

  if (!storeResult.success) {
    console.log('❌ Memory store test failed:', storeResult.error);
    return false;
  }

  // Retrieve memory
  const retrieveTaskId = `memory_retrieve_${Date.now()}`;
  const retrieveResult = await submitAndWait(db, retrieveTaskId, 'memory_retrieve', {
    action: 'retrieve',
    key: 'test_memory_key'
  });

  if (retrieveResult.success && retrieveResult.result?.found) {
    console.log('✅ Memory worker test passed');
    console.log('   Stored and retrieved:', retrieveResult.result?.value);
  } else {
    console.log('❌ Memory retrieve test failed');
  }
  return retrieveResult.success;
}

async function testValidatorWorker(db) {
  console.log('\n=== Test: Validator Worker ===');
  
  const taskId = `validator_test_${Date.now()}`;
  const result = await submitAndWait(db, taskId, 'validation', {
    action: 'validate',
    output: {
      name: 'Test Project',
      status: 'complete',
      results: [1, 2, 3]
    },
    rules: ['must have name', 'must have status', 'results must be array']
  });

  if (result.success) {
    console.log('✅ Validator worker test passed');
    console.log('   Validation score:', result.result?.result?.score || 'N/A');
  } else {
    console.log('❌ Validator worker test failed:', result.error);
  }
  return result.success;
}

async function testWebScraperWorker(db) {
  console.log('\n=== Test: Web Scraper Worker ===');
  
  const taskId = `scraper_test_${Date.now()}`;
  const result = await submitAndWait(db, taskId, 'web_scraping', {
    action: 'fetch',
    url: 'https://example.com'
  });

  if (result.success) {
    console.log('✅ Web scraper worker test passed');
    console.log('   Fetched title:', result.result?.content?.title || 'N/A');
  } else {
    console.log('❌ Web scraper worker test failed:', result.error);
  }
  return result.success;
}

async function testMultiAgentWorkflow(db) {
  console.log('\n=== Test: Multi-Agent Workflow (Planner → Workers → Synthesis) ===');
  
  const workflowId = `workflow_${Date.now()}`;
  
  // Step 1: Plan the task
  console.log('   Step 1: Planning task decomposition...');
  const planResult = await submitAndWait(db, `${workflowId}_plan`, 'planning', {
    action: 'decompose',
    goal: 'Research and summarize the benefits of multi-agent AI systems',
    autoQueue: false
  });

  if (!planResult.success) {
    console.log('❌ Planning failed');
    return false;
  }
  console.log('   ✅ Plan created');

  // Step 2: Execute research
  console.log('   Step 2: Executing research...');
  const researchResult = await submitAndWait(db, `${workflowId}_research`, 'research', {
    action: 'search',
    query: 'benefits of multi-agent AI systems collaboration'
  });

  if (!researchResult.success) {
    console.log('❌ Research failed');
    return false;
  }
  console.log('   ✅ Research completed');

  // Step 3: Synthesize results
  console.log('   Step 3: Synthesizing results...');
  const synthesisResult = await submitAndWait(db, `${workflowId}_synthesis`, 'synthesis', {
    action: 'generate_report',
    title: 'Multi-Agent AI Systems Benefits',
    data: {
      plan: planResult.result?.plan,
      research: researchResult.result?.findings
    },
    format: 'markdown'
  });

  if (!synthesisResult.success) {
    console.log('❌ Synthesis failed');
    return false;
  }
  console.log('   ✅ Report generated');

  // Step 4: Validate output
  console.log('   Step 4: Validating output...');
  const validateResult = await submitAndWait(db, `${workflowId}_validate`, 'validation', {
    action: 'score_quality',
    content: synthesisResult.result?.report,
    criteria: ['completeness', 'clarity', 'actionability']
  });

  if (validateResult.success) {
    console.log('   ✅ Validation complete');
    console.log('\n✅ Multi-Agent Workflow Test PASSED!');
    return true;
  }
  
  return false;
}

async function runAllAdvancedTests() {
  console.log('🧪 Starting Advanced Worker Tests...\n');
  console.log('⚠️  Make sure worker manager is running: npm start\n');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('hackathon_agents');

    // Test individual workers
    await testPlannerWorker(db);
    await testSynthesisWorker(db);
    await testMemoryWorker(db);
    await testValidatorWorker(db);
    await testWebScraperWorker(db);
    
    // Test multi-agent workflow
    await testMultiAgentWorkflow(db);

    console.log('\n========================================');
    console.log('🎉 Advanced Worker Tests Complete!');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await client.close();
  }
}

runAllAdvancedTests().catch(console.error);
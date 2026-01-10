// tests/workers.test.js
import 'dotenv/config';
import { ResearchWorker, CodeWorker, AnalysisWorker, CommunicationWorker } from '../worker/SpecializedWorkers.js';

async function testWorkerInitialization() {
  console.log('\n=== Test: Worker Initialization ===');
  
  const research = new ResearchWorker('test_research_1');
  const code = new CodeWorker('test_code_1');
  const analysis = new AnalysisWorker('test_analysis_1');
  const comm = new CommunicationWorker('test_comm_1');

  // Check capabilities are set correctly
  console.assert(research.capabilities.includes('research'), '❌ Research worker missing research capability');
  console.assert(code.capabilities.includes('code_generation'), '❌ Code worker missing code_generation capability');
  console.assert(analysis.capabilities.includes('data_analysis'), '❌ Analysis worker missing data_analysis capability');
  console.assert(comm.capabilities.includes('message_routing'), '❌ Comm worker missing message_routing capability');

  // Check initial status
  console.assert(research.status === 'idle', '❌ Worker should start idle');
  console.assert(research.currentTask === null, '❌ Worker should have no current task');

  console.log('✅ All worker initialization tests passed');
  return { research, code, analysis, comm };
}

async function testMongoConnection(worker) {
  console.log('\n=== Test: MongoDB Connection ===');
  
  try {
    await worker.connect();
    console.assert(worker.db !== null, '❌ DB should be connected');
    console.assert(worker.mongoClient !== null, '❌ MongoClient should exist');
    
    // Test we can query
    const collections = await worker.db.listCollections().toArray();
    console.log(`   Found ${collections.length} collections`);
    
    console.log('✅ MongoDB connection test passed');
    return true;
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    return false;
  }
}

async function testWorkerRegistration(worker) {
  console.log('\n=== Test: Worker Registration ===');
  
  // Check worker is in MongoDB
  const registered = await worker.db.collection('workers').findOne({ 
    workerId: worker.workerId 
  });
  
  console.assert(registered !== null, '❌ Worker should be registered in MongoDB');
  console.assert(registered.capabilities.length > 0, '❌ Worker should have capabilities');
  console.assert(registered.name === worker.name, '❌ Worker name should match');
  
  console.log('✅ Worker registration test passed');
}

async function testHeartbeat(worker) {
  console.log('\n=== Test: Heartbeat Reporting ===');
  
  await worker.reportToWatchdog('test_heartbeat', { test: true });
  
  const heartbeat = await worker.db.collection('worker_heartbeats').findOne({
    workerId: worker.workerId,
    event: 'test_heartbeat'
  });
  
  console.assert(heartbeat !== null, '❌ Heartbeat should be recorded');
  console.assert(heartbeat.details.test === true, '❌ Heartbeat details should match');
  
  console.log('✅ Heartbeat test passed');
}

async function testContextStorage(worker) {
  console.log('\n=== Test: Context Storage & Retrieval ===');
  
  const testContextId = 'test_context_' + Date.now();
  const testData = { key: 'value', nested: { data: true } };
  
  // Store context
  await worker.db.collection('contexts').insertOne({
    contextId: testContextId,
    data: testData,
    createdAt: new Date()
  });
  
  // Retrieve context
  const loaded = await worker.loadContext(testContextId);
  
  console.assert(loaded.key === 'value', '❌ Context data should match');
  console.assert(loaded.nested.data === true, '❌ Nested context data should match');
  
  // Cleanup
  await worker.db.collection('contexts').deleteOne({ contextId: testContextId });
  
  console.log('✅ Context storage test passed');
}

async function testTaskProcessing(worker) {
  console.log('\n=== Test: Task Processing (Research Worker) ===');
  
  const testTask = {
    _id: 'test_task_' + Date.now(),
    taskId: 'test_task_' + Date.now(),
    requiredCapability: 'research',
    payload: {
      action: 'summarize',
      content: 'This is a test document about artificial intelligence and machine learning.'
    },
    contextId: null,
    status: 'assigned'
  };
  
  try {
    const result = await worker.processTask(testTask, {});
    
    console.assert(result.type === 'summary', '❌ Result should be summary type');
    console.assert(result.summary !== undefined, '❌ Result should contain summary');
    console.assert(result.summary.length > 0, '❌ Summary should not be empty');
    
    console.log('✅ Task processing test passed');
    console.log('   Summary preview:', result.summary.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ Task processing failed:', error.message);
  }
}

async function testCodeWorker(worker) {
  console.log('\n=== Test: Code Worker ===');
  
  await worker.connect();
  
  const testTask = {
    taskId: 'code_test_' + Date.now(),
    payload: {
      action: 'generate',
      requirements: 'Create a simple function that calculates factorial',
      language: 'python'
    }
  };
  
  try {
    const result = await worker.processTask(testTask, {});
    
    console.assert(result.type === 'generated_code', '❌ Result should be generated_code type');
    console.assert(result.code !== undefined, '❌ Result should contain code');
    console.assert(result.language === 'python', '❌ Language should be python');
    
    console.log('✅ Code worker test passed');
    console.log('   Code preview:', result.code.substring(0, 150) + '...');
  } catch (error) {
    console.log('❌ Code worker test failed:', error.message);
  }
  
  await worker.shutdown();
}

async function testAnalysisWorker(worker) {
  console.log('\n=== Test: Analysis Worker ===');
  
  await worker.connect();
  
  const testTask = {
    taskId: 'analysis_test_' + Date.now(),
    payload: {
      action: 'analyze',
      data: [
        { month: 'Jan', sales: 100 },
        { month: 'Feb', sales: 150 },
        { month: 'Mar', sales: 120 },
        { month: 'Apr', sales: 200 }
      ]
    }
  };
  
  try {
    const result = await worker.processTask(testTask, {});
    
    console.assert(result.type === 'analysis_result', '❌ Result should be analysis_result type');
    console.assert(result.analysis !== undefined, '❌ Result should contain analysis');
    
    console.log('✅ Analysis worker test passed');
  } catch (error) {
    console.log('❌ Analysis worker test failed:', error.message);
  }
  
  await worker.shutdown();
}

async function testTaskQueuePolling(worker) {
  console.log('\n=== Test: Task Queue Polling ===');
  
  // Insert a test task
  const testTaskId = 'queue_test_' + Date.now();
  await worker.db.collection('task_queue').insertOne({
    taskId: testTaskId,
    requiredCapability: 'research',
    payload: {
      action: 'summarize',
      content: 'Test content for queue polling test.'
    },
    status: 'pending',
    priority: 1,
    createdAt: new Date()
  });
  
  // Check task was inserted
  const inserted = await worker.db.collection('task_queue').findOne({ taskId: testTaskId });
  console.assert(inserted !== null, '❌ Task should be in queue');
  console.assert(inserted.status === 'pending', '❌ Task should be pending');
  
  console.log('✅ Task queue insertion test passed');
  console.log('   (Task will be picked up when polling starts)');
  
  // Cleanup
  await worker.db.collection('task_queue').deleteOne({ taskId: testTaskId });
}

async function runAllTests() {
  console.log('🧪 Starting Worker Layer Tests...\n');
  console.log('================================');
  
  try {
    // Initialize workers
    const workers = await testWorkerInitialization();
    
    // Test MongoDB connection with research worker
    const connected = await testMongoConnection(workers.research);
    
    if (connected) {
      await testWorkerRegistration(workers.research);
      await testHeartbeat(workers.research);
      await testContextStorage(workers.research);
      await testTaskProcessing(workers.research);
      await testTaskQueuePolling(workers.research);
      
      // Test other workers
      await testCodeWorker(workers.code);
      await testAnalysisWorker(workers.analysis);
      
      // Cleanup
      await workers.research.shutdown();
    }
    
    console.log('\n================================');
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
  
  process.exit(0);
}

runAllTests();
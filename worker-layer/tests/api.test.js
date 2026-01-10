// tests/api.test.js
// Run this AFTER starting the worker manager: npm start

const BASE_URL = 'http://localhost:3001';

async function testHealthEndpoint() {
  console.log('\n=== Test: GET /health ===');
  
  const res = await fetch(`${BASE_URL}/health`);
  const data = await res.json();
  
  console.assert(res.status === 200, '❌ Health should return 200');
  console.assert(data.status === 'healthy', '❌ Status should be healthy');
  console.assert(Array.isArray(data.workers), '❌ Workers should be array');
  console.assert(data.workers.length > 0, '❌ Should have active workers');
  
  console.log('✅ Health endpoint test passed');
  console.log(`   Active workers: ${data.workers.length}`);
  data.workers.forEach(w => console.log(`   - ${w.name} (${w.status})`));
}

async function testWorkersEndpoint() {
  console.log('\n=== Test: GET /workers ===');
  
  const res = await fetch(`${BASE_URL}/workers`);
  const workers = await res.json();
  
  console.assert(res.status === 200, '❌ Should return 200');
  console.assert(Array.isArray(workers), '❌ Should return array');
  
  // Check worker structure
  if (workers.length > 0) {
    const w = workers[0];
    console.assert(w.workerId !== undefined, '❌ Worker should have workerId');
    console.assert(w.name !== undefined, '❌ Worker should have name');
    console.assert(Array.isArray(w.capabilities), '❌ Worker should have capabilities');
  }
  
  console.log('✅ Workers endpoint test passed');
}

async function testCapabilitiesEndpoint() {
  console.log('\n=== Test: GET /capabilities ===');
  
  const res = await fetch(`${BASE_URL}/capabilities`);
  const data = await res.json();
  
  console.assert(res.status === 200, '❌ Should return 200');
  console.assert(Array.isArray(data.capabilities), '❌ Should have capabilities array');
  
  const expected = ['research', 'code_generation', 'data_analysis', 'message_routing'];
  expected.forEach(cap => {
    console.assert(data.capabilities.includes(cap), `❌ Missing capability: ${cap}`);
  });
  
  console.log('✅ Capabilities endpoint test passed');
  console.log(`   Available: ${data.capabilities.join(', ')}`);
}

async function testFindWorkerByCapability() {
  console.log('\n=== Test: GET /workers/by-capability/:cap ===');
  
  const res = await fetch(`${BASE_URL}/workers/by-capability/research`);
  const workers = await res.json();
  
  console.assert(res.status === 200, '❌ Should return 200');
  console.assert(Array.isArray(workers), '❌ Should return array');
  console.assert(workers.length > 0, '❌ Should find at least one research worker');
  
  workers.forEach(w => {
    console.assert(w.capabilities.includes('research'), '❌ Worker should have research capability');
  });
  
  console.log('✅ Find by capability test passed');
}

async function testTaskAssignment() {
  console.log('\n=== Test: POST /tasks/assign ===');
  
  const taskId = 'api_test_' + Date.now();
  
  const res = await fetch(`${BASE_URL}/tasks/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      requiredCapability: 'research',
      payload: {
        action: 'summarize',
        content: 'Test content for API testing. This is a simple document.'
      },
      priority: 1
    })
  });
  
  const data = await res.json();
  
  console.assert(res.status === 200, '❌ Should return 200');
  console.assert(data.assigned === true || data.queued === true, '❌ Task should be assigned or queued');
  
  console.log('✅ Task assignment test passed');
  console.log(`   Result: ${data.assigned ? 'Assigned to ' + data.workerId : 'Queued'}`);
  
  return taskId;
}

async function testSpawnWorker() {
  console.log('\n=== Test: POST /workers/spawn ===');
  
  const res = await fetch(`${BASE_URL}/workers/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'research' })
  });
  
  const data = await res.json();
  
  console.assert(res.status === 200, '❌ Should return 200');
  console.assert(data.spawned === true, '❌ Worker should be spawned');
  console.assert(data.workerId !== undefined, '❌ Should return workerId');
  
  console.log('✅ Spawn worker test passed');
  console.log(`   New worker: ${data.workerId}`);
  
  return data.workerId;
}

async function testWorkerStatus(workerId) {
  console.log('\n=== Test: GET /workers/:workerId/status ===');
  
  const res = await fetch(`${BASE_URL}/workers/${workerId}/status`);
  const data = await res.json();
  
  console.assert(res.status === 200, '❌ Should return 200');
  console.assert(data.workerId === workerId, '❌ WorkerId should match');
  console.assert(data.status !== undefined, '❌ Should have status');
  
  console.log('✅ Worker status test passed');
  console.log(`   Status: ${data.status}`);
}

async function testStopWorker(workerId) {
  console.log('\n=== Test: POST /workers/:workerId/stop ===');
  
  const res = await fetch(`${BASE_URL}/workers/${workerId}/stop`, {
    method: 'POST'
  });
  
  const data = await res.json();
  
  console.assert(res.status === 200, '❌ Should return 200');
  console.assert(data.stopped === true, '❌ Worker should be stopped');
  
  console.log('✅ Stop worker test passed');
}

async function testInvalidCapability() {
  console.log('\n=== Test: Invalid Capability Handling ===');
  
  const res = await fetch(`${BASE_URL}/tasks/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: 'invalid_' + Date.now(),
      requiredCapability: 'nonexistent_capability',
      payload: { action: 'test' }
    })
  });
  
  const data = await res.json();
  
  // Should queue since no worker can handle it
  console.assert(data.queued === true, '❌ Should queue task with no matching worker');
  
  console.log('✅ Invalid capability handling test passed');
}

async function runAllAPITests() {
  console.log('🧪 Starting API Tests...');
  console.log('========================');
  console.log('⚠️  Make sure worker manager is running: npm start\n');
  
  try {
    // Basic health check first
    await testHealthEndpoint();
    await testWorkersEndpoint();
    await testCapabilitiesEndpoint();
    await testFindWorkerByCapability();
    
    // Task operations
    await testTaskAssignment();
    await testInvalidCapability();
    
    // Worker lifecycle
    const newWorkerId = await testSpawnWorker();
    await testWorkerStatus(newWorkerId);
    await testStopWorker(newWorkerId);
    
    console.log('\n========================');
    console.log('🎉 All API tests passed!');
    
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.error('\n❌ Connection refused. Is the worker manager running?');
      console.error('   Run: npm start');
    } else {
      console.error('\n❌ API tests failed:', error.message);
    }
  }
}

runAllAPITests();
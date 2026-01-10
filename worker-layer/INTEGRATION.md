# Worker Layer Integration Guide

## For Mandar (Orchestrator Layer)

### Adding Tasks to Queue
```javascript
// Insert task into MongoDB task_queue collection
await db.collection('task_queue').insertOne({
  taskId: 'unique_task_id',
  requiredCapability: 'research', // or 'code_generation', 'data_analysis', etc.
  payload: {
    action: 'search',  // specific action for the capability
    query: 'your search query'
  },
  contextId: 'shared_context_id',  // optional
  priority: 1,  // higher = more urgent
  status: 'pending',
  createdAt: new Date()
});
```

### Or POST directly to Worker Manager
```javascript
await fetch('http://localhost:3001/tasks/assign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'unique_task_id',
    requiredCapability: 'code_generation',
    payload: {
      action: 'generate',
      requirements: 'Build a REST API...',
      language: 'python'
    },
    contextId: 'project_123',
    priority: 2
  })
});
```

### Available Capabilities
| Capability | Worker | Actions |
|------------|--------|---------|
| `research` | ResearchAgent | search, summarize, gather_data |
| `web_search` | ResearchAgent | search |
| `data_gathering` | ResearchAgent | gather_data |
| `summarization` | ResearchAgent | summarize |
| `code_generation` | CodeAgent | generate |
| `code_review` | CodeAgent | review |
| `debugging` | CodeAgent | debug |
| `refactoring` | CodeAgent | refactor |
| `data_analysis` | AnalysisAgent | analyze |
| `pattern_recognition` | AnalysisAgent | find_patterns |
| `insights` | AnalysisAgent | generate_insights |
| `reporting` | AnalysisAgent | create_report |
| `message_routing` | CommunicationAgent | broadcast |
| `context_sharing` | CommunicationAgent | share_context |
| `coordination` | CommunicationAgent | request_collaboration |

### Check Task Results
```javascript
const result = await db.collection('task_results').findOne({ taskId: 'your_task_id' });
```

---

## For Mrithika (Watchdog Layer)

### Monitor Worker Heartbeats
Workers send heartbeats to MongoDB `worker_heartbeats` collection:
```javascript
// Query recent heartbeats
const heartbeats = await db.collection('worker_heartbeats')
  .find({ timestamp: { $gte: new Date(Date.now() - 30000) } }) // last 30s
  .sort({ timestamp: -1 })
  .toArray();
```

### Heartbeat Schema
```javascript
{
  workerId: 'worker_id',
  workerName: 'ResearchAgent',
  event: 'heartbeat' | 'task_started' | 'task_completed' | 'task_failed' | 'error' | 'online' | 'shutdown',
  status: 'idle' | 'busy' | 'offline',
  currentTask: 'task_id' | null,
  timestamp: Date,
  details: { /* event-specific data */ }
}
```

### HTTP Endpoint for Real-time Updates
Workers POST to `WATCHDOG_URL/heartbeat` with heartbeat data.

### Worker Status via HTTP
```
GET http://localhost:3001/health
GET http://localhost:3001/workers
GET http://localhost:3001/workers/:workerId/status
```

---

## For Anjali (Frontend)

### API Endpoints Available

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health + all worker statuses |
| GET | `/workers` | List all active workers |
| GET | `/capabilities` | List all available capabilities |
| GET | `/workers/by-capability/:cap` | Find workers by capability |
| GET | `/workers/:id/status` | Get specific worker status |
| POST | `/workers/spawn` | Spawn new worker `{type: 'research'}` |
| POST | `/workers/:id/stop` | Stop a worker |
| POST | `/tasks/assign` | Assign task directly |

### Example: Get System Status for Dashboard
```javascript
const res = await fetch('http://localhost:3001/health');
const { status, workers } = await res.json();
// workers: [{ id, name, status, capabilities, currentTask }]
```

---

## MongoDB Collections Used

| Collection | Purpose | Indexed Fields |
|------------|---------|----------------|
| `workers` | Worker registry | workerId, capabilities, status |
| `task_queue` | Pending/active tasks | taskId, status, requiredCapability |
| `task_results` | Completed task results | taskId, workerId |
| `contexts` | Shared context data | contextId |
| `worker_heartbeats` | Health monitoring | workerId, timestamp |
| `agent_messages` | Inter-agent comms | messageId, targets |
| `collaborations` | Collab requests | collabId, status |
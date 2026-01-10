// scripts/setupDatabase.js
import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function setupDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('hackathon_agents');
    
    console.log('Setting up collections and indexes...');

    // Workers collection - stores worker registrations
    await db.createCollection('workers');
    await db.collection('workers').createIndex({ workerId: 1 }, { unique: true });
    await db.collection('workers').createIndex({ capabilities: 1 });
    await db.collection('workers').createIndex({ status: 1 });

    // Task queue - orchestrator adds tasks here
    await db.createCollection('task_queue');
    await db.collection('task_queue').createIndex({ taskId: 1 }, { unique: true });
    await db.collection('task_queue').createIndex({ status: 1, requiredCapability: 1 });
    await db.collection('task_queue').createIndex({ priority: -1, createdAt: 1 });
    await db.collection('task_queue').createIndex({ assignedTo: 1 });

    // Task results - workers store results here
    await db.createCollection('task_results');
    await db.collection('task_results').createIndex({ taskId: 1 });
    await db.collection('task_results').createIndex({ workerId: 1 });

    // Contexts - shared context between agents
    await db.createCollection('contexts');
    await db.collection('contexts').createIndex({ contextId: 1 }, { unique: true });

    // Worker heartbeats - for watchdog monitoring
    await db.createCollection('worker_heartbeats');
    await db.collection('worker_heartbeats').createIndex({ workerId: 1, timestamp: -1 });
    await db.collection('worker_heartbeats').createIndex({ timestamp: 1 }, { expireAfterSeconds: 3600 }); // TTL 1 hour

    // Agent messages - inter-agent communication
    await db.createCollection('agent_messages');
    await db.collection('agent_messages').createIndex({ messageId: 1 });
    await db.collection('agent_messages').createIndex({ targets: 1 });

    // Collaborations - multi-agent collaboration requests
    await db.createCollection('collaborations');
    await db.collection('collaborations').createIndex({ collabId: 1 }, { unique: true });
    await db.collection('collaborations').createIndex({ status: 1 });

    // Shared contexts - for context sharing between specific agents
    await db.createCollection('shared_contexts');
    await db.collection('shared_contexts').createIndex({ contextId: 1 });
    await db.collection('shared_contexts').createIndex({ targetWorkers: 1 });

    // Agent memory - long-term memory storage
    await db.createCollection('agent_memory');
    await db.collection('agent_memory').createIndex({ key: 1 }, { unique: true });
    await db.collection('agent_memory').createIndex({ tags: 1 });
    await db.collection('agent_memory').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // Knowledge graph - entities and relationships
    await db.createCollection('knowledge_graph');
    await db.collection('knowledge_graph').createIndex({ entityId: 1 }, { unique: true });
    await db.collection('knowledge_graph').createIndex({ type: 1 });

    await db.createCollection('knowledge_graph_edges');
    await db.collection('knowledge_graph_edges').createIndex({ from: 1, to: 1, type: 1 });

    console.log('Database setup complete!');
    
    // Print collection info
    const collections = await db.listCollections().toArray();
    console.log('\nCreated collections:');
    collections.forEach(c => console.log(`  - ${c.name}`));

  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    await client.close();
  }
}

setupDatabase();
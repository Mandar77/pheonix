// scripts/setupPhoenixDB.js
// Database setup matching Project Phoenix spec exactly
import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function setupPhoenixDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('phoenix');
    
    console.log('🐦‍🔥 Setting up Phoenix Database...\n');

    // ============================================
    // WORKFLOWS COLLECTION (Spec 4.1)
    // ============================================
    console.log('Creating workflows collection...');
    await db.createCollection('workflows');
    await db.collection('workflows').createIndex({ status: 1 });
    await db.collection('workflows').createIndex({ created_at: -1 });

    // ============================================
    // TASKS COLLECTION (Spec 4.2)
    // ============================================
    console.log('Creating tasks collection...');
    await db.createCollection('tasks');
    
    // For finding pending tasks by type (worker claim)
    await db.collection('tasks').createIndex({ status: 1, type: 1 });
    
    // For finding tasks by workflow
    await db.collection('tasks').createIndex({ workflow_id: 1 });
    
    // For lock timeout recovery (spec 5.3)
    await db.collection('tasks').createIndex({ status: 1, locked_at: 1 });
    
    // For dependency resolution
    await db.collection('tasks').createIndex({ dependencies: 1 });

    // ============================================
    // LOGS COLLECTION (Spec 4.3 - Immutable)
    // ============================================
    console.log('Creating logs collection...');
    await db.createCollection('logs');
    await db.collection('logs').createIndex({ timestamp: -1 });
    await db.collection('logs').createIndex({ workflow_id: 1, timestamp: -1 });
    await db.collection('logs').createIndex({ task_id: 1 });
    await db.collection('logs').createIndex({ level: 1 });
    await db.collection('logs').createIndex({ component: 1 });

    // ============================================
    // WORKERS COLLECTION (For watchdog)
    // ============================================
    console.log('Creating workers collection...');
    await db.createCollection('workers');
    await db.collection('workers').createIndex({ workerId: 1 }, { unique: true });
    await db.collection('workers').createIndex({ status: 1 });
    await db.collection('workers').createIndex({ lastHeartbeat: 1 });

    // ============================================
    // INSERT SAMPLE DATA FOR TESTING
    // ============================================
    console.log('\nInserting sample workflow for testing...');
    
    const sampleWorkflowId = 'wf_demo_001';
    
    // Check if sample already exists
    const existing = await db.collection('workflows').findOne({ _id: sampleWorkflowId });
    if (!existing) {
      await db.collection('workflows').insertOne({
        _id: sampleWorkflowId,
        goal: 'Deploy Minecraft Server on AWS',
        status: 'PENDING',
        created_at: new Date().toISOString(),
        context_summary: 'Demo workflow for Phoenix hackathon'
      });

      // Insert sample tasks forming a DAG
      const sampleTasks = [
        {
          _id: 'task_001',
          workflow_id: sampleWorkflowId,
          type: 'SEARCH',
          description: 'Research AWS EC2 instance types for gaming servers',
          status: 'PENDING',
          dependencies: [],
          retry_count: 0,
          max_retries: 3,
          worker_lock: null,
          locked_at: null,
          input_context: { 
            query: 'Best AWS EC2 instance for Minecraft server',
            workflow_goal: 'Deploy Minecraft Server on AWS'
          },
          output_artifact: null,
          created_at: new Date()
        },
        {
          _id: 'task_002',
          workflow_id: sampleWorkflowId,
          type: 'SEARCH',
          description: 'Research Minecraft server requirements',
          status: 'PENDING',
          dependencies: [],
          retry_count: 0,
          max_retries: 3,
          worker_lock: null,
          locked_at: null,
          input_context: { 
            query: 'Minecraft server hardware requirements RAM CPU',
            workflow_goal: 'Deploy Minecraft Server on AWS'
          },
          output_artifact: null,
          created_at: new Date()
        },
        {
          _id: 'task_003',
          workflow_id: sampleWorkflowId,
          type: 'SUMMARIZE',
          description: 'Summarize research findings',
          status: 'BLOCKED',
          dependencies: ['task_001', 'task_002'],
          retry_count: 0,
          max_retries: 3,
          worker_lock: null,
          locked_at: null,
          input_context: { 
            format: 'technical summary',
            workflow_goal: 'Deploy Minecraft Server on AWS'
          },
          output_artifact: null,
          created_at: new Date()
        },
        {
          _id: 'task_004',
          workflow_id: sampleWorkflowId,
          type: 'PROVISION_INFRA',
          description: 'Create EC2 instance for Minecraft',
          status: 'BLOCKED',
          dependencies: ['task_003'],
          retry_count: 0,
          max_retries: 3,
          worker_lock: null,
          locked_at: null,
          input_context: {
            resource_type: 'EC2',
            provider: 'AWS',
            config: { instance_type: 't3.medium', region: 'us-west-2' },
            workflow_goal: 'Deploy Minecraft Server on AWS'
          },
          output_artifact: null,
          created_at: new Date()
        },
        {
          _id: 'task_005',
          workflow_id: sampleWorkflowId,
          type: 'CODE_GENERATE',
          description: 'Generate Minecraft server setup script',
          status: 'BLOCKED',
          dependencies: ['task_004'],
          retry_count: 0,
          max_retries: 3,
          worker_lock: null,
          locked_at: null,
          input_context: {
            requirements: 'Bash script to install and configure Minecraft Java server',
            language: 'bash',
            workflow_goal: 'Deploy Minecraft Server on AWS'
          },
          output_artifact: null,
          created_at: new Date()
        },
        {
          _id: 'task_006',
          workflow_id: sampleWorkflowId,
          type: 'VALIDATE',
          description: 'Validate deployment',
          status: 'BLOCKED',
          dependencies: ['task_005'],
          retry_count: 0,
          max_retries: 3,
          worker_lock: null,
          locked_at: null,
          input_context: {
            validation_rules: ['security', 'completeness', 'best_practices'],
            workflow_goal: 'Deploy Minecraft Server on AWS'
          },
          output_artifact: null,
          created_at: new Date()
        }
      ];

      await db.collection('tasks').insertMany(sampleTasks);
      console.log(`   ✅ Created sample workflow: ${sampleWorkflowId}`);
      console.log(`   ✅ Created ${sampleTasks.length} sample tasks (DAG structure)`);
    } else {
      console.log('   Sample workflow already exists, skipping...');
    }

    // Print summary
    console.log('\n========================================');
    console.log('🐦‍🔥 Phoenix Database Setup Complete!');
    console.log('========================================');
    
    const collections = await db.listCollections().toArray();
    console.log('\nCollections created:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} documents`);
    }

    console.log('\nSample DAG structure:');
    console.log('   task_001 (SEARCH) ─┐');
    console.log('                      ├─► task_003 (SUMMARIZE) ─► task_004 (INFRA) ─► task_005 (CODE) ─► task_006 (VALIDATE)');
    console.log('   task_002 (SEARCH) ─┘');

  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    await client.close();
  }
}

setupPhoenixDatabase();
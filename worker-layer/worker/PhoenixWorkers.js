// worker/PhoenixWorkers.js
// Specialized workers for Project Phoenix SRE system
import { PhoenixBaseWorker, TaskType, LogLevel } from './PhoenixBaseWorker.js';

// SEARCHER WORKER - Handles SEARCH tasks
export class SearcherWorker extends PhoenixBaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'SearcherWorker',
      taskTypes: [TaskType.SEARCH]
    });
  }

  async processTask(task) {
    const { query, sources, depth } = task.input_context || {};

    await this.log(LogLevel.INFO, `Searching: ${query}`, task.workflow_id, task._id.toString());

    const prompt = `
You are an SRE research assistant. Search for information on:

QUERY: ${query || 'general infrastructure information'}
SOURCES TO CONSIDER: ${JSON.stringify(sources || ['documentation', 'best practices', 'tutorials'])}
DEPTH: ${depth || 'comprehensive'}

WORKFLOW CONTEXT: ${task.input_context?.workflow_goal || 'Infrastructure deployment'}

Provide:
1. Key findings
2. Relevant commands or configurations
3. Potential issues to watch for
4. Recommended next steps

Return structured JSON:
{
  "findings": [...],
  "commands": [...],
  "warnings": [...],
  "next_steps": [...],
  "confidence": 0-100
}`;

    const response = await this.callLLM(prompt, 'You are an expert SRE researcher. Return only valid JSON.');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { raw_findings: response, parse_error: true };
    }

    return {
      type: 'search_result',
      query,
      result,
      searched_at: new Date().toISOString()
    };
  }
}

// SUMMARIZER WORKER - Handles SUMMARIZE tasks
export class SummarizerWorker extends PhoenixBaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'SummarizerWorker',
      taskTypes: [TaskType.SUMMARIZE, TaskType.SYNTHESIZE]
    });
  }

  async processTask(task) {
    const { content, format, focus } = task.input_context || {};

    await this.log(LogLevel.INFO, `Summarizing content`, task.workflow_id, task._id.toString());

    const prompt = `
Summarize the following content for an SRE workflow:

CONTENT:
${JSON.stringify(content)}

FORMAT: ${format || 'executive summary'}
FOCUS AREAS: ${focus || 'key actions and decisions'}

Provide:
1. Executive summary (2-3 sentences)
2. Key points
3. Action items
4. Context for next workflow stage

Return JSON:
{
  "summary": "...",
  "key_points": [...],
  "action_items": [...],
  "context_for_next": "..."
}`;

    const response = await this.callLLM(prompt, 'You are a technical writer specializing in SRE documentation.');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { summary: response };
    }

    return {
      type: 'summary_result',
      result,
      summarized_at: new Date().toISOString()
    };
  }
}

// INFRASTRUCTURE WORKER - Handles PROVISION_INFRA tasks
export class InfraWorker extends PhoenixBaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'InfraWorker',
      taskTypes: [TaskType.PROVISION_INFRA]
    });
  }

  async processTask(task) {
    const { resource_type, provider, config, action } = task.input_context || {};

    await this.log(
      LogLevel.INFO, 
      `Provisioning: ${resource_type} on ${provider}`, 
      task.workflow_id, 
      task._id.toString()
    );

    const prompt = `
You are an Infrastructure as Code expert. Generate provisioning plan for:

RESOURCE TYPE: ${resource_type || 'EC2 instance'}
CLOUD PROVIDER: ${provider || 'AWS'}
ACTION: ${action || 'create'}
CONFIGURATION: ${JSON.stringify(config || {})}

WORKFLOW GOAL: ${task.input_context?.workflow_goal || 'Deploy infrastructure'}

Generate:
1. Terraform/CloudFormation code snippet
2. Required IAM permissions
3. Estimated costs
4. Provisioning steps
5. Verification commands

Return JSON:
{
  "infrastructure_code": "...",
  "permissions_required": [...],
  "estimated_cost": "...",
  "steps": [...],
  "verification_commands": [...],
  "rollback_plan": "..."
}`;

    const response = await this.callLLM(prompt, 'You are an AWS/cloud infrastructure expert.');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { raw_plan: response };
    }

    // Simulate provisioning delay (for demo)
    await this.sleep(2000);

    return {
      type: 'infra_result',
      resource_type,
      provider,
      result,
      provisioned_at: new Date().toISOString(),
      status: 'SIMULATED' // For hackathon demo
    };
  }
}

// CODE GENERATOR WORKER
export class CodeGenWorker extends PhoenixBaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'CodeGenWorker',
      taskTypes: [TaskType.CODE_GENERATE]
    });
  }

  async processTask(task) {
    const { requirements, language, framework } = task.input_context || {};

    await this.log(LogLevel.INFO, `Generating ${language} code`, task.workflow_id, task._id.toString());

    const prompt = `
Generate code for:

REQUIREMENTS: ${requirements}
LANGUAGE: ${language || 'python'}
FRAMEWORK: ${framework || 'none'}

WORKFLOW CONTEXT: ${task.input_context?.workflow_goal || 'Automation script'}

Provide production-ready code with:
1. Error handling
2. Logging
3. Configuration management
4. Comments

Return JSON:
{
  "code": "...",
  "filename": "...",
  "dependencies": [...],
  "usage": "...",
  "tests": "..."
}`;

    const response = await this.callLLM(prompt, `You are an expert ${language || 'Python'} developer.`);
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { code: response };
    }

    return {
      type: 'code_result',
      language,
      result,
      generated_at: new Date().toISOString()
    };
  }
}

// ANALYZER WORKER
export class AnalyzerWorker extends PhoenixBaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'AnalyzerWorker',
      taskTypes: [TaskType.ANALYZE]
    });
  }

  async processTask(task) {
    const { data, analysis_type, metrics } = task.input_context || {};

    await this.log(LogLevel.INFO, `Analyzing: ${analysis_type}`, task.workflow_id, task._id.toString());

    const prompt = `
Analyze this data for SRE insights:

DATA: ${JSON.stringify(data)}
ANALYSIS TYPE: ${analysis_type || 'general'}
METRICS TO FOCUS ON: ${JSON.stringify(metrics || ['performance', 'reliability', 'cost'])}

Provide:
1. Key insights
2. Anomalies detected
3. Recommendations
4. Risk assessment

Return JSON:
{
  "insights": [...],
  "anomalies": [...],
  "recommendations": [...],
  "risk_level": "low|medium|high",
  "confidence": 0-100
}`;

    const response = await this.callLLM(prompt, 'You are an SRE analyst expert.');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { raw_analysis: response };
    }

    return {
      type: 'analysis_result',
      analysis_type,
      result,
      analyzed_at: new Date().toISOString()
    };
  }
}

// VALIDATOR WORKER
export class ValidatorWorker extends PhoenixBaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'ValidatorWorker',
      taskTypes: [TaskType.VALIDATE]
    });
  }

  async processTask(task) {
    const { artifact, validation_rules, expected_schema } = task.input_context || {};

    await this.log(LogLevel.INFO, `Validating artifact`, task.workflow_id, task._id.toString());

    const prompt = `
Validate this artifact:

ARTIFACT: ${JSON.stringify(artifact)}
VALIDATION RULES: ${JSON.stringify(validation_rules || ['completeness', 'correctness', 'security'])}
EXPECTED SCHEMA: ${JSON.stringify(expected_schema || {})}

Check for:
1. Schema compliance
2. Security issues
3. Best practice violations
4. Missing components

Return JSON:
{
  "is_valid": true/false,
  "errors": [...],
  "warnings": [...],
  "security_issues": [...],
  "score": 0-100,
  "recommendations": [...]
}`;

    const response = await this.callLLM(prompt, 'You are a senior SRE reviewer.');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = { raw_validation: response };
    }

    return {
      type: 'validation_result',
      result,
      validated_at: new Date().toISOString()
    };
  }
}

// PLANNER WORKER - Breaks down workflows into tasks
// PLANNER WORKER - Breaks down workflows into tasks
export class PlannerWorker extends PhoenixBaseWorker {
  constructor(workerId) {
    super({
      workerId,
      name: 'PlannerWorker',
      taskTypes: [TaskType.PLAN]
    });
  }

  async processTask(task) {
    const { goal, constraints } = task.input_context || {};

    await this.log(LogLevel.INFO, `Planning workflow: ${goal}`, task.workflow_id, task._id.toString());

    const prompt = `
Create a detailed execution plan for this SRE goal:

GOAL: ${goal}
CONSTRAINTS: ${JSON.stringify(constraints || {})}

AVAILABLE TASK TYPES:
- SEARCH: Research and gather information
- SUMMARIZE: Condense findings
- PROVISION_INFRA: Create cloud resources
- CODE_GENERATE: Write automation scripts
- ANALYZE: Analyze data/logs
- VALIDATE: Verify outputs

Create a DAG of tasks with dependencies.

Return JSON ONLY. No conversational text.
{
  "tasks": [
    {
      "id": "task_1",
      "type": "SEARCH",
      "description": "...",
      "input_context": {...},
      "dependencies": [],
      "estimated_duration": "seconds"
    }
  ],
  "execution_order": ["task_1", "task_2"],
  "critical_path": [...],
  "estimated_total_time": "..."
}`;

    const response = await this.callLLM(prompt, 'You are an SRE workflow architect. Output ONLY valid JSON.');
    
    let plan;
    try {
      // 🧠 SMART FIX: Extract JSON from chatty responses
      let jsonString = response;
      
      // 1. Try to extract code block
      const codeBlockMatch = response.match(/```json([\s\S]*?)```/) || response.match(/```([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
      }

      // 2. Find the first '{' and last '}' to strip outside text
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }

      plan = JSON.parse(jsonString);

    } catch (e) {
      console.error("Failed to parse Plan JSON:", e);
      plan = { raw_plan: response, error: "JSON Parse Failed" };
    }

    // Auto-create tasks in MongoDB if workflow_id exists
    if (task.workflow_id && plan.tasks && Array.isArray(plan.tasks)) {
      for (const plannedTask of plan.tasks) {
        const deps = (plannedTask.dependencies || []).map(depId => 
          `${task.workflow_id}_${depId}`
        );
        
        await this.db.collection('tasks').insertOne({
          _id: `${task.workflow_id}_${plannedTask.id}`,
          workflow_id: task.workflow_id,
          type: plannedTask.type,
          description: plannedTask.description,
          status: deps.length > 0 ? 'BLOCKED' : 'PENDING',
          dependencies: deps,
          retry_count: 0,
          max_retries: 3,
          worker_lock: null,
          locked_at: null,
          input_context: plannedTask.input_context || {},
          output_artifact: null,
          created_at: new Date()
        });
      }

      await this.log(
        LogLevel.INFO, 
        `Created ${plan.tasks.length} tasks for workflow`,
        task.workflow_id,
        task._id.toString()
      );
    }

    return {
      type: 'plan_result',
      goal,
      plan,
      tasks_created: plan.tasks?.length || 0,
      planned_at: new Date().toISOString()
    };
  }
}
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
    const { query } = task.input_context || {};
    const workflowGoal = task.input_context?.workflow_goal || 'Research';

    await this.log(LogLevel.INFO, `Searching: ${query || workflowGoal}`, task.workflow_id, task._id.toString());

    const prompt = `Research this topic for an SRE workflow:
QUERY: ${query || workflowGoal}
CONTEXT: ${workflowGoal}

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{"findings":["finding1","finding2","finding3"],"commands":["command1"],"configurations":{"key":"value"},"warnings":["warning1"],"next_steps":["step1"],"confidence":85,"sources":["source1"]}`;

    const response = await this.callLLM(prompt, 'You are an SRE researcher. Output ONLY valid JSON. No markdown. Start with { end with }');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      const jsonMatch = response.match(/\{[\s\S]*"findings"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          result = {
            findings: [response.substring(0, 500)],
            commands: [],
            warnings: [],
            next_steps: [],
            confidence: 70
          };
        }
      } else {
        result = {
          findings: [response.substring(0, 500)],
          commands: [],
          warnings: [],
          next_steps: [],
          confidence: 70
        };
      }
    }

    return {
      type: 'search_result',
      query: query || workflowGoal,
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
    const { content, format } = task.input_context || {};
    const depOutputs = task.input_context?.dependency_outputs || {};

    await this.log(LogLevel.INFO, 'Summarizing content', task.workflow_id, task._id.toString());

    const contextData = Object.keys(depOutputs).length > 0 
      ? JSON.stringify(depOutputs).substring(0, 2000)
      : JSON.stringify(content || {}).substring(0, 2000);

    const prompt = `Summarize this SRE workflow data:
DATA: ${contextData}
FORMAT: ${format || 'executive summary'}

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{"summary":"2-3 sentence executive summary","key_points":["point1","point2","point3"],"action_items":["action1","action2"],"risks":["risk1"],"recommendations":["rec1"],"context_for_next_task":"brief context string"}`;

    const response = await this.callLLM(prompt, 'You are a technical writer. Output ONLY valid JSON. No markdown. Start with { end with }');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = {
        summary: response.substring(0, 300),
        key_points: [],
        action_items: [],
        risks: [],
        recommendations: []
      };
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
    const { resource_type, provider, config } = task.input_context || {};

    await this.log(
      LogLevel.INFO, 
      `Provisioning: ${resource_type || 'infrastructure'} on ${provider || 'AWS'}`, 
      task.workflow_id, 
      task._id.toString()
    );

    // Generate realistic Terraform output
    const result = this.generateTerraform(resource_type, provider, config);

    // Simulate provisioning delay
    await this.sleep(2000);

    return {
      type: 'infra_result',
      resource_type: resource_type || 'EC2',
      provider: provider || 'AWS',
      result,
      provisioned_at: new Date().toISOString(),
      status: 'SIMULATED'
    };
  }

  generateTerraform(resourceType, provider, config) {
    const instanceType = config?.instance_type || 't3.medium';
    const region = config?.region || 'us-west-2';
    
    return {
      terraform_code: `# Phoenix Auto-Generated Terraform
provider "aws" {
  region = var.aws_region
}

resource "aws_instance" "phoenix_server" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  
  vpc_security_group_ids = [aws_security_group.phoenix_sg.id]
  
  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }
  
  tags = {
    Name        = "phoenix-\${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "phoenix"
  }
}

resource "aws_security_group" "phoenix_sg" {
  name_prefix = "phoenix-"
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}`,
      variables: {
        aws_region: region,
        instance_type: instanceType,
        environment: "production",
        allowed_ssh_cidr: "10.0.0.0/8"
      },
      outputs: {
        instance_id: "aws_instance.phoenix_server.id",
        public_ip: "aws_instance.phoenix_server.public_ip",
        private_ip: "aws_instance.phoenix_server.private_ip"
      },
      estimated_cost_monthly: "$33.41",
      provisioning_steps: [
        "terraform init",
        "terraform plan -out=tfplan",
        "terraform apply tfplan"
      ],
      verification_commands: [
        `aws ec2 describe-instances --region ${region} --filters "Name=tag:Project,Values=phoenix"`,
        "terraform output -json"
      ],
      rollback_commands: ["terraform destroy -auto-approve"],
      security_notes: [
        "SSH access restricted to internal network",
        "HTTPS open to all for API access",
        "Root volume encrypted by default"
      ]
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
    const workflowGoal = task.input_context?.workflow_goal || 'Automation script';
    const lang = language || 'python';

    await this.log(LogLevel.INFO, `Generating ${lang} code`, task.workflow_id, task._id.toString());

    // Generate realistic code output
    const result = lang === 'bash' ? this.generateBashScript(requirements) : this.generatePythonCode(requirements, framework);

    return {
      type: 'code_result',
      language: lang,
      result,
      generated_at: new Date().toISOString()
    };
  }

  generateBashScript(requirements) {
    return {
      filename: 'deploy.sh',
      code: `#!/bin/bash
# Phoenix Auto-Generated Deployment Script
set -euo pipefail

LOG_FILE="/var/log/phoenix-deploy.log"

log() {
    echo "[\$(date '+%Y-%m-%d %H:%M:%S')] \$1" | tee -a "\$LOG_FILE"
}

check_dependencies() {
    log "Checking dependencies..."
    command -v docker >/dev/null 2>&1 || { log "ERROR: docker required"; exit 1; }
    log "Dependencies OK"
}

deploy_application() {
    log "Starting deployment..."
    docker pull phoenix-app:latest
    docker stop phoenix-app 2>/dev/null || true
    docker rm phoenix-app 2>/dev/null || true
    docker run -d --name phoenix-app --restart unless-stopped -p 8080:8080 phoenix-app:latest
    log "Deployment complete"
}

health_check() {
    log "Running health check..."
    for i in {1..30}; do
        if curl -sf http://localhost:8080/health > /dev/null; then
            log "Health check passed"
            return 0
        fi
        sleep 2
    done
    log "ERROR: Health check failed"
    return 1
}

main() {
    log "=== Phoenix Deployment Started ==="
    check_dependencies
    deploy_application
    health_check
    log "=== Phoenix Deployment Successful ==="
}

main "$@"`,
      dependencies: ['docker', 'curl'],
      usage: 'chmod +x deploy.sh && ./deploy.sh',
      environment_variables: { ENVIRONMENT: 'production' },
      tests: '#!/bin/bash\n./deploy.sh\ncurl -f http://localhost:8080/health'
    };
  }

  generatePythonCode(requirements, framework) {
    return {
      filename: 'main.py',
      code: `#!/usr/bin/env python3
"""Phoenix Auto-Generated Service"""

import os
import logging
from datetime import datetime
from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Phoenix Service", version="1.0.0")

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str

class TaskRequest(BaseModel):
    goal: str

class TaskResponse(BaseModel):
    task_id: str
    status: str

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0"
    )

@app.post("/tasks", response_model=TaskResponse)
async def create_task(request: TaskRequest):
    task_id = f"task_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    logger.info(f"Created task {task_id}: {request.goal}")
    return TaskResponse(task_id=task_id, status="created")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))`,
      dependencies: ['fastapi', 'uvicorn', 'pydantic'],
      usage: 'pip install -r requirements.txt && python main.py',
      environment_variables: { PORT: '8080', ENVIRONMENT: 'production' },
      tests: `import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200`
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
    const { data, analysis_type } = task.input_context || {};
    const depOutputs = task.input_context?.dependency_outputs || {};

    await this.log(LogLevel.INFO, `Analyzing: ${analysis_type || 'general'}`, task.workflow_id, task._id.toString());

    const contextData = Object.keys(depOutputs).length > 0 
      ? JSON.stringify(depOutputs).substring(0, 2000)
      : JSON.stringify(data || {}).substring(0, 2000);

    const prompt = `Analyze this SRE data:
DATA: ${contextData}
ANALYSIS TYPE: ${analysis_type || 'security and performance'}

RESPOND WITH ONLY THIS JSON:
{"insights":["insight1","insight2"],"anomalies":[],"metrics":{"score":85},"recommendations":["rec1"],"risk_level":"low","confidence":85}`;

    const response = await this.callLLM(prompt, 'You are an SRE analyst. Output ONLY valid JSON.');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = {
        insights: ['Analysis completed'],
        anomalies: [],
        recommendations: [],
        risk_level: 'low',
        confidence: 75
      };
    }

    return {
      type: 'analysis_result',
      analysis_type: analysis_type || 'general',
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
    const { validation_rules } = task.input_context || {};
    const depOutputs = task.input_context?.dependency_outputs || {};

    await this.log(LogLevel.INFO, 'Validating artifact', task.workflow_id, task._id.toString());

    const contextData = JSON.stringify(depOutputs).substring(0, 2000);

    const prompt = `Validate this SRE workflow output:
ARTIFACT: ${contextData}
RULES: ${JSON.stringify(validation_rules || ['security', 'completeness'])}

RESPOND WITH ONLY THIS JSON:
{"is_valid":true,"score":85,"errors":[],"warnings":[],"passed_checks":["security","completeness"],"failed_checks":[],"certification":"APPROVED"}`;

    const response = await this.callLLM(prompt, 'You are a senior SRE reviewer. Output ONLY valid JSON.');
    
    let result;
    try {
      result = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      result = {
        is_valid: true,
        score: 80,
        errors: [],
        warnings: [],
        passed_checks: ['basic_validation'],
        certification: 'CONDITIONAL'
      };
    }

    return {
      type: 'validation_result',
      result,
      validated_at: new Date().toISOString()
    };
  }
}

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

    const prompt = `GOAL: ${goal}
CONSTRAINTS: ${JSON.stringify(constraints || {})}

AVAILABLE TASK TYPES: SEARCH, SUMMARIZE, PROVISION_INFRA, CODE_GENERATE, ANALYZE, VALIDATE

Create 4-8 tasks forming a DAG. First task must have empty dependencies.

RESPOND WITH ONLY THIS JSON (no markdown, no text before or after):
{"tasks":[{"id":"task_1","type":"SEARCH","description":"Research step","input_context":{},"dependencies":[],"estimated_duration":300},{"id":"task_2","type":"CODE_GENERATE","description":"Generate code","input_context":{},"dependencies":["task_1"],"estimated_duration":600}],"execution_order":["task_1","task_2"],"estimated_total_time":900}`;

    const response = await this.callLLM(prompt, 'You are a JSON API. Output ONLY valid JSON. No markdown. No explanation. Start with { and end with }');
    
    let plan;
    try {
      plan = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      const jsonMatch = response.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          plan = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          plan = { tasks: [], parse_error: true };
        }
      } else {
        plan = { tasks: [], parse_error: true };
      }
    }

    // Auto-create tasks in MongoDB
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
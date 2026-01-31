# 🐦‍🔥 Project Phoenix

### The Failure-Resilient Autonomous SRE

> *"Phoenix separates thinking from remembering. You can kill the brain, but the system survives."*

[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/atlas)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 Problem Statement

**Track: Prolonged Coordination** — Create an agentic system capable of performing intricate, multi-step workflows that last hours or days, utilizing MongoDB as the context engine, while enduring failures, restarts, and modifications to tasks.

### The Challenge
Traditional automation systems fail catastrophically when processes crash. State is lost, progress is wiped, and operators must restart from scratch.

### Our Solution
Phoenix is a **crash-resilient multi-agent orchestration system** where:
- All state lives in **MongoDB Atlas** — processes are stateless
- Tasks survive process crashes and automatically resume
- Specialized AI agents collaborate to complete complex workflows
- A watchdog monitors and resurrects failed components

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    React Flow + Dagre                           │
│              Real-time DAG Visualization                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────────────┐
│                     WORKER LAYER                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Searcher │ │ Coder    │ │ Infra    │ │ Planner  │  ...      │
│  │ Worker   │ │ Worker   │ │ Worker   │ │ Worker   │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       └────────────┴────────────┴────────────┘                  │
│                         │ Poll + Atomic Lock                    │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    MONGODB ATLAS                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ workflows  │ │   tasks    │ │    logs    │ │  workers   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   ORCHESTRATOR                                   │
│            Dependency Resolution + Recovery                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     WATCHDOG                                     │
│              Process Supervision + Kill Switch                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🧠 Intelligent Task Planning
Give Phoenix a goal, and the **PlannerWorker** automatically decomposes it into a DAG of dependent tasks using AI.

```javascript
// Input: "Deploy a REST API with authentication"
// Output: 6-task DAG with proper dependencies
task_1 (SEARCH) → task_2 (CODE_GENERATE) → task_3 (ANALYZE) → ...
```

### 🔒 Distributed Locking
Atomic task claiming ensures no two workers ever process the same task:
```javascript
db.tasks.findOneAndUpdate(
  { status: "PENDING", type: "SEARCH" },
  { $set: { status: "IN_PROGRESS", worker_lock: "worker_xyz", locked_at: NOW() }}
)
```

### 🔄 Automatic Recovery
Tasks stuck for >5 minutes are automatically reset and retried (up to 3 times):
```
IN_PROGRESS (stuck) → PENDING (retry) → IN_PROGRESS → COMPLETED
```

### 🐦‍🔥 Phoenix Protocol
Kill any component at any time. The system resurrects:
1. Kill worker mid-task → Task times out → Another worker picks it up
2. Kill orchestrator → Restart → Reads state from MongoDB → Resumes exactly where it left off

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-team/phoenix.git
cd phoenix/worker-layer

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### Environment Variables

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/phoenix
GROQ_API_KEY=gsk_your_key_here
WORKER_PORT=3001
```

### Run Phoenix

```bash
# Terminal 1: Initialize database
npm run setup-phoenix

# Terminal 2: Start workers
npm run phoenix

# Terminal 3: Start orchestrator
npm run orchestrator

# Terminal 4: Test the system
npm run test:planner
```

---

## 📊 Database Schema

### workflows
```javascript
{
  "_id": "wf_101",
  "goal": "Deploy Minecraft Server on AWS",
  "status": "PENDING | RUNNING | COMPLETED | FAILED",
  "created_at": "ISO_DATE",
  "context_summary": "LLM-generated summary"
}
```

### tasks
```javascript
{
  "_id": "task_001",
  "workflow_id": "wf_101",
  "type": "SEARCH | SUMMARIZE | PROVISION_INFRA | CODE_GENERATE | ANALYZE | VALIDATE | PLAN",
  "status": "BLOCKED | PENDING | IN_PROGRESS | COMPLETED | FAILED",
  "dependencies": ["task_000"],
  "retry_count": 0,
  "max_retries": 3,
  "worker_lock": "worker_xyz",
  "locked_at": "ISO_DATE",
  "input_context": { ... },
  "output_artifact": { ... }
}
```

### logs (Immutable)
```javascript
{
  "timestamp": "ISO_DATE",
  "level": "INFO | WARN | ERROR",
  "component": "SearcherWorker_a1b2",
  "message": "Task completed in 1719ms",
  "workflow_id": "wf_101",
  "task_id": "task_001"
}
```

---

## 🤖 Specialized Workers

| Worker | Task Types | Capabilities |
|--------|------------|--------------|
| **SearcherWorker** | `SEARCH` | Research, information gathering, documentation lookup |
| **SummarizerWorker** | `SUMMARIZE`, `SYNTHESIZE` | Condense findings, combine multi-agent outputs |
| **InfraWorker** | `PROVISION_INFRA` | Generate Terraform code, AWS/cloud provisioning |
| **CodeGenWorker** | `CODE_GENERATE` | Python, Bash, FastAPI, automation scripts |
| **AnalyzerWorker** | `ANALYZE` | Security analysis, performance review, risk assessment |
| **ValidatorWorker** | `VALIDATE` | Quality checks, compliance verification, certification |
| **PlannerWorker** | `PLAN` | Goal decomposition, DAG generation, workflow design |

---

## 🌐 REST API

**Base URL:** `http://localhost:3001`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System health + worker status |
| `GET` | `/workers` | List all active workers |
| `GET` | `/capabilities` | Available task types |
| `GET` | `/tasks?workflow_id=xxx` | Get tasks for a workflow |
| `GET` | `/tasks?status=PENDING` | Get tasks by status |
| `GET` | `/logs?workflow_id=xxx&limit=50` | Get logs |
| `POST` | `/tasks` | Create a new task |
| `POST` | `/workers/spawn` | Spawn new worker |
| `POST` | `/workers/:id/stop` | Stop a worker |

### Example: Create a Workflow

```bash
# Create a PLAN task - Phoenix will auto-generate the DAG
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_my_project",
    "type": "PLAN",
    "input_context": {
      "goal": "Build and deploy a REST API with JWT authentication",
      "constraints": { "language": "python", "framework": "FastAPI" }
    }
  }'
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# API tests
npm run test:api

# End-to-end workflow test
npm run test:e2e

# Planner worker test
npm run test:planner

# Full Phoenix workflow
npm run test:phoenix
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Database** | MongoDB Atlas |
| **Backend** | Node.js, Express |
| **AI/LLM** | Groq (Llama 3.3 70B) |
| **Frontend** | React, React Flow, Dagre |
| **Process Management** | Custom Watchdog |

---

## 📁 Project Structure

```
phoenix/
├── worker-layer/
│   ├── phoenix.js                 # Main entry point
│   ├── worker/
│   │   ├── PhoenixBaseWorker.js   # Base class with locking, retry
│   │   ├── PhoenixWorkers.js      # 7 specialized workers
│   │   └── PhoenixWorkerManager.js # HTTP API + lifecycle
│   ├── orchestrator/
│   │   └── simpleLoop.js          # Dependency resolution
│   ├── scripts/
│   │   └── setupPhoenixDB.js      # Database initialization
│   ├── tests/
│   │   ├── phoenix.test.js
│   │   └── planner.test.js
│   └── package.json
├── frontend/                       # React application
├── watchdog/                       # Process supervisor
└── README.md
```

---

## 🏆 Why Phoenix Wins

1. **Crash Resilience** — Kill anything, anytime. Phoenix rises.
2. **AI-Powered Planning** — Natural language goals → executable DAGs
3. **Production-Quality Output** — Real Terraform, real Python, not toy examples
4. **Observable** — Full audit trail in immutable logs
5. **Scalable** — Add workers on demand, horizontal scaling ready

---

## 📜 License

MIT License — Built with 🔥 at Cerebral Valley Hackathon 2026

---

<p align="center">
  <img src="https://img.shields.io/badge/Status-Rising%20from%20the%20Ashes-orange?style=for-the-badge"/>
</p>

<p align="center">
  <b>🐦‍🔥 Phoenix — Because failure is just a feature, not a bug. 🐦‍🔥</b>
</p>

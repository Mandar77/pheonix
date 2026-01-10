// Types matching MongoDB schema exactly as per the plan

// Task status enum matching backend
export type TaskStatus = 'BLOCKED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

// Workflow status enum matching backend  
export type WorkflowStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';

// Task types supported by workers
export type TaskType = 'SEARCH' | 'SUMMARIZE' | 'PROVISION_INFRA';

// Log levels
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// Task document (matches MongoDB tasks collection)
export interface Task {
  _id: string;
  workflow_id: string;
  type: TaskType;
  status: TaskStatus;
  dependencies: string[];
  retry_count: number;
  max_retries: number;
  worker_lock: string | null;
  locked_at: string | null;
  input_context: Record<string, unknown>;
  output_artifact: unknown | null;
}

// Workflow document (matches MongoDB workflows collection)
export interface Workflow {
  _id: string;
  goal: string;
  status: WorkflowStatus;
  created_at: string;
  context_summary: string;
}

// Log entry (matches MongoDB logs collection)
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  workflow_id: string;
  task_id?: string;
}

// API response types
export interface OrchestratorStatus {
  alive: boolean;
  uptime: number;
  last_heartbeat: string;
}

export interface CreateWorkflowRequest {
  goal: string;
}

// Graph visualization types
export interface NodePosition {
  x: number;
  y: number;
}

export interface GraphNode {
  task: Task;
  position: NodePosition;
  isRecovering: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  sourceStatus: TaskStatus;
}
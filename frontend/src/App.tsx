import React, { useState, useEffect, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { Task, Workflow, LogEntry, TaskStatus } from './types';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { DAGVisualization } from './graph/DAGVisualization';
import { LogTimeline } from './timeline/LogTimeline';
import { useRecoveryTracker } from './hooks/useWorkflow';

// ============ Demo Mode Data ============
// Remove this section when connecting to real backend

const DEMO_WORKFLOW: Workflow = {
  _id: 'wf_101',
  goal: 'Deploy Minecraft Server on AWS',
  status: 'RUNNING',
  created_at: new Date().toISOString(),
  context_summary: 'Provisioning EC2 instance with Docker support',
};

const createInitialTasks = (): Task[] => [
  { _id: 'task_1', workflow_id: 'wf_101', type: 'SEARCH', status: 'COMPLETED', dependencies: [], retry_count: 0, max_retries: 3, worker_lock: null, locked_at: null, input_context: {}, output_artifact: null },
  { _id: 'task_2', workflow_id: 'wf_101', type: 'SEARCH', status: 'COMPLETED', dependencies: [], retry_count: 0, max_retries: 3, worker_lock: null, locked_at: null, input_context: {}, output_artifact: null },
  { _id: 'task_3', workflow_id: 'wf_101', type: 'SUMMARIZE', status: 'IN_PROGRESS', dependencies: ['task_1', 'task_2'], retry_count: 0, max_retries: 3, worker_lock: 'worker_a1', locked_at: new Date().toISOString(), input_context: {}, output_artifact: null },
  { _id: 'task_4', workflow_id: 'wf_101', type: 'PROVISION_INFRA', status: 'BLOCKED', dependencies: ['task_3'], retry_count: 0, max_retries: 3, worker_lock: null, locked_at: null, input_context: {}, output_artifact: null },
  { _id: 'task_5', workflow_id: 'wf_101', type: 'SEARCH', status: 'PENDING', dependencies: ['task_3'], retry_count: 0, max_retries: 3, worker_lock: null, locked_at: null, input_context: {}, output_artifact: null },
  { _id: 'task_6', workflow_id: 'wf_101', type: 'SUMMARIZE', status: 'BLOCKED', dependencies: ['task_4', 'task_5'], retry_count: 0, max_retries: 3, worker_lock: null, locked_at: null, input_context: {}, output_artifact: null },
];

// ============ Main App ============

function App() {
  // State
  const [workflow] = useState<Workflow>(DEMO_WORKFLOW);
  const [tasks, setTasks] = useState<Task[]>(createInitialTasks());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [orchestratorAlive, setOrchestratorAlive] = useState(true);
  const [isKilling, setIsKilling] = useState(false);

  // Track recovering tasks for animation
  const recoveringIds = useRecoveryTracker(tasks);

  // Helper to add log entry
  const addLog = useCallback((level: LogEntry['level'], component: string, message: string, taskId?: string) => {
    setLogs((prev) => [
      {
        timestamp: new Date().toISOString(),
        level,
        component,
        message,
        workflow_id: 'wf_101',
        task_id: taskId,
      },
      ...prev,
    ].slice(0, 50)); // Keep last 50 logs
  }, []);

  // Demo: Simulate task progression
  useEffect(() => {
    if (!orchestratorAlive) return;

    const interval = setInterval(() => {
      setTasks((prev) => {
        const updated = JSON.parse(JSON.stringify(prev)) as Task[];

        // Find and complete an in-progress task (randomly)
        const inProgress = updated.find((t) => t.status === 'IN_PROGRESS');
        if (inProgress && Math.random() > 0.6) {
          inProgress.status = 'COMPLETED';
          inProgress.worker_lock = null;

          // Unblock dependent tasks
          updated.forEach((t) => {
            if (t.status === 'BLOCKED' && t.dependencies.includes(inProgress._id)) {
              const allDepsDone = t.dependencies.every(
                (depId) => updated.find((x) => x._id === depId)?.status === 'COMPLETED'
              );
              if (allDepsDone) {
                t.status = 'PENDING';
              }
            }
          });

          addLog('INFO', 'Worker', `✓ Task ${inProgress._id} completed`, inProgress._id);
        }

        // Start a pending task if nothing is in progress
        const pending = updated.find((t) => t.status === 'PENDING');
        const hasInProgress = updated.some((t) => t.status === 'IN_PROGRESS');
        
        if (pending && !hasInProgress) {
          pending.status = 'IN_PROGRESS';
          pending.worker_lock = `worker_${Math.random().toString(36).slice(2, 5)}`;
          pending.locked_at = new Date().toISOString();
          
          addLog('INFO', pending.worker_lock, `→ Started ${pending._id} (${pending.type})`, pending._id);
        }

        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [orchestratorAlive, addLog]);

  // Kill orchestrator handler
  const handleKill = useCallback(() => {
    setIsKilling(true);
    setOrchestratorAlive(false);

    addLog('ERROR', 'Admin', '🔥 KILL SIGNAL SENT - Orchestrator terminated!');

    // Mark in-progress tasks as FAILED
    setTasks((prev) =>
      prev.map((t) =>
        t.status === 'IN_PROGRESS'
          ? { ...t, status: 'FAILED' as TaskStatus, worker_lock: null }
          : t
      )
    );

    setTimeout(() => setIsKilling(false), 500);
  }, [addLog]);

  // Recovery handler (Phoenix Protocol)
  const handleRecover = useCallback(() => {
    addLog('WARN', 'Watchdog', '🔄 Phoenix Protocol initiated - Recovering failed tasks...');

    // Mark failed tasks as PENDING with incremented retry count
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.status === 'FAILED' && t.retry_count < t.max_retries
            ? { ...t, status: 'PENDING' as TaskStatus, retry_count: t.retry_count + 1 }
            : t
        )
      );

      setOrchestratorAlive(true);
      addLog('INFO', 'Orchestrator', '✅ Recovery complete - Tasks rescheduled');
    }, 2000);
  }, [addLog]);

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <Header
        workflow={workflow}
        tasks={tasks}
        orchestratorAlive={orchestratorAlive}
        isKilling={isKilling}
        onKill={handleKill}
        onRecover={handleRecover}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* DAG visualization area */}
        <div className="flex-1 relative overflow-auto p-4 bg-gray-950">
          <DAGVisualization tasks={tasks} recoveringIds={recoveringIds} />
          <Legend />
        </div>

        {/* Logs sidebar */}
        <div className="w-72 lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-sm">Activity Log</span>
            <span className="text-xs text-gray-600 ml-auto">{logs.length} events</span>
          </div>
          <LogTimeline logs={logs} />
        </div>
      </div>
    </div>
  );
}

export default App;
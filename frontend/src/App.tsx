import React, { useState, useEffect, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { Task, Workflow, LogEntry } from './types';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import WorkflowGraph from './components/WorkflowGraph';
import { LogTimeline } from './timeline/LogTimeline';
 
// ============ API Configuration ============
const API_BASE = 'http://localhost:3001';
const WATCHDOG_URL = 'http://localhost:3002'; // If Mrithika sets up watchdog
 
// Available workflows (fetched dynamically in production)
const AVAILABLE_WORKFLOWS = [
  { id: 'complex_fix_01', name: 'Deploy Microservice (11 tasks)' },
  { id: 'wf_planner_test_1768086507229', name: 'REST API Workflow (6 tasks)' },
  { id: 'wf_planner_test_1768083829673', name: 'FastAPI JWT Auth (6 tasks)' },
];
 
// ============ Main App ============
function App() {
  // State
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [orchestratorAlive, setOrchestratorAlive] = useState(true);
  const [isKilling, setIsKilling] = useState(false);
  const [workflowId, setWorkflowId] = useState<string>('complex_fix_01'); // Use existing workflow with 11 tasks
 
  // Fetch workflow details
  const fetchWorkflow = useCallback(async () => {
    try {
      // Note: Worker layer doesn't have a /workflows endpoint yet
      // For now, construct from tasks or add endpoint to worker layer
      const res = await fetch(`${API_BASE}/tasks?workflow_id=${workflowId}`);
      const tasksData: Task[] = await res.json();
      setTasks(tasksData);
 
      // Derive workflow status from tasks
      if (tasksData.length > 0) {
        const allCompleted = tasksData.every(t => t.status === 'COMPLETED');
        const anyFailed = tasksData.some(t => t.status === 'FAILED');
        const anyInProgress = tasksData.some(t => t.status === 'IN_PROGRESS');
 
        setWorkflow({
          _id: workflowId,
          goal: 'Deploy Minecraft Server on AWS', // Fetch from DB ideally
          status: allCompleted ? 'COMPLETED' : anyFailed ? 'FAILED' : anyInProgress ? 'RUNNING' : 'PENDING',
          created_at: new Date().toISOString(),
          context_summary: '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch workflow:', err);
    }
  }, [workflowId]);
 
  // Fetch logs from backend
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logs?workflow_id=${workflowId}&limit=50`);
      const logsData: LogEntry[] = await res.json();
      setLogs(logsData);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, [workflowId]);
 
  // Check orchestrator health
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setOrchestratorAlive(data.status === 'healthy');
    } catch {
      setOrchestratorAlive(false);
    }
  }, []);
 
  // Poll for updates
  useEffect(() => {
    fetchWorkflow();
    fetchLogs();
    checkHealth();
 
    const interval = setInterval(() => {
      fetchWorkflow();
      fetchLogs();
      checkHealth();
    }, 2000);
 
    return () => clearInterval(interval);
  }, [fetchWorkflow, fetchLogs, checkHealth]);
 
  // Kill orchestrator handler
  const handleKill = useCallback(async () => {
    setIsKilling(true);
 
    try {
      // If Mrithika's watchdog is running
      await fetch(`${WATCHDOG_URL}/admin/kill`, { method: 'POST' });
    } catch {
      // Fallback: Just update UI state
      console.log('Watchdog not available - simulating kill');
    }
 
    setOrchestratorAlive(false);
    setIsKilling(false);
 
    // Add local log for immediate feedback
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      component: 'Admin',
      message: '🔥 KILL SIGNAL SENT - Orchestrator terminated!',
      workflow_id: workflowId,
      task_id: undefined,
    }, ...prev]);
  }, [workflowId]);
 
  // Recovery handler
  const handleRecover = useCallback(async () => {
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      level: 'WARN',
      component: 'Watchdog',
      message: '🔄 Phoenix Protocol initiated - Recovering...',
      workflow_id: workflowId,
      task_id: undefined,
    }, ...prev]);
 
    // Recovery happens automatically when orchestrator restarts
    // The orchestrator's recovery loop will reset stuck tasks
    setTimeout(() => {
      setOrchestratorAlive(true);
      fetchWorkflow();
      fetchLogs();
    }, 2000);
  }, [workflowId, fetchWorkflow, fetchLogs]);
 
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
 
      {/* Workflow Selector */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3">
        <label className="text-sm text-gray-400">Workflow:</label>
        <select
          value={workflowId}
          onChange={(e) => setWorkflowId(e.target.value)}
          className="bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 text-sm focus:outline-none focus:border-orange-500"
        >
          {AVAILABLE_WORKFLOWS.map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500 font-mono">{workflowId}</span>
      </div>
 
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* DAG visualization area */}
        <div className="flex-1 relative overflow-hidden p-4 bg-gray-950">
          <WorkflowGraph
            workflowId={workflowId}
            apiUrl={`${API_BASE}/tasks`}
            pollInterval={2000}
          />
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
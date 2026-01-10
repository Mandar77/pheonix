import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { Task, Workflow, LogEntry, TaskStatus } from '../types';
import { usePolling } from './usePolling';

// Hook for fetching and polling workflow data
export function useWorkflow(workflowId: string) {
  const { data: workflow, isLoading: workflowLoading } = usePolling({
    fetchFn: () => api.getWorkflow(workflowId),
    interval: 2000,
    enabled: !!workflowId,
  });

  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = usePolling({
    fetchFn: () => api.getTasks(workflowId),
    interval: 1000, // Poll frequently for responsive UI
    enabled: !!workflowId,
  });

  const { data: logs, refetch: refetchLogs } = usePolling({
    fetchFn: () => api.getLogs(workflowId, 50),
    interval: 1000,
    enabled: !!workflowId,
  });

  return {
    workflow,
    tasks: tasks || [],
    logs: logs || [],
    isLoading: workflowLoading || tasksLoading,
    refetch: () => {
      refetchTasks();
      refetchLogs();
    },
  };
}

// Hook for tracking task recovery animations
export function useRecoveryTracker(tasks: Task[]) {
  const [recoveringIds, setRecoveringIds] = useState<Set<string>>(new Set());
  const prevStatusRef = useRef<Map<string, TaskStatus>>(new Map());

  useEffect(() => {
    const newRecovering = new Set<string>();

    tasks.forEach((task) => {
      const prevStatus = prevStatusRef.current.get(task._id);

      // Detect recovery: FAILED -> PENDING with retry_count > 0
      if (prevStatus === 'FAILED' && task.status === 'PENDING' && task.retry_count > 0) {
        newRecovering.add(task._id);

        // Clear recovery animation after 2 seconds
        setTimeout(() => {
          setRecoveringIds((prev) => {
            const next = new Set(prev);
            next.delete(task._id);
            return next;
          });
        }, 2000);
      }

      prevStatusRef.current.set(task._id, task.status);
    });

    if (newRecovering.size > 0) {
      setRecoveringIds((prev) => {
    const combined = new Set<string>(prev);
    newRecovering.forEach((id) => combined.add(id));
    return combined;
  });
    }
  }, [tasks]);

  return recoveringIds;
}

// Hook for orchestrator status and control
export function useOrchestrator() {
  const [isKilling, setIsKilling] = useState(false);
  
  const { data: status, refetch } = usePolling({
    fetchFn: () => api.getOrchestratorStatus(),
    interval: 2000,
  });

  const kill = useCallback(async () => {
    setIsKilling(true);
    try {
      await api.killOrchestrator();
      refetch();
    } catch (error) {
      console.error('Failed to kill orchestrator:', error);
    } finally {
      setIsKilling(false);
    }
  }, [refetch]);

  return {
    isAlive: status?.alive ?? true,
    uptime: status?.uptime ?? 0,
    isKilling,
    kill,
    refetch,
  };
}

// Hook for computing workflow statistics
export function useWorkflowStats(tasks: Task[]) {
  return {
    total: tasks.length,
    blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
    pending: tasks.filter((t) => t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    failed: tasks.filter((t) => t.status === 'FAILED').length,
    progress: tasks.length > 0
      ? Math.round((tasks.filter((t) => t.status === 'COMPLETED').length / tasks.length) * 100)
      : 0,
  };
}
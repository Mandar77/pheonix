import React from 'react';
import { Zap, Activity, Skull, RefreshCw, ChevronRight } from 'lucide-react';
import { Workflow, Task } from '../types';
import { useWorkflowStats } from '../hooks/useWorkflow';

interface HeaderProps {
  workflow: Workflow | null;
  tasks: Task[];
  orchestratorAlive: boolean;
  isKilling: boolean;
  onKill: () => void;
  onRecover: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  workflow,
  tasks,
  orchestratorAlive,
  isKilling,
  onKill,
  onRecover,
}) => {
  const stats = useWorkflowStats(tasks);

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <Zap className="w-7 h-7 text-orange-500" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Project Phoenix
          </h1>
          <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 hidden sm:inline">
            Failure-Resilient SRE
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Stats badges */}
          <div className="hidden md:flex gap-2 text-xs">
            <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded-full">
              ✓ {stats.completed}/{stats.total}
            </span>
            {stats.inProgress > 0 && (
              <span className="bg-blue-900/50 text-blue-400 px-2 py-1 rounded-full">
                ◐ {stats.inProgress} running
              </span>
            )}
            {stats.failed > 0 && (
              <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded-full">
                ✗ {stats.failed} failed
              </span>
            )}
          </div>

          {/* Orchestrator status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
              orchestratorAlive
                ? 'bg-green-900/50 text-green-400'
                : 'bg-red-900/50 text-red-400'
            }`}
          >
            <Activity
              className={`w-4 h-4 ${orchestratorAlive ? 'animate-pulse' : ''}`}
            />
            <span className="hidden sm:inline">
              {orchestratorAlive ? 'ALIVE' : 'DOWN'}
            </span>
          </div>

          {/* Kill / Recover button */}
          {orchestratorAlive ? (
            <button
              onClick={onKill}
              disabled={isKilling}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg font-semibold text-sm transition-all"
            >
              <Skull className="w-4 h-4" />
              <span className="hidden sm:inline">Kill</span>
            </button>
          ) : (
            <button
              onClick={onRecover}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-3 py-2 rounded-lg font-semibold text-sm transition-all animate-pulse"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Recover</span>
            </button>
          )}
        </div>
      </div>

      {/* Workflow info */}
      {workflow && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
          <span className="font-mono text-gray-500">{workflow._id}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="truncate">{workflow.goal}</span>
          <span
            className={`ml-2 px-2 py-0.5 rounded text-xs ${
              workflow.status === 'RUNNING'
                ? 'bg-blue-900/50 text-blue-400'
                : workflow.status === 'COMPLETED'
                ? 'bg-green-900/50 text-green-400'
                : workflow.status === 'FAILED'
                ? 'bg-red-900/50 text-red-400'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {workflow.status}
          </span>
        </div>
      )}
    </header>
  );
};

export default Header;
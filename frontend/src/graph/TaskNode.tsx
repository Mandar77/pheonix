import React from 'react';
import { Clock, Loader, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { GraphNode, TaskStatus } from '../types';
import { getStatusColor, getStatusBgColor } from './layout';

interface TaskNodeProps {
  node: GraphNode;
  width: number;
  height: number;
}

// Status icons mapping
const StatusIcon: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const iconClass = "w-4 h-4";
  
  switch (status) {
    case 'BLOCKED':
    case 'PENDING':
      return <Clock className={iconClass} />;
    case 'IN_PROGRESS':
      return <Loader className={`${iconClass} animate-spin`} />;
    case 'COMPLETED':
      return <CheckCircle className={iconClass} />;
    case 'FAILED':
      return <XCircle className={iconClass} />;
  }
};

export const TaskNode: React.FC<TaskNodeProps> = ({ node, width, height }) => {
  const { task, position, isRecovering } = node;
  const borderColor = getStatusColor(task.status);
  const bgColor = getStatusBgColor(task.status);

  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      {/* Background rectangle */}
      <rect
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={isRecovering ? 3 : 2}
        className="transition-all duration-300"
      >
        {/* Pulse animation for recovering tasks */}
        {isRecovering && (
          <animate
            attributeName="stroke-opacity"
            values="1;0.4;1"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </rect>

      {/* Content via foreignObject */}
      <foreignObject x={0} y={0} width={width} height={height}>
        <div className="w-full h-full p-3 flex flex-col justify-between">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ color: borderColor }}>
                <StatusIcon status={task.status} />
              </span>
              <span className="text-xs font-mono text-gray-500">
                {task._id.replace('task_', '#')}
              </span>
            </div>
            {task.retry_count > 0 && (
              <span className="text-xs text-orange-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {task.retry_count}/{task.max_retries}
              </span>
            )}
          </div>

          {/* Task type */}
          <div className="text-sm font-semibold text-white truncate">
            {task.type.replace('_', ' ')}
          </div>

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: borderColor,
                backgroundColor: bgColor,
                border: `1px solid ${borderColor}`,
              }}
            >
              {task.status}
            </span>
            {task.worker_lock && (
              <span className="text-xs text-gray-500 truncate max-w-[80px]">
                {task.worker_lock}
              </span>
            )}
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

export default TaskNode;
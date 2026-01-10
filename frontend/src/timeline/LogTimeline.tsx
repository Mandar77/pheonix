import React from 'react';
import { LogEntry, LogLevel } from '../types';

interface LogTimelineProps {
  logs: LogEntry[];
}

// Styling for different log levels
const levelStyles: Record<LogLevel, { text: string; bg: string }> = {
  INFO: { text: 'text-blue-400', bg: 'bg-blue-900/40' },
  WARN: { text: 'text-yellow-400', bg: 'bg-yellow-900/40' },
  ERROR: { text: 'text-red-400', bg: 'bg-red-900/40' },
};

const LogEntryItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const style = levelStyles[log.level];
  const time = new Date(log.timestamp).toLocaleTimeString();

  return (
    <div className="text-xs font-mono bg-gray-800/60 rounded p-2 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${style.text} ${style.bg}`}>
          {log.level}
        </span>
        <span className="text-gray-500">{time}</span>
        {log.task_id && (
          <span className="text-gray-600">
            {log.task_id.replace('task_', '#')}
          </span>
        )}
      </div>

      {/* Message */}
      <div className="text-gray-300 break-words">{log.message}</div>

      {/* Component */}
      <div className="text-gray-600 mt-1 truncate">{log.component}</div>
    </div>
  );
};

export const LogTimeline: React.FC<LogTimelineProps> = ({ logs }) => {
  return (
    <div className="h-full overflow-y-auto p-3 space-y-2">
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <div className="text-sm">No activity yet</div>
          <div className="text-xs mt-1">Waiting for events...</div>
        </div>
      ) : (
        logs.map((log, index) => (
          <LogEntryItem key={`${log.timestamp}-${index}`} log={log} />
        ))
      )}
    </div>
  );
};

export default LogTimeline;
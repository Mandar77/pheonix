import React from 'react';
import { TaskStatus } from '../types';
import { getStatusColor, getStatusBgColor } from '../graph/layout';

const statuses: TaskStatus[] = ['BLOCKED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];

export const Legend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-gray-900/95 backdrop-blur rounded-lg p-3 border border-gray-800 shadow-lg">
      <div className="text-xs text-gray-500 mb-2 font-medium">Task States</div>
      <div className="flex flex-wrap gap-3 text-xs">
        {statuses.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded border-2"
              style={{
                borderColor: getStatusColor(status),
                backgroundColor: getStatusBgColor(status),
              }}
            />
            <span style={{ color: getStatusColor(status) }}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Legend;
import React, { useMemo } from 'react';
import { Task } from '../types';
import { computeGraphLayout, getStatusColor } from './layout';
import TaskNode from './TaskNode';

interface DAGVisualizationProps {
  tasks: Task[];
  recoveringIds: Set<string>;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 90;

export const DAGVisualization: React.FC<DAGVisualizationProps> = ({
  tasks,
  recoveringIds,
}) => {
  // Compute layout whenever tasks change
  const { nodes, edges, width, height } = useMemo(
    () => computeGraphLayout(tasks, recoveringIds),
    [tasks, recoveringIds]
  );

  // Build position lookup for edge drawing
  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((node) => {
      map.set(node.task._id, node.position);
    });
    return map;
  }, [nodes]);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${Math.max(800, width)} ${Math.max(450, height)}`}
      className="overflow-visible"
    >
      {/* Arrow markers for edges */}
      <defs>
        <marker
          id="arrow-gray"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
        </marker>
        <marker
          id="arrow-yellow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#eab308" />
        </marker>
        <marker
          id="arrow-blue"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
        </marker>
        <marker
          id="arrow-green"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
        </marker>
        <marker
          id="arrow-red"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
        </marker>
      </defs>

      {/* Render edges */}
      {edges.map((edge) => {
        const sourcePos = positionMap.get(edge.source);
        const targetPos = positionMap.get(edge.target);

        if (!sourcePos || !targetPos) return null;

        // Calculate edge start and end points
        const x1 = sourcePos.x + NODE_WIDTH;
        const y1 = sourcePos.y + NODE_HEIGHT / 2;
        const x2 = targetPos.x;
        const y2 = targetPos.y + NODE_HEIGHT / 2;

        const color = getStatusColor(edge.sourceStatus);
        const isAnimated = edge.sourceStatus === 'IN_PROGRESS';

        // Determine marker based on status
        const markerMap: Record<string, string> = {
          BLOCKED: 'url(#arrow-gray)',
          PENDING: 'url(#arrow-yellow)',
          IN_PROGRESS: 'url(#arrow-blue)',
          COMPLETED: 'url(#arrow-green)',
          FAILED: 'url(#arrow-red)',
        };

        return (
          <path
            key={`${edge.source}-${edge.target}`}
            d={`M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2},${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={2}
            markerEnd={markerMap[edge.sourceStatus]}
            strokeDasharray={isAnimated ? '8,4' : 'none'}
            className="transition-all duration-300"
          >
            {isAnimated && (
              <animate
                attributeName="stroke-dashoffset"
                from="12"
                to="0"
                dur="0.6s"
                repeatCount="indefinite"
              />
            )}
          </path>
        );
      })}

      {/* Render nodes */}
      {nodes.map((node) => (
        <TaskNode
          key={node.task._id}
          node={node}
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
        />
      ))}
    </svg>
  );
};

export default DAGVisualization;
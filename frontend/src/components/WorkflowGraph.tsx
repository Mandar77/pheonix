import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Activity, Play, CheckCircle, Clock, AlertCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
 
// ============ TYPES ============
interface Task {
  _id: string;
  workflow_id: string;
  type: string;
  status: 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  description: string;
  dependencies?: string[];
  retry_count?: number;
}
 
interface WorkflowGraphProps {
  workflowId?: string;
  apiUrl?: string;
  pollInterval?: number;
}
 
interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  isRecovering: boolean;
}
 
// Custom node type for React Flow
type TaskNode = Node<TaskNodeData, 'taskNode'>;
 
// ============ CONSTANTS ============
const DEFAULT_API_URL = 'http://localhost:3001/tasks';
const DEFAULT_POLL_INTERVAL = 2000;
const NODE_WIDTH = 260;
const NODE_HEIGHT = 90;
 
// Status colors (matching Mandar's docs + recovery state)
const STATUS_CONFIG = {
  BLOCKED: { color: '#6B7280', bg: 'bg-gray-800', border: 'border-gray-600', icon: Clock },
  PENDING: { color: '#FBBF24', bg: 'bg-yellow-900/80', border: 'border-yellow-500', icon: Play },
  IN_PROGRESS: { color: '#3B82F6', bg: 'bg-blue-900/80', border: 'border-blue-500', icon: Activity },
  COMPLETED: { color: '#10B981', bg: 'bg-green-900/80', border: 'border-green-500', icon: CheckCircle },
  FAILED: { color: '#EF4444', bg: 'bg-red-900/80', border: 'border-red-500', icon: XCircle },
  RECOVERING: { color: '#8B5CF6', bg: 'bg-purple-900/80', border: 'border-purple-500', icon: RefreshCw },
} as const;
 
// ============ CUSTOM NODE COMPONENT ============
const TaskNodeComponent: React.FC<NodeProps<TaskNode>> = ({ data }) => {
  const { task, isRecovering } = data;
  const status = isRecovering ? 'RECOVERING' : task.status;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.BLOCKED;
  const IconComponent = config.icon;
 
  return (
    <div
      className={`
        ${config.bg} ${config.border} border-2 rounded-lg p-3 w-[250px]
        shadow-lg transition-all duration-300
        ${status === 'IN_PROGRESS' ? 'animate-pulse' : ''}
        ${isRecovering ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span
          className="font-bold text-xs uppercase tracking-wider"
          style={{ color: config.color }}
        >
          {task.type}
        </span>
        <div className="flex items-center gap-1">
          {isRecovering && (
            <span className="text-[10px] bg-purple-600 px-1.5 py-0.5 rounded text-white">
              RETRY #{task.retry_count}
            </span>
          )}
          <IconComponent
            className={`w-4 h-4 ${status === 'IN_PROGRESS' ? 'animate-spin' : ''}`}
            style={{ color: config.color }}
          />
        </div>
      </div>
 
      {/* Task ID */}
      <div className="font-semibold text-sm text-gray-200 truncate">
        {task._id.split('_').slice(-2).join('_')}
      </div>
 
      {/* Description */}
      <div className="text-xs mt-1 text-gray-400 truncate" title={task.description}>
        {task.description}
      </div>
 
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
};
 
// Register custom node types
const nodeTypes = { taskNode: TaskNodeComponent };
 
// ============ LAYOUT ENGINE ============
const getLayoutedElements = (nodes: TaskNode[], edges: Edge[]): { nodes: TaskNode[]; edges: Edge[] } => {
  if (nodes.length === 0) return { nodes: [], edges: [] };
 
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',
    nodesep: 80,
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  });
 
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
 
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
 
  dagre.layout(dagreGraph);
 
  const layoutedNodes: TaskNode[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
 
  return { nodes: layoutedNodes, edges };
};
 
// ============ DATA TRANSFORMATION ============
const transformTasksToGraph = (tasks: Task[]): { nodes: TaskNode[]; edges: Edge[] } => {
  const nodes: TaskNode[] = tasks.map((task) => {
    const isRecovering = (task.retry_count ?? 0) > 0 && task.status === 'PENDING';
 
    return {
      id: task._id,
      type: 'taskNode' as const,
      data: { task, isRecovering },
      position: { x: 0, y: 0 },
    };
  });
 
  const edges: Edge[] = tasks.flatMap((task) =>
    (task.dependencies ?? []).map((depId) => {
      const isActive = task.status === 'IN_PROGRESS';
      const isRecovering = (task.retry_count ?? 0) > 0;
 
      return {
        id: `e-${depId}-${task._id}`,
        source: depId,
        target: task._id,
        animated: isActive,
        style: {
          stroke: isRecovering ? '#8B5CF6' : '#64748b',
          strokeWidth: isActive ? 3 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isRecovering ? '#8B5CF6' : '#64748b',
        },
      };
    })
  );
 
  return getLayoutedElements(nodes, edges);
};
 
// ============ MAIN COMPONENT ============
const WorkflowGraph: React.FC<WorkflowGraphProps> = ({
  workflowId,
  apiUrl = DEFAULT_API_URL,
  pollInterval = DEFAULT_POLL_INTERVAL,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<TaskNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
 
  // Fetch and transform data
  const fetchGraph = useCallback(async () => {
    if (!workflowId) return;
 
    try {
      const response = await fetch(`${apiUrl}?workflow_id=${workflowId}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
 
      const tasks: Task[] = await response.json();
 
      if (tasks.length === 0) {
        setNodes([]);
        setEdges([]);
        setError('No tasks found for this workflow');
        return;
      }
 
      const { nodes: newNodes, edges: newEdges } = transformTasksToGraph(tasks);
      setNodes(newNodes);
      setEdges(newEdges);
      setError(null);
    } catch (err) {
      console.error('Graph fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow');
    } finally {
      setLoading(false);
    }
  }, [workflowId, apiUrl, setNodes, setEdges]);
 
  // Initial fetch + polling
  useEffect(() => {
    setLoading(true);
    fetchGraph();
 
    const interval = setInterval(fetchGraph, pollInterval);
    return () => clearInterval(interval);
  }, [fetchGraph, pollInterval]);
 
  // Memoized minimap node color
  const minimapNodeColor = useCallback((node: TaskNode) => {
    const { task, isRecovering } = node.data;
    const status = isRecovering ? 'RECOVERING' : task.status;
    return STATUS_CONFIG[status]?.color ?? '#6B7280';
  }, []);
 
  // Empty state
  if (!workflowId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a workflow to view graph</p>
        </div>
      </div>
    );
  }
 
  // Loading state
  if (loading && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 border border-gray-700 rounded-xl">
        <div className="text-center text-gray-400">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p>Loading workflow graph...</p>
        </div>
      </div>
    );
  }
 
  // Error state
  if (error && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 border border-gray-700 rounded-xl">
        <div className="text-center text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>{error}</p>
          <button
            onClick={() => fetchGraph()}
            className="mt-2 px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
 
  return (
    <div className="w-full h-full min-h-[500px] bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-2xl relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls className="!bg-gray-800 !border-gray-700 !rounded-lg" />
        <MiniMap
          style={{ height: 100, backgroundColor: '#1f2937' }}
          nodeColor={minimapNodeColor}
          maskColor="rgba(0, 0, 0, 0.7)"
          zoomable
          pannable
        />
      </ReactFlow>
 
      {/* Connection status indicator */}
      {error && nodes.length > 0 && (
        <div className="absolute top-2 right-2 bg-red-900/80 text-red-300 text-xs px-2 py-1 rounded">
          ⚠ Connection issue - showing cached data
        </div>
      )}
    </div>
  );
};
 
export default WorkflowGraph;
 
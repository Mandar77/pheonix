import React, { useEffect, useCallback } from 'react';
import { 
  ReactFlow,
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  MarkerType,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import axios from 'axios';
import { Activity, Play, CheckCircle, Clock, AlertCircle } from 'lucide-react';

// --- Types ---
interface Task {
  _id: string;
  workflow_id: string;
  type: string;
  status: 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  description: string;
  dependencies?: string[];
}

interface WorkflowGraphProps {
  workflowId?: string;
}

const API_URL = 'http://localhost:3001/tasks';

// --- Layout Engine (Dagre) ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB' }); // TB = Top to Bottom

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// --- Styling Helper ---
const getNodeStyle = (status: string) => {
  const base = "p-4 rounded-lg shadow-lg border-2 w-[250px] text-left";
  switch (status) {
    case 'COMPLETED': return `${base} bg-green-900/80 border-green-500 text-green-100`;
    case 'IN_PROGRESS': return `${base} bg-blue-900/80 border-blue-500 text-blue-100 animate-pulse`;
    case 'BLOCKED': return `${base} bg-gray-800 border-red-900 text-gray-500 opacity-70`;
    case 'PENDING': return `${base} bg-yellow-900/80 border-yellow-500 text-yellow-100`;
    default: return `${base} bg-gray-800 border-gray-600 text-gray-300`;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'COMPLETED': return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'IN_PROGRESS': return <Activity className="w-5 h-5 text-blue-400 animate-spin" />;
    case 'BLOCKED': return <Clock className="w-5 h-5 text-gray-500" />;
    case 'PENDING': return <Play className="w-5 h-5 text-yellow-400" />;
    default: return <AlertCircle className="w-5 h-5" />;
  }
};

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ workflowId }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  // If no workflowId is passed, show nothing
  if (!workflowId) {
    return (
        <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900 border border-gray-700 rounded-xl">
            Select a workflow to view graph
        </div>
    );
  }

  const fetchGraph = useCallback(async () => {
    try {
      const res = await axios.get<Task[]>(API_URL);
      const allTasks = res.data;
      const tasks = allTasks.filter(t => t.workflow_id === workflowId);

      if (tasks.length === 0) return;

      const newNodes: Node[] = tasks.map((task) => ({
        id: task._id,
        type: 'default', // Using default node type with custom label
        data: { 
          label: (
            <div className={getNodeStyle(task.status)}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-xs uppercase tracking-wider opacity-70">{task.type}</span>
                {getStatusIcon(task.status)}
              </div>
              <div className="font-semibold text-sm truncate">{task._id.split('_').pop()}</div>
              <div className="text-xs mt-1 opacity-80 truncate">{task.description}</div>
            </div>
          ) 
        },
        position: { x: 0, y: 0 }
      }));

      const newEdges: Edge[] = [];
      tasks.forEach((task) => {
        if (task.dependencies) {
          task.dependencies.forEach((depId) => {
            newEdges.push({
              id: `e-${depId}-${task._id}`,
              source: depId,
              target: task._id,
              animated: task.status === 'IN_PROGRESS',
              style: { stroke: '#64748b', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
            });
          });
        }
      });

      const layouted = getLayoutedElements(newNodes, newEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);

    } catch (err) {
      console.error("Graph fetch error:", err);
    }
  }, [workflowId, setNodes, setEdges]);

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 2000);
    return () => clearInterval(interval);
  }, [fetchGraph]);

  return (
    <div className="w-full h-full min-h-[500px] bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background color="#374151" gap={16} />
        <Controls />
        <MiniMap 
            style={{ height: 100, backgroundColor: '#1f2937' }} 
            nodeColor={() => '#4b5563'}
            maskColor="rgba(0, 0, 0, 0.6)"
            zoomable 
            pannable 
        />
      </ReactFlow>
    </div>
  );
}

export default WorkflowGraph;
import { Task, TaskStatus, NodePosition, GraphNode, GraphEdge } from '../types';

interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalGap: number;
  padding: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 180,
  nodeHeight: 90,
  horizontalGap: 220,
  verticalGap: 110,
  padding: 60,
};

// Compute the layer (depth) for each task using dependency analysis
function computeLayers(tasks: Task[]): Map<string, number> {
  const layers = new Map<string, number>();
  const taskMap = new Map(tasks.map((t) => [t._id, t]));

  const getLayer = (taskId: string, visited: Set<string> = new Set()): number => {
    // Return cached result
    if (layers.has(taskId)) return layers.get(taskId)!;
    
    // Cycle detection
    if (visited.has(taskId)) return 0;
    visited.add(taskId);

    const task = taskMap.get(taskId);
    
    // Root nodes (no dependencies) are at layer 0
    if (!task || task.dependencies.length === 0) {
      layers.set(taskId, 0);
      return 0;
    }

    // Layer = max dependency layer + 1
    const maxDepLayer = Math.max(
      ...task.dependencies
        .filter((depId) => taskMap.has(depId))
        .map((depId) => getLayer(depId, visited))
    );

    const layer = maxDepLayer + 1;
    layers.set(taskId, layer);
    return layer;
  };

  // Compute layer for all tasks
  tasks.forEach((task) => getLayer(task._id));
  
  return layers;
}

// Main layout function - converts tasks to positioned graph nodes and edges
export function computeGraphLayout(
  tasks: Task[],
  recoveringIds: Set<string>,
  config: Partial<LayoutConfig> = {}
): { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const taskMap = new Map(tasks.map((t) => [t._id, t]));

  // Compute layers
  const layers = computeLayers(tasks);

  // Group tasks by layer
  const layerGroups = new Map<number, Task[]>();
  tasks.forEach((task) => {
    const layer = layers.get(task._id) || 0;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(task);
  });

  // Sort tasks within each layer for consistent rendering
  layerGroups.forEach((group) => {
    group.sort((a, b) => a._id.localeCompare(b._id));
  });

  // Compute positions
  const positions = new Map<string, NodePosition>();
  const maxLayer = Math.max(...Array.from(layers.values()), 0);

  layerGroups.forEach((layerTasks, layer) => {
    const layerHeight = layerTasks.length * cfg.nodeHeight + 
                        (layerTasks.length - 1) * (cfg.verticalGap - cfg.nodeHeight);
    const startY = cfg.padding;

    layerTasks.forEach((task, index) => {
      positions.set(task._id, {
        x: cfg.padding + layer * cfg.horizontalGap,
        y: startY + index * cfg.verticalGap,
      });
    });
  });

  // Build graph nodes
  const nodes: GraphNode[] = tasks.map((task) => ({
    task,
    position: positions.get(task._id) || { x: 0, y: 0 },
    isRecovering: recoveringIds.has(task._id),
  }));

  // Build edges
  const edges: GraphEdge[] = [];
  tasks.forEach((task) => {
    task.dependencies.forEach((depId) => {
      const sourceTask = taskMap.get(depId);
      if (sourceTask) {
        edges.push({
          source: depId,
          target: task._id,
          sourceStatus: sourceTask.status,
        });
      }
    });
  });

  // Calculate total dimensions
  const width = cfg.padding * 2 + (maxLayer + 1) * cfg.horizontalGap;
  const maxNodesInLayer = Math.max(...Array.from(layerGroups.values()).map((g) => g.length));
  const height = cfg.padding * 2 + maxNodesInLayer * cfg.verticalGap;

  return { nodes, edges, width, height };
}

// Get color for task status
export function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    BLOCKED: '#6b7280',   // gray
    PENDING: '#eab308',   // yellow
    IN_PROGRESS: '#3b82f6', // blue
    COMPLETED: '#22c55e', // green
    FAILED: '#ef4444',    // red
  };
  return colors[status];
}

// Get background color (with transparency) for task status
export function getStatusBgColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    BLOCKED: 'rgba(107, 114, 128, 0.3)',
    PENDING: 'rgba(234, 179, 8, 0.2)',
    IN_PROGRESS: 'rgba(59, 130, 246, 0.25)',
    COMPLETED: 'rgba(34, 197, 94, 0.2)',
    FAILED: 'rgba(239, 68, 68, 0.25)',
  };
  return colors[status];
}
import React, { useCallback, useRef, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import type { ReactFlowInstance, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { ReactorNode, StorageNode, ProcessNode, WasherNode, DryerNode, PackagerNode, SurgeBufferNode } from './CustomNodes';
import { FlowingEdge } from './FlowingEdge';
import { NodeEditor } from './NodeEditor';
import { useSimulationStore } from '../../store/simulationStore';

// ── Stable references — MUST be defined outside component to prevent React Flow warnings
const NODE_TYPES = {
  reactor: ReactorNode,
  storage: StorageNode,
  process: ProcessNode,
  washer: WasherNode,
  dryer: DryerNode,
  packager: PackagerNode,
  buffer: SurgeBufferNode,
};

const EDGE_TYPES = {
  flowing: FlowingEdge,
};

export const PlantCanvas: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const nodes = useSimulationStore(state => state.nodes);
  const edges = useSimulationStore(state => state.edges);
  const onNodesChange = useSimulationStore(state => state.onNodesChange);
  const onEdgesChange = useSimulationStore(state => state.onEdgesChange);
  const onConnect = useSimulationStore(state => state.onConnect);
  const setNodes = useSimulationStore(state => state.setNodes);
  const isSimulating = useSimulationStore(state => state.isSimulating);
  const currentTick = useSimulationStore(state => state.tick);
  
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const pollInterval = useSimulationStore(state => state.pollInterval);

  const containerStyle = {
    '--sim-transition-duration': `${pollInterval}ms`
  } as React.CSSProperties;

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.current.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: { 
            label: label || `${type} ${nodes.length + 1}`,
            status: 'idle',
            temp: 25,
            conversion: 0,
            capacity: 5000,
            currentLevel: 0,
            materialType: type === 'storage' ? 'Chemical' : undefined
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, nodes, setNodes]
  );

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setEditingNodeId(node.id);
  }, []);

  return (
    <div className="w-full h-full bg-slate-50 relative" ref={reactFlowWrapper} style={containerStyle}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => (reactFlowInstance.current = instance)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        <Controls className="!bg-white !border-slate-200 !fill-slate-600 !shadow-sm" />
      </ReactFlow>
      
      {isSimulating && (
        <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-3 shadow-xl z-50">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="font-black uppercase tracking-widest text-[9px]">Live · T+{currentTick}min</span>
        </div>
      )}

      {/* Node Editor Modal */}
      {editingNodeId && (
        <NodeEditor nodeId={editingNodeId} onClose={() => setEditingNodeId(null)} />
      )}
    </div>
  );
};

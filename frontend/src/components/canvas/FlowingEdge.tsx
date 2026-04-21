import React from 'react';
import { getBezierPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { useSimulationStore } from '../../store/simulationStore';

// Color map per source node type
const FLOW_COLORS: Record<string, string> = {
  storage:  '#38bdf8',  // Sky blue — monomer feed
  reactor:  '#a78bfa',  // Purple — wet copolymer beads
  washer:   '#fb923c',  // Orange — wet slurry
  buffer:   '#34d399',  // Emerald — buffered WIP
  dryer:    '#10b981',  // Green — dried product
};

export const FlowingEdge: React.FC<EdgeProps> = ({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  style = {},
  source,
}) => {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  
  // STABLE TRACE ID: By prefixed 'trace-path-' to the React Flow edge id, 
  // we ensure the path element is uniquely identifiable by <mpath> without 
  // any random suffixes that break animation loops during component re-renders.
  const traceId = `trace-path-${id}`;

  // Global simulation state
  const isSimulating = useSimulationStore(state => state.isSimulating);
  const nodes = useSimulationStore(state => state.nodes);
  
  // Node-specific logic
  const sourceNode = nodes.find(n => n.id === source);
  const sourceType = sourceNode?.type ?? 'storage';
  const nodeStatus = sourceNode?.data?.status ?? 'idle';
  
  // Flow logic: release particles only when the source node is actually running.
  const isActuallyRunning = isSimulating && nodeStatus === 'running';
  
  const color = FLOW_COLORS[sourceType] ?? '#94a3b8';
  const strokeColor = (style as React.CSSProperties & { stroke?: string }).stroke ?? color;
  
  // Robust visual style (Industrial Neon pipes)
  const pipeWidth = isActuallyRunning ? 4.5 : 2;
  const pipeOpacity = isActuallyRunning ? 0.85 : 0.25;

  return (
    <>
      <path
        id={traceId}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={pipeWidth}
        strokeDasharray="none" 
        strokeLinecap="round"
        opacity={pipeOpacity}
        className="transition-all duration-700 pointer-events-none"
      />

      {isActuallyRunning && (
        <>
          {/* High-intensity Glow Particle (Leading) */}
          <circle r={8} fill={color} opacity={1} filter="url(#glow)">
            <animateMotion
              dur="2.5s"
              repeatCount="indefinite"
              rotate="auto"
              begin="0s"
              calcMode="spline"
              keySplines="0.4 0 0.6 1"
            >
              <mpath href={`#${traceId}`} />
            </animateMotion>
          </circle>

          {/* Secondary Trail Particle */}
          <circle r={5} fill={color} opacity={0.65} filter="url(#glow)">
            <animateMotion
              dur="2.5s"
              repeatCount="indefinite"
              rotate="auto"
              begin="-1.25s"
              calcMode="spline"
              keySplines="0.4 0 0.6 1"
            >
              <mpath href={`#${traceId}`} />
            </animateMotion>
          </circle>
          
          {/* High-brightness core */}
          <circle r={3.5} fill="#fff" opacity={0.95}>
            <animateMotion
              dur="2.5s"
              repeatCount="indefinite"
              rotate="auto"
              begin="-0.4s"
              calcMode="spline"
              keySplines="0.4 0 0.6 1"
            >
              <mpath href={`#${traceId}`} />
            </animateMotion>
          </circle>
        </>
      )}
    </>
  );
};

"use client";

import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  type Edge,
  type Connection,
  type Node,
} from "reactflow";
import Dagre from "@dagrejs/dagre";

import "reactflow/dist/style.css";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const initialNodes = [
  {
    ...nodeDefaults,
    id: "1",
    position: {
      x: 75,
      y: 65,
    },
    data: { label: "default style 1" },
    type: "input",
  },
  {
    ...nodeDefaults,
    id: "2",
    position: {
      x: 275,
      y: 20,
    },
    data: { label: "default style 2" },
  },
  {
    ...nodeDefaults,
    id: "3",
    position: {
      x: 275,
      y: 110,
    },
    data: { label: "default style 3" },
  },
  {
    ...nodeDefaults,
    id: "4",
    position: {
      x: 475,
      y: 65,
    },
    data: { label: "Output" },
    type: "output",
  },
];

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
  },
  {
    id: "e1-3",
    source: "1",
    target: "3",
  },
  {
    id: "e2-e4",
    source: "2",
    target: "4",
  },
  {
    id: "e3-e4",
    source: "3",
    target: "4",
  },
];

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (
  nodes: Node<
    {
      label: string;
    },
    string | undefined
  >[],
  edges: Edge<any>[],
) => {
  g.setGraph({ rankdir: "LR" });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) => g.setNode(node.id, node));

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

export function FlowBoard() {
  return (
    <ReactFlowProvider>
      <LayoutFlow />
    </ReactFlowProvider>
  );
}

export function LayoutFlow() {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );

  const onLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);

    console.log({ layouted });

    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    window.requestAnimationFrame(() => {
      fitView();
    });
  }, [nodes, edges, setNodes, setEdges, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      proOptions={{ hideAttribution: true }}
      onConnect={onConnect}
      onLoad={onLayout}
      fitView
    >
      <Panel position="top-right">
        <button onClick={() => onLayout()}>horizontal layout</button>
      </Panel>
      <Background />
      <Controls />
    </ReactFlow>
  );
}

"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  type Edge,
  type Connection,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "reactflow";

import "reactflow/dist/style.css";
import {
  type RunEdgeProjection,
  type RunNodeProjection,
} from "~/server/api/routers/workflow";
import { Button } from "~/components/ui/button";
import { StarsIcon } from "lucide-react";
import { getLayoutedElements, toReactFlowNode } from "./flow-utils";
import RunNodeViewer from "./run-node-viewer";

const nodeTypes = {
  workflow: RunNodeViewer,
};

type RunViewerProps = {
  workflowNodes: Array<RunNodeProjection>;
  workflowEdges: Array<RunEdgeProjection>;
};
export function RunViewer({ workflowNodes, workflowEdges }: RunViewerProps) {
  return (
    <ReactFlowProvider>
      <LayoutFlow
        initialWorkflowEdges={workflowEdges}
        initialWorkflowNodes={workflowNodes}
      />
    </ReactFlowProvider>
  );
}

export function LayoutFlow({
  initialWorkflowNodes,
  initialWorkflowEdges,
}: {
  initialWorkflowNodes: Array<RunNodeProjection>;
  initialWorkflowEdges: Array<RunEdgeProjection>;
}) {
  const { fitView } = useReactFlow<RunNodeProjection, RunEdgeProjection>();

  const initialNodes: Array<Node<RunNodeProjection>> =
    initialWorkflowNodes.map(toReactFlowNode);
  const initialEdges: Array<Edge<RunEdgeProjection>> = initialWorkflowEdges.map(
    (wfe) => ({
      id: wfe.publicId,
      source: wfe.source,
      target: wfe.target,
    }),
  );

  const initialLayouted = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialEdges, initialNodes],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<RunNodeProjection>(
    initialLayouted.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<RunEdgeProjection>(
    initialLayouted.edges,
  );

  function handleEdgeChanges(changes: EdgeChange[]) {
    const nextChanges = changes.reduce((acc, change) => {
      if (
        change.type === "remove" ||
        change.type === "add" ||
        change.type === "select" ||
        change.type === "reset"
      ) {
        return acc;
      }

      return [...acc, change];
    }, [] as EdgeChange[]);
    onEdgesChange(nextChanges);
  }

  function handleNodeChanges(changes: NodeChange[]) {
    const nextChanges = changes.reduce((acc, change) => {
      if (change.type === "remove" || change.type === "add") {
        return acc;
      }

      return [...acc, change];
    }, [] as NodeChange[]);
    onNodesChange(nextChanges);
  }

  const onLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);

    console.log({ layouted });

    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    window.requestAnimationFrame(() => {
      fitView();
    });
  }, [nodes, edges, setNodes, setEdges, fitView]);

  function onNodesDelete(_: Node<RunNodeProjection>[]) {
    return;
  }

  function onEdgesDelete(_: Edge[]) {
    return;
  }

  function onConnect(_: Edge | Connection) {
    return;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodesConnectable={false}
      connectOnClick={false}
      edgesFocusable={false}
      nodeTypes={nodeTypes}
      onNodesDelete={onNodesDelete}
      onNodesChange={handleNodeChanges}
      onEdgesChange={handleEdgeChanges}
      proOptions={{ hideAttribution: true }}
      onConnect={onConnect}
      onEdgesDelete={onEdgesDelete}
      onLoad={onLayout}
      fitView
      className="bg-white"
    >
      <Panel position="top-left" className="flex gap-2">
        <Button
          variant={"outline"}
          size={"sm"}
          className="gap-2"
          onClick={() => onLayout()}
        >
          <StarsIcon size={16} />
          Cleanup Layout
        </Button>
      </Panel>
      <Background gap={14} />
      <Controls />
    </ReactFlow>
  );
}

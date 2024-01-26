"use client";

import { useCallback, useMemo } from "react";
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
import {
  type WorkflowEdgeProjection,
  type WorkflowNodeProjection,
} from "~/server/api/routers/workflow";
import WorkflowNode from "./WorkflowNode";
import { api } from "~/trpc/react";
import { toast } from "~/components/ui/use-toast";
import { TRPCClientErrorLike } from "@trpc/client";
import { AppRouter } from "~/server/api/root";
import { ToastAction } from "~/components/ui/toast";
import { useRouter } from "next/navigation";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const nodeTypes = {
  workflow: WorkflowNode,
};

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (
  nodes: Node<WorkflowNodeProjection>[],
  edges: Edge[],
) => {
  g.setGraph({ rankdir: "LR" });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      label: node.data.publicId,
      width: node.width!,
      height: node.height!,
    }),
  );

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);
      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

type FlowBoardProps = {
  workflowNodes: Array<WorkflowNodeProjection>;
  workflowEdges: Array<WorkflowEdgeProjection>;
};
export function FlowBoard({ workflowNodes, workflowEdges }: FlowBoardProps) {
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
  initialWorkflowEdges,
  initialWorkflowNodes,
}: {
  initialWorkflowEdges: Array<WorkflowEdgeProjection>;
  initialWorkflowNodes: Array<WorkflowNodeProjection>;
}) {
  const initialNodes: Array<Node<WorkflowNodeProjection>> =
    initialWorkflowNodes.map((wfn) => ({
      ...nodeDefaults,
      id: `${wfn.publicId}`,
      position: {
        x: 75,
        y: 65,
      },
      data: wfn,
      width: 307,
      height: 98,
      type: "workflow",
    }));
  const initialEdges = initialWorkflowEdges.map((wfe) => ({
    id: wfe.publicId,
    source: wfe.source,
    target: wfe.target,
  }));

  const initialLayouted = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialEdges, initialNodes],
  );

  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] =
    useNodesState<WorkflowNodeProjection>(initialLayouted.nodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<WorkflowEdgeProjection>(initialLayouted.edges);

  const router = useRouter();

  const connectNodes = api.workflow.connectNodes.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't save your changes",
        description: `${err.message}. Please try again.`,
        action: (
          <ToastAction
            onClick={() => window.location.reload()}
            altText={"Try again"}
          >
            Refresh
          </ToastAction>
        ),
      });
      router.refresh();
    },
  });

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      console.log("onConnect", { params });
      setEdges((els) => addEdge(params, els));
      if (params.source && params.target) {
        connectNodes.mutate({
          sourceId: params.source,
          targetId: params.target,
        });
      }
    },
    [connectNodes, setEdges],
  );

  const deleteEdge = api.workflow.deleteEdge.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't save your changes",
        description: `${err.message}. Please try again.`,
        action: (
          <ToastAction
            onClick={() => window.location.reload()}
            altText={"Try again"}
          >
            Refresh
          </ToastAction>
        ),
      });
      router.refresh();
    },
  });

  function onEdgesDelete(edges: Edge[]) {
    // Let's just assume only editing one for now
    const edge = edges[0];
    if (!edge) {
      return;
    }

    deleteEdge.mutate({
      sourceId: edge.source,
      targetId: edge.target,
    });
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      proOptions={{ hideAttribution: true }}
      onConnect={onConnect}
      onEdgesDelete={onEdgesDelete}
      onLoad={onLayout}
      fitView
      className="bg-white"
    >
      <Panel position="top-right">
        <button onClick={() => onLayout()}>Cleanup Layout</button>
      </Panel>
      <Background />
      <Controls />
    </ReactFlow>
  );
}

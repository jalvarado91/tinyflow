"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  type Edge,
  type Connection,
  type Node,
  type NodeChange,
} from "reactflow";

import "reactflow/dist/style.css";
import {
  type WorkflowEdgeProjection,
  type WorkflowNodeProjection,
} from "~/server/api/routers/workflow";
import WorkflowNode from "./workflow-node-editor";
import { api } from "~/trpc/react";
import { toast } from "~/components/ui/use-toast";
import { type TRPCClientErrorLike } from "@trpc/client";
import { type AppRouter } from "~/server/api/root";
import { ToastAction } from "~/components/ui/toast";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { CircleDot, Loader2, StarsIcon } from "lucide-react";
import { getLayoutedElements, toReactFlowNode } from "./flow-utils";

const nodeTypes = {
  workflow: WorkflowNode,
};

type WorkflowEditorProps = {
  workflowId: string;
  workflowNodes: Array<WorkflowNodeProjection>;
  workflowEdges: Array<WorkflowEdgeProjection>;
};
export function WorkflowEditor({
  workflowId,
  workflowNodes,
  workflowEdges,
}: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <LayoutFlow
        workflowId={workflowId}
        initialWorkflowEdges={workflowEdges}
        initialWorkflowNodes={workflowNodes}
      />
    </ReactFlowProvider>
  );
}

export function LayoutFlow({
  workflowId,
  initialWorkflowEdges,
  initialWorkflowNodes,
}: {
  workflowId: string;
  initialWorkflowEdges: Array<WorkflowEdgeProjection>;
  initialWorkflowNodes: Array<WorkflowNodeProjection>;
}) {
  const router = useRouter();
  const { fitView, getNode } = useReactFlow<
    WorkflowNodeProjection,
    WorkflowEdgeProjection
  >();

  const initialNodes: Array<Node<WorkflowNodeProjection>> =
    initialWorkflowNodes.map(toReactFlowNode);
  const initialEdges: Array<Edge<WorkflowEdgeProjection>> =
    initialWorkflowEdges.map((wfe) => ({
      id: wfe.publicId,
      source: wfe.source,
      target: wfe.target,
    }));

  const initialLayouted = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialEdges, initialNodes],
  );

  const [nodes, setNodes, onNodesChange] =
    useNodesState<WorkflowNodeProjection>(initialLayouted.nodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<WorkflowEdgeProjection>(initialLayouted.edges);

  // Don't allow removing the root node
  function shouldNodeBeRemoved(node: Node<WorkflowNodeProjection>) {
    return !node.data.isRoot;
  }
  function handleNodeChanges(changes: NodeChange[]) {
    const nextChanges = changes.reduce((acc, change) => {
      if (change.type === "remove") {
        const node = getNode(change.id);

        if (node && shouldNodeBeRemoved(node)) {
          return [...acc, change];
        }

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

  const createNode = api.workflow.createNode.useMutation({
    onSuccess: (data) => {
      router.refresh();
      const mappedNode = toReactFlowNode(data);
      setNodes((nodes) => [...nodes, mappedNode]);
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't save your changes",
        description: `${err.message}. Please refresh and try again.`,
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

  const deleteNodes = api.workflow.deleteNodes.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't save your changes",
        description: `${err.message}. Please refresh and try again.`,
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

  const connectNodes = api.workflow.connectNodes.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't save your changes",
        description: `${err.message}. Please refresh and try again.`,
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

  const deleteEdges = api.workflow.deleteEdges.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't save your changes",
        description: `${err.message}. Please refresh and try again.`,
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

  const onAddTask = useCallback(
    (type: "INPUT" | "NORMAL") => {
      createNode.mutate({ type: type, workflowId: workflowId });
    },
    [createNode, workflowId],
  );

  function onNodesDelete(nodes: Node<WorkflowNodeProjection>[]) {
    const notRoots = nodes.filter((n) => !n.data.isRoot);

    deleteNodes.mutate({
      workflowId: workflowId,
      nodes: notRoots.map((n) => n.data.publicId),
    });
  }

  function onEdgesDelete(edges: Edge[]) {
    deleteEdges.mutate({
      workflowId: workflowId,
      edges: edges.map((e) => ({
        sourceId: e.source,
        targetId: e.target,
      })),
    });
  }

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

  const isSaving =
    connectNodes.isLoading ||
    deleteEdges.isLoading ||
    createNode.isLoading ||
    deleteNodes.isLoading;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesDelete={onNodesDelete}
      onNodesChange={handleNodeChanges}
      onEdgesChange={(c) => (isSaving ? () => void {} : onEdgesChange(c))}
      proOptions={{ hideAttribution: true }}
      onConnect={(c) => (isSaving ? () => void {} : onConnect(c))}
      onEdgesDelete={(c) => (isSaving ? () => void {} : onEdgesDelete(c))}
      onLoad={onLayout}
      fitView
      className="bg-white"
    >
      {isSaving && (
        <Panel position="top-right" className="animate-in fade-in">
          <div className="flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm">
            <Loader2 className="animate-spin" size={18} />
            Saving changes
          </div>
        </Panel>
      )}
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
        <Button
          onClick={() => onAddTask("INPUT")}
          disabled={createNode.isLoading}
          size={"sm"}
          variant={"outline"}
          className="gap-2"
        >
          Add Input Task <CircleDot size={16} />
        </Button>
        <Button
          onClick={() => onAddTask("NORMAL")}
          disabled={createNode.isLoading}
          size={"sm"}
          variant={"outline"}
          className="gap-2"
        >
          <CircleDot size={16} /> Add Task <CircleDot size={16} />
        </Button>
      </Panel>
      <Background gap={14} />
      <Controls />
    </ReactFlow>
  );
}

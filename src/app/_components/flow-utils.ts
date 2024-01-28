import Dagre from "@dagrejs/dagre";
import {
  type WorkflowEdgeProjection,
  type WorkflowNodeProjection,
} from "~/server/api/routers/workflow";
import { Position, type Edge, type Node } from "reactflow";

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

export const getLayoutedElements = (
  nodes: Node<WorkflowNodeProjection>[],
  edges: Edge<WorkflowEdgeProjection>[],
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

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};
export function toReactFlowNode(wfn: WorkflowNodeProjection) {
  return {
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
  };
}

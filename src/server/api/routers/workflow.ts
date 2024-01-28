import { z } from "zod";
import { ulid } from "ulid";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type ObjectId, type Db } from "mongodb";
import { env } from "~/env";
import { createProjectWebhook, createService } from "~/server/railway-client";

function workflowId() {
  return `wf_${ulid()}`;
}

function workflowNodeId() {
  return `wfn_${ulid()}`;
}

function workflowEdgeId() {
  return `wfe_${ulid()}`;
}

function workflowRunId() {
  return `wfr_${ulid()}`;
}

export interface RunNodeServiceMapping {
  nodeId: string;
  railwayServiceId: string;
}
export interface RunNodeDepStatus {
  nodeId: string;
  recordedStatus: "DEPLOYING" | "FAILED" | "SUCCESS";
  recoredAt: Date;
}

export type RunStatus = "PREPARING" | "RUNNING" | "FAILED" | "COMPLETED";
export interface WorkflowRun {
  publicId: string;
  workflowId: ObjectId;
  workflowPublicId: string;
  status: RunStatus;
  startedAt: Date;
  updatedAt: Date;
  nodes: Array<WorkflowNode>;
  edges: Array<WorkflowEdge>;
  nodesServiceMappings: Array<RunNodeServiceMapping>;
  nodeDeploymentStatuses: Array<RunNodeDepStatus>;
}

export type RunProjection = ReturnType<typeof runProjection>;
export type RunServiceMapProjection = RunProjection["nodesServiceMappings"][0];
export type RunDeploymentStatusProjection =
  RunProjection["nodeDeploymentStatuses"][0];

export type RunNodesProjection = WorkflowProjection["nodes"][0];
export type RunEdgesProjection = WorkflowProjection["edges"][0];

export function runProjection(r: WorkflowRun) {
  return {
    publicId: r.publicId,
    workflowPublicId: r.workflowPublicId,
    startedAt: r.startedAt,
    updatedAt: r.updatedAt,
    status: r.status,
    nodesServiceMappings: r.nodesServiceMappings.map((sm) => ({
      nodeId: sm.nodeId,
      railwayServiceId: sm.railwayServiceId,
    })),
    nodeDeploymentStatuses: r.nodeDeploymentStatuses.map((ds) => ({
      nodeId: ds.nodeId,
      recoredAt: ds.recoredAt,
      recoredStatus: ds.recordedStatus,
    })),
    nodes: r.nodes.map((n) => ({
      publicId: n.publicId,
      name: n.name,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      isRoot: n.isRoot,
      isInput: n.isInput,
      containerImage: n.containerImage,
      variables: n.variables,
    })),
    edges: r.edges.map((e) => ({
      publicId: e.publicId,
      source: e.source,
      target: e.target,
    })),
  };
}

export type WorkflowNodeVariables = Array<{
  name: string;
  value: string;
}>;

export interface WorkflowNode {
  publicId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  containerImage?: string;
  variables: WorkflowNodeVariables;
  isRoot: boolean;
  isInput: boolean;
}

export interface WorkflowEdge {
  publicId: string;
  source: string;
  target: string;
}

export interface Workflow {
  publicId: string;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  name: string;
  apiKey: string;
  nodes: Array<WorkflowNode>;
  edges: Array<WorkflowEdge>;
}

export type WorkflowProjection = ReturnType<typeof workflowProjection>;
export type WorkflowNodeProjection = WorkflowProjection["nodes"][0];
export type WorkflowEdgeProjection = WorkflowProjection["edges"][0];

export function workflowProjection(wf: Workflow) {
  return {
    publicId: wf.publicId,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
    projectId: wf.projectId,
    name: wf.name,
    apiKey: wf.apiKey,
    isValidDag: isValidDag(wf.nodes, wf.edges),
    isRunnable: wf.nodes.every((n) => Boolean(n.containerImage)),
    nodes: wf.nodes.map((n) => ({
      publicId: n.publicId,
      name: n.name,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      isRoot: n.isRoot,
      isInput: n.isInput,
      containerImage: n.containerImage,
      variables: n.variables,
    })),
    edges: wf.edges.map((e) => ({
      publicId: e.publicId,
      source: e.source,
      target: e.target,
    })),
  } as const;
}

async function createWorkflow(
  db: Db,
  {
    projectId,
    name,
    apiKey,
  }: {
    projectId: string;
    name: string;
    apiKey: string;
  },
) {
  const inputId = workflowNodeId();
  const someNodeJsId = workflowNodeId();
  const somePythonId = workflowNodeId();
  const outputId = workflowNodeId();
  const now = new Date();

  const wf = {
    publicId: workflowId(),
    createdAt: now,
    updatedAt: now,
    projectId: projectId,
    name: name,
    apiKey: apiKey,
    nodes: [
      {
        name: `Input Task`,
        createdAt: now,
        updatedAt: now,
        publicId: inputId,
        isRoot: false,
        isInput: true,
        containerImage: "hello-world",
        variables: [],
      },
      {
        name: `Some nodejs`,
        createdAt: now,
        updatedAt: now,
        publicId: someNodeJsId,
        isRoot: false,
        isInput: false,
        containerImage: "jalvarado91/tinyflow-samples-ex1-node:latest",
        variables: [],
      },
      {
        name: `Some python`,
        createdAt: now,
        updatedAt: now,
        publicId: somePythonId,
        isRoot: false,
        isInput: true,
        containerImage: "jalvarado91/tinyflow-samples-ex1-python:latest",
        variables: [],
      },
      {
        name: `Output Task`,
        createdAt: now,
        updatedAt: now,
        publicId: outputId,
        isRoot: true,
        isInput: false,
        containerImage: "hello-world",
        variables: [],
      },
    ],
    edges: [
      {
        publicId: workflowEdgeId(),
        source: inputId,
        target: someNodeJsId,
      },
      {
        publicId: workflowEdgeId(),
        source: someNodeJsId,
        target: outputId,
      },
      {
        publicId: workflowEdgeId(),
        source: somePythonId,
        target: outputId,
      },
    ],
  } satisfies Workflow;

  const collection = db.collection<Workflow>("workflow");
  const { insertedId } = await collection.insertOne(wf);
  const nWf = await collection.findOne({
    _id: insertedId,
  });

  if (!nWf) {
    throw new Error(
      `Couldn't create workflow ${name} for project ${projectId}`,
    );
  }

  const webhookUrl = `${env.PUBLIC_URL}/api/webhooks/railway/${nWf.publicId}`;
  const createWebhookRes = await createProjectWebhook(
    nWf.apiKey,
    nWf.projectId,
    webhookUrl,
  );

  console.log({ webhookUrl, createWebhookRes });

  return nWf;
}

export async function getWorkFlow(db: Db, publicId: string) {
  const collection = db.collection<Workflow>("workflow");
  const nWf = await collection.findOne({
    publicId: publicId,
  });

  if (!nWf) {
    throw new Error(`Couldn't find workflow with publicId: ${publicId}`);
  }

  return nWf;
}

async function getLatestWorkflow(db: Db) {
  const collection = db.collection<Workflow>("workflow");
  const res = await collection
    .find()
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  if (res.length === 0 || !res[0]) {
    throw new Error(`Couldn't find latest workflow`);
  }

  return res[0];
}

const updateWfNodeValuesSchema = z.object({
  name: z.string().min(1),
  containerImage: z.string().min(1),
  variables: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});
type UpdateWfNodeValues = z.infer<typeof updateWfNodeValuesSchema>;

async function updateWorkflowNode(
  db: Db,
  nodeId: string,
  values: UpdateWfNodeValues,
) {
  const collection = db.collection<Workflow>("workflow");
  const findWfRes = await collection.findOne({
    nodes: {
      $elemMatch: {
        publicId: nodeId,
      },
    },
  });

  if (!findWfRes) {
    throw new Error(`Couldn't find workflow by node with id ${nodeId}`);
  }

  const workflow = findWfRes;
  const relevantNode = workflow.nodes.find((n) => n.publicId === nodeId);

  if (!relevantNode) {
    throw new Error(`Node with id ${nodeId} doesn't exist in workflow`);
  }

  const now = new Date();
  const newRelevantNode = {
    ...relevantNode,
    name: values.name,
    containerImage: values.containerImage,
    variables: values.variables ?? relevantNode.variables,
    updatedAt: now,
  } satisfies WorkflowNode;

  const restOfNodes = workflow.nodes.filter((n) => n.publicId !== nodeId);
  const updatedNodes = [...restOfNodes, newRelevantNode];

  await collection.updateOne(
    { _id: workflow._id },
    {
      $set: {
        nodes: updatedNodes,
        updatedAt: now,
      },
    },
  );

  return newRelevantNode;
}

async function createWorkflowNode(
  db: Db,
  workflowId: string,
  type: "INPUT" | "NORMAL",
) {
  const workflowCollection = db.collection<Workflow>("workflow");
  const workflow = await workflowCollection.findOne({
    publicId: workflowId,
  });

  if (!workflow) {
    throw new Error(`Couldn't find workflow id ${workflowId}`);
  }

  const isInput = type === "INPUT";
  const name = isInput ? "New Input Task" : "New Task";
  const now = new Date();
  const nodeId = workflowNodeId();
  const newNode = {
    publicId: nodeId,
    createdAt: now,
    updatedAt: now,
    isInput: isInput,
    name: name,
    isRoot: false,
    containerImage: undefined,
    variables: [] as WorkflowNodeVariables,
  } satisfies WorkflowNode;

  const updatedNodes = [...workflow.nodes, newNode];

  await workflowCollection.updateOne(
    { _id: workflow._id },
    {
      $set: {
        nodes: updatedNodes,
        updatedAt: now,
      },
    },
  );

  return newNode;
}

async function connectNodes(db: Db, sourceId: string, targetId: string) {
  const collection = db.collection<Workflow>("workflow");
  const findWfRes = await collection.findOne({
    nodes: {
      $elemMatch: {
        publicId: sourceId,
      },
    },
  });

  if (!findWfRes) {
    throw new Error(`Couldn't find workflow by node with id ${sourceId}`);
  }

  const workflow = findWfRes;
  const existingEdge = workflow.edges.find(
    (e) => e.source === sourceId && e.target === targetId,
  );

  if (existingEdge) {
    return existingEdge;
  }

  const now = new Date();
  const edge = {
    publicId: workflowEdgeId(),
    source: sourceId,
    target: targetId,
  } satisfies WorkflowEdge;

  const updatedEdges = [...workflow.edges, edge];

  await collection.updateOne(
    { _id: workflow._id },
    {
      $set: {
        edges: updatedEdges,
        updatedAt: now,
      },
    },
  );

  return edge;
}

async function deleteNodes(
  db: Db,
  workflowId: string,
  nodeIdsToDelete: string[],
) {
  const collection = db.collection<Workflow>("workflow");
  const workflow = await collection.findOne({
    publicId: workflowId,
  });

  if (!workflow) {
    throw new Error(`Couldn't find workflow with id ${workflowId}`);
  }

  const edgesIdsToDelete = workflow.edges
    .filter(
      (e) =>
        nodeIdsToDelete.includes(e.source) ||
        nodeIdsToDelete.includes(e.target),
    )
    .map((e) => e.publicId);

  const updatedEdges = workflow.edges.filter(
    (e) => !edgesIdsToDelete.includes(e.publicId),
  );
  const updatedNodes = workflow.nodes.filter(
    (n) => !nodeIdsToDelete.includes(n.publicId),
  );

  const now = new Date();
  await collection.updateOne(
    { _id: workflow._id },
    {
      $set: {
        nodes: updatedNodes,
        edges: updatedEdges,
        updatedAt: now,
      },
    },
  );
}

async function deleteEdges(
  db: Db,
  workflowId: string,
  edgesToDelete: Array<{ sourceId: string; targetId: string }>,
) {
  const collection = db.collection<Workflow>("workflow");
  const workflow = await collection.findOne({
    publicId: workflowId,
  });

  if (!workflow) {
    return;
  }

  const updatedEdges = workflow.edges.filter(
    (e) =>
      !edgesToDelete.some(
        (etd) => etd.sourceId === e.source && etd.targetId === e.target,
      ),
  );

  const now = new Date();
  await collection.updateOne(
    { _id: workflow._id },
    {
      $set: {
        edges: updatedEdges,
        updatedAt: now,
      },
    },
  );
}

function assertNoCycles(
  nodes: Array<WorkflowNode>,
  edges: Array<WorkflowEdge>,
): boolean {
  const adjacencyList: Record<string, Array<string>> = {};

  // Create adjacency list
  nodes.forEach((node) => {
    adjacencyList[node.publicId] = [];
  });
  edges.forEach((edge) => {
    adjacencyList[edge.source]?.push(edge.target);
  });

  const visited: Record<string, boolean> = {};

  for (const node of nodes) {
    const stack: Array<string> = [];
    const recursionStack: Record<string, boolean> = {};

    stack.push(node.publicId);

    while (stack.length) {
      const currentNode = stack.pop()!;
      if (!visited[currentNode]) {
        visited[currentNode] = true;
        recursionStack[currentNode] = true;
      }

      const nodeNeighbors = adjacencyList[currentNode]!;

      for (const neighbor of nodeNeighbors) {
        if (!visited[neighbor]) {
          stack.push(neighbor);
        } else if (recursionStack[neighbor]) {
          return false;
        }
      }
    }
  }
  return true;
}

function isValidDag(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  // has sink node (node with no outputs)
  const hasSinkNode = nodes.some(
    (n) =>
      n.isRoot &&
      edges.some((e) => n.publicId === e.source || n.publicId === e.target),
  );

  // has source node (node with no inputs)
  const inputNodes = nodes.filter((n) => n.isInput);
  const hasInputNodes = inputNodes.length > 0;

  const inputNodesAreConnected = inputNodes.every((inputNode) =>
    edges.some(
      (e) => inputNode.publicId === e.source || inputNode.publicId === e.target,
    ),
  );

  // has no cycles
  const hasNoCycles = assertNoCycles(nodes, edges);

  return hasNoCycles && hasInputNodes && inputNodesAreConnected && hasSinkNode;
}

async function runWorkflow(db: Db, workflowId: string) {
  const workflowCollection = db.collection<Workflow>("workflow");
  const findWfRes = await workflowCollection.findOne({
    publicId: workflowId,
  });

  if (!findWfRes) {
    throw new Error(`Couldn't find workflow id ${workflowId}`);
  }

  const workflow = findWfRes;

  const nodes = workflow.nodes;
  const edges = workflow.edges;
  const isDag = isValidDag(nodes, edges);
  if (!isDag) {
    throw new Error(
      `Workflow can't be run because there are cycles, is not fully connected, or is missing an input`,
    );
  }

  const nodesAreNunnable = nodes.every((n) => Boolean(n.containerImage));
  if (!nodesAreNunnable) {
    throw new Error(
      `Workflow can't be run becase not all tasks have valid container images`,
    );
  }

  console.log("Workflow is executable. Now to running it.");

  const now = new Date();
  const runId = workflowRunId();
  const run = {
    publicId: runId,
    workflowId: workflow._id,
    workflowPublicId: workflow.publicId,
    startedAt: now,
    updatedAt: now,
    nodes: nodes,
    edges: edges,
    status: "RUNNING",
    nodeDeploymentStatuses: [],
    nodesServiceMappings: [] as RunNodeServiceMapping[],
  } satisfies WorkflowRun;

  const inputNodes = run.nodes.filter((n) => n.isInput);

  const res = await Promise.all(
    inputNodes.map(async (n) => {
      const createRes = await createService(
        workflow.apiKey,
        workflow.projectId,
        `${n.name} ${now.getTime()}`,
        n.containerImage!,
        n.variables,
      );

      return {
        nodeId: n.publicId,
        railwayServiceId: createRes.serviceCreate.id,
      } as const;
    }),
  );

  const newMappings = res.map<RunNodeServiceMapping>((r) => ({
    nodeId: r.nodeId,
    railwayServiceId: r.railwayServiceId,
  }));

  const newNodeDepMap = [...run.nodesServiceMappings, ...newMappings];
  run.nodesServiceMappings = newNodeDepMap;

  console.log("runWorkflow", {
    workflowRun: run,
    res: res.map(
      ({ nodeId, railwayServiceId }) => `${nodeId}: ${railwayServiceId} `,
    ),
  });

  const runsCollection = db.collection<WorkflowRun>("runs");
  const { acknowledged } = await runsCollection.insertOne(run);

  if (!acknowledged) {
    throw new Error(`Couldn't start run for workflow ${workflow.name}`);
  }

  return runId;
}

async function getLatestRuns(db: Db) {
  const collection = db.collection<WorkflowRun>("runs");
  const res = await collection
    .find()
    .sort({ startedAt: -1 })
    .limit(50)
    .toArray();

  return res;
}

export const workflowRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        projectId: z.string().min(1),
        apiKey: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const wf = await createWorkflow(ctx.db, {
        name: input.name,
        projectId: input.projectId,
        apiKey: input.apiKey,
      });

      return workflowProjection(wf);
    }),
  createNode: publicProcedure
    .input(
      z.object({ workflowId: z.string(), type: z.enum(["INPUT", "NORMAL"]) }),
    )
    .mutation(async ({ input, ctx }) => {
      return await createWorkflowNode(ctx.db, input.workflowId, input.type);
    }),
  updateNode: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        values: updateWfNodeValuesSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const id = input.id;
      const values = input.values;

      return await updateWorkflowNode(ctx.db, id, values);
    }),
  getByPublicId: publicProcedure
    .input(z.object({ publicId: z.string() }))
    .query(async ({ input, ctx }) => {
      const wf = await getWorkFlow(ctx.db, input.publicId);
      return workflowProjection(wf);
    }),
  getLatest: publicProcedure.query(async ({ ctx }) => {
    const wf = await getLatestWorkflow(ctx.db);
    return workflowProjection(wf);
  }),
  workflowCount: publicProcedure.query(async ({ ctx }) => {
    const db = ctx.db;
    const collection = db.collection<Workflow>("workflow");
    const count = await collection.countDocuments();
    return { count };
  }),
  connectNodes: publicProcedure
    .input(
      z.object({
        sourceId: z.string(),
        targetId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await connectNodes(ctx.db, input.sourceId, input.targetId);
    }),
  deleteEdges: publicProcedure
    .input(
      z.object({
        workflowId: z.string(),
        edges: z.array(
          z.object({ sourceId: z.string(), targetId: z.string() }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await deleteEdges(ctx.db, input.workflowId, input.edges);
    }),
  deleteNodes: publicProcedure
    .input(
      z.object({
        workflowId: z.string(),
        nodes: z.array(z.string()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await deleteNodes(ctx.db, input.workflowId, input.nodes);
    }),
  run: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workflowId = input.workflowId;
      const runId = await runWorkflow(ctx.db, workflowId);
      return runId;
    }),
  getRuns: publicProcedure.query(async ({ ctx }) => {
    const runs = await getLatestRuns(ctx.db);
    const res = {
      total: runs.length,
      runs: runs.map((r) => runProjection(r)),
    };
    return res;
  }),
});

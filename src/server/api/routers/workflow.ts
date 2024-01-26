import { z } from "zod";
import { ulid } from "ulid";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { ObjectId, type Db } from "mongodb";
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

interface RunNodeServiceMapping {
  nodeId: string;
  railwayServiceId: string;
}
interface RunNodeDepStatus {
  nodeId: string;
  recordedStatus: "DEPLOYING" | "FAILED" | "SUCCESS";
  recoredAt: Date;
}

interface WorkflowRun {
  publicId: string;
  workflowId: ObjectId;
  workflowPublicId: string;
  status: "PREPARING" | "RUNNING" | "FAILED" | "COMPLETED";
  dateStarted: Date;
  nodes: Array<WorkflowNode>;
  edges: Array<WorkflowEdge>;
  nodesServiceMap: Array<RunNodeServiceMapping>;
  nodeDeploymentStatuses: Array<RunNodeDepStatus>;
}

export type RunProjection = ReturnType<typeof runProjection>;
export type RunServiceMapProjection = RunProjection["nodesServiceMap"][0];
export type RunDeploymentStatusProjection =
  RunProjection["nodeDeploymentStatuses"][0];

export type RunNodesProjection = WorkflowProjection["nodes"][0];
export type RunEdgesProjection = WorkflowProjection["edges"][0];

function runProjection(r: WorkflowRun) {
  return {
    publicId: r.publicId,
    workflowPublicId: r.workflowPublicId,
    dateStarted: r.dateStarted,
    status: r.status,
    nodesServiceMap: r.nodesServiceMap.map((sm) => ({
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

interface WorkflowNode {
  publicId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  containerImage?: string;
  variables: Array<{ name: string; value: string }>;
  isRoot: boolean;
  isInput: boolean;
}

interface WorkflowEdge {
  publicId: string;
  source: string;
  target: string;
}

interface Workflow {
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

function workflowProjection(wf: Workflow) {
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
        name: `Output Task`,
        createdAt: now,
        updatedAt: now,
        publicId: outputId,
        isRoot: true,
        isInput: false,
        variables: [],
      },
      {
        name: `Input Task`,
        createdAt: now,
        updatedAt: now,
        publicId: inputId,
        isRoot: false,
        isInput: true,
        variables: [],
      },
    ],
    edges: [
      {
        publicId: workflowEdgeId(),
        source: inputId,
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

  // const webhookUrl = `${env.PUBLIC_URL}/api/webhooks/railway/${nWf.publicId}`;
  // const createWebhookRes = await createProjectWebhook(
  //   nWf.apiKey,
  //   nWf.projectId,
  //   webhookUrl,
  // );

  // console.log({ webhookUrl, createWebhookRes });

  return nWf;
}

async function getWorkFlow(db: Db, publicId: string) {
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

async function deleteEdge(db: Db, sourceId: string, targetId: string) {
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
  const edgeToDelete = workflow.edges.find(
    (e) => e.source === sourceId && e.target === targetId,
  );

  if (!edgeToDelete) {
    return;
  }

  const now = new Date();
  const updatedEdges = workflow.edges.filter(
    (e) => e.publicId !== edgeToDelete.publicId,
  );

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

function isValidDag(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  // has sink node (node with no outputs)
  const hasSinkNode = nodes.some(
    (n) =>
      n.isRoot &&
      edges.some((e) => n.publicId === e.source || n.publicId === e.target),
  );

  // has source node (node with no inputs)
  const hasSourceNode = nodes.some(
    (n) =>
      n.isInput &&
      edges.some((e) => n.publicId === e.source || n.publicId === e.target),
  );

  // has no cycles
  const hasNoCycles = true;

  return hasNoCycles && hasSourceNode && hasSinkNode;
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
    throw new Error(`Workflow can't be run because there are cycles`);
  }

  const nodesAreNunnable = nodes.every((n) => Boolean(n.containerImage));
  if (!nodesAreNunnable) {
    throw new Error(
      `Workflow can't be run becase not all tasks have valid container images`,
    );
  }

  console.log("Workflow is executable. Now to running it.");

  const now = new Date();
  const run = {
    publicId: workflowRunId(),
    workflowId: workflow._id,
    workflowPublicId: workflow.publicId,
    dateStarted: now,
    nodes: nodes,
    edges: edges,
    status: "RUNNING",
    nodeDeploymentStatuses: [],
    nodesServiceMap: [] as RunNodeServiceMapping[],
  } satisfies WorkflowRun;

  const thisBatch = run.nodes.filter((n) => n.isInput);

  const res = await Promise.all(
    thisBatch.map(async (n) => {
      const createRes = await createService(
        workflow.apiKey,
        workflow.projectId,
        `${n.name} at ${now.getTime()}`,
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

  const newNodeDepMap = [...run.nodesServiceMap, ...newMappings];
  run.nodesServiceMap = newNodeDepMap;

  // console.log("runWorkflow", {
  //   workflowRun: run,
  //   res: res.map(
  //     ({ nodeId, railwayServiceId }) => `${nodeId}: ${railwayServiceId} `,
  //   ),
  // });

  const runsCollection = db.collection<WorkflowRun>("runs");
  const { insertedId } = await runsCollection.insertOne(run);
  const nRun = await runsCollection.findOne({
    _id: insertedId,
  });

  if (!nRun) {
    throw new Error(`Couldn't start run for workflow ${workflow.name}`);
  }

  // const webhookUrl = `${env.PUBLIC_URL}/api/webhooks/railway/${nWf.publicId}`;
  // const createWebhookRes = await createProjectWebhook(
  //   nWf.apiKey,
  //   nWf.projectId,
  //   webhookUrl,
  // );

  // console.log({ webhookUrl, createWebhookRes });

  return nRun;
}

async function getLatestRuns(db: Db) {
  const collection = db.collection<WorkflowRun>("runs");
  const res = await collection
    .find()
    .sort({ dateStarted: -1 })
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
  deleteEdge: publicProcedure
    .input(z.object({ sourceId: z.string(), targetId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await deleteEdge(ctx.db, input.sourceId, input.targetId);
    }),
  run: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workflowId = input.workflowId;
      const run = await runWorkflow(ctx.db, workflowId);
      return runProjection(run);
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

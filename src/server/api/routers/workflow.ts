import { z } from "zod";
import { ulid } from "ulid";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type Db } from "mongodb";
import { env } from "~/env";
import { createProjectWebhook } from "~/server/railway-client";

function workflowId() {
  return `wf_${ulid()}`;
}

function workflowNodeId() {
  return `wfn_${ulid()}`;
}

function workflowEdgeId() {
  return `wfe_${ulid()}`;
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
  // input_node_ids: Array<string>
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
        isInput: true,
        variables: [],
      },
      {
        name: `Input Task`,
        createdAt: now,
        updatedAt: now,
        publicId: inputId,
        isRoot: false,
        isInput: false,
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
});

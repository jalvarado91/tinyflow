import { z } from "zod";
import { ulid } from "ulid";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type Db } from "mongodb";
import { env } from "~/env";
import { createProjectWebhook } from "~/server/railway-client";

function workFlowId() {
  return `wf_${ulid()}`;
}

function workFlowNodeId() {
  return `wfn_${ulid()}`;
}

interface WorkflowNode {
  publicId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  containerImage?: string;
  variables: Array<{ name: string; value: string }>;
  isRoot: boolean;
  hasInput: boolean;
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
}

export type WorkflowProjection = ReturnType<typeof workflowProjection>;
export type WorkflowNodeProjection = WorkflowProjection["nodes"][0];

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
      hasInput: n.hasInput,
      containerImage: n.containerImage,
      variables: n.variables,
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
  const wf = {
    publicId: workFlowId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: projectId,
    name: name,
    apiKey: apiKey,
    nodes: [
      {
        name: `${name} result`,
        createdAt: new Date(),
        updatedAt: new Date(),
        publicId: workFlowNodeId(),
        isRoot: true,
        hasInput: true,
        variables: [],
      },
      {
        name: `Some Leaf`,
        createdAt: new Date(),
        updatedAt: new Date(),
        publicId: workFlowNodeId(),
        isRoot: false,
        hasInput: false,
        variables: [],
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
});

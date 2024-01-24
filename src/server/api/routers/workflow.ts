import { z } from "zod";
import { ulid } from "ulid";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type Db } from "mongodb";

let post = {
  id: 1,
  name: "Hello World",
};

function workFlowId() {
  return `wf_${ulid()}`;
}

interface Workflow {
  publicId: string;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  name: string;
  apiKey: string;
}

export type WorkFlowProjection = ReturnType<typeof workFlowProjection>;
function workFlowProjection(wf: Workflow) {
  return {
    publicId: wf.publicId,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
    projectId: wf.projectId,
    name: wf.name,
    apiKey: wf.apiKey,
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

  return workFlowProjection(nWf);
}

async function getWorkFlow(db: Db, publicId: string) {
  const collection = db.collection<Workflow>("workflow");
  const nWf = await collection.findOne({
    publicId: publicId,
  });

  if (!nWf) {
    throw new Error(`Couldn't find workflow with publicId: ${publicId}`);
  }

  return workFlowProjection(nWf);
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

  return workFlowProjection(res[0]);
}

export const workflowRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        projectId: z.string().min(1),
        apiKey: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const workFlow = await createWorkflow(ctx.db, {
        name: input.name,
        projectId: input.projectId,
        apiKey: input.apiKey,
      });

      return workFlow;
    }),
  getByPublicId: publicProcedure
    .input(z.object({ publicId: z.string() }))
    .query(async ({ input, ctx }) => {
      const wf = await getWorkFlow(ctx.db, input.publicId);
      return wf;
    }),
  getLatest: publicProcedure.query(async ({ ctx }) => {
    const wf = await getLatestWorkflow(ctx.db);
    return wf;
  }),
  workflowCount: publicProcedure.query(async ({ ctx }) => {
    const db = ctx.db;
    const collection = db.collection<Workflow>("workflow");
    const count = await collection.countDocuments();
    return { count };
  }),
  createPost: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      // simulate a slow db call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      post = { id: post.id + 1, name: input.name };
      return post;
    }),

  getLatestPost: publicProcedure.query(() => {
    return post;
  }),
});

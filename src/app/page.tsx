import { unstable_noStore as noStore } from "next/cache";
import { CreateWorkflow } from "~/app/_components/create-workflow";
import { api } from "~/trpc/server";
import { FlowBoard } from "./_components/flowboard";
import { CreatePost } from "./_components/create-post";

export default async function Home() {
  noStore();
  const { count } = await api.workflow.workflowCount.query();

  return <>{count === 0 ? <Onboarding /> : <WorkflowView />}</>;
}

async function Onboarding() {
  return (
    <main className="flex h-full w-full items-center justify-center">
      <div className="mx-auto flex w-full max-w-sm">
        <div className="w-full">
          <CreateWorkflow />
        </div>
      </div>
    </main>
  );
}

async function WorkflowView() {
  const latestWf = await api.workflow.getLatest.query();

  return (
    <main className="flex h-full min-h-screen w-screen">
      <div className="flex max-w-sm flex-1 flex-shrink-0">
        <CrudShowcase />
        <br />
        <hr />
        <div>{JSON.stringify({ latestWf })}</div>
      </div>
      <div className="flex flex-1">
        <FlowBoard />
      </div>
    </main>
  );
}

async function CrudShowcase() {
  const latestPost = await api.workflow.getLatestPost.query();

  return (
    <div className="w-full rounded p-4 shadow">
      {latestPost ? (
        <p className="truncate">Your most recent post: {latestPost.name}</p>
      ) : (
        <p>You have no posts yet.</p>
      )}

      <CreatePost />
    </div>
  );
}

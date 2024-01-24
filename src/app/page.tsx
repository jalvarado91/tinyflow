import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { CreatePost } from "~/app/_components/create-workflow";
import { api } from "~/trpc/server";
import { FlowBoard } from "./_components/flowboard";

export default async function Home() {
  noStore();
  const hello = await api.workflow.hello.query({ text: "from tRPC" });

  return (
    <main className="flex h-full min-h-screen w-screen">
      <div className="flex max-w-sm flex-1 flex-shrink-0">
        <CrudShowcase />
      </div>
      <div className="flex flex-1">
        <FlowBoard />
      </div>
    </main>
  );
}

async function CrudShowcase() {
  const latestPost = await api.workflow.getLatest.query();

  return (
    <div className="w-full p-4 shadow">
      {latestPost ? (
        <p className="truncate">Your most recent post: {latestPost.name}</p>
      ) : (
        <p>You have no posts yet.</p>
      )}

      <CreatePost />
    </div>
  );
}

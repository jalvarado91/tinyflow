import { unstable_noStore as noStore } from "next/cache";
import { CreateWorkflow } from "~/app/_components/create-workflow";
import { api } from "~/trpc/server";
import { FlowBoard } from "./_components/flowboard";
import { ScrollArea } from "~/components/ui/scroll-area";
import { RunButton } from "./_components/run-button";
import { formatDistance } from "date-fns";
import { ActiveRunsRefresher } from "./_components/run-refresher";
import Link from "next/link";
import { cn } from "~/lib/utils";

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
  noStore();
  const [wf, runsData] = await Promise.all([
    api.workflow.getLatest.query(),
    api.workflow.getRuns.query(),
  ]);

  const now = new Date();

  return (
    <main className="flex h-full min-h-screen w-screen bg-white">
      <ActiveRunsRefresher runs={runsData.runs} />
      <div className="z-10 grid h-full max-w-md flex-1 flex-shrink-0 grid-cols-1 grid-rows-[auto_minmax(0px,_1fr)] shadow-md">
        <div className="b flex-grow-0 flex-col border-x px-4 py-4">
          <h2 className="text-2xl font-semibold">{wf.name}</h2>
          <p className="text-sm ">
            Edit or run your workflow
          </p>
        </div>
        <div className="flex h-full flex-col gap-3 border pt-4">
          <h2 className="flex-grow-0 px-4 text-xs font-semibold text-slate-800">
            RUN HISTORY {runsData.total > 0 ? <>({runsData.total})</> : ""}
          </h2>
          <ScrollArea className="h-full max-h-full overflow-hidden">
            <div className="my-2 flex h-full flex-col justify-start gap-2 px-4 pb-4">
              {runsData.total === 0 && (
                <div className="rounded-lg border bg-slate-50 px-4 py-4 text-center font-semibold">
                  No runs so far
                </div>
              )}
              {runsData.runs.map((r) => {
                return (
                  <Link
                    href={`/run/${r.publicId}`}
                    key={r.publicId}
                    title={JSON.stringify(r, null, 2)}
                    className={cn(
                      "rounded-lg border px-4 py-4 hover:outline focus-visible:outline",
                      r.status === "FAILED" &&
                        "border-2 border-red-600/10 bg-red-50 text-red-700",
                      r.status === "COMPLETED" &&
                        "bg-sky-50 text-sky-700  ring-sky-600/20",
                    )}
                  >
                    <div className="font-semibold">{r.status}</div>
                    <div className="text-sm">
                      Kicked off{" "}
                      <span className="font-semibold">
                        {formatDistance(r.startedAt, now, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        <div className="flex flex-col border-x">
          {/* <div className="flex-shrink-0 bg-slate-50 py-4 shadow-inner">
            <pre className="mx-4 max-h-[600px] overflow-x-auto overflow-y-auto text-xs">
              {JSON.stringify(wf, null, 2)}
            </pre>
          </div> */}
          <div className="flex-shrink-0 justify-self-end px-4 py-4">
            <RunButton workflow={wf} />
          </div>
        </div>
      </div>
      <div className="flex flex-1">
        <FlowBoard
          workflowId={wf.publicId}
          workflowNodes={wf.nodes}
          workflowEdges={wf.edges}
        />
      </div>
    </main>
  );
}

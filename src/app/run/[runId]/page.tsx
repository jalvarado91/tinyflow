import { unstable_noStore as noStore } from "next/cache";
import { api } from "~/trpc/server";
import { ScrollArea } from "~/components/ui/scroll-area";
import { notFound } from "next/navigation";
import { type RunProjection } from "~/server/api/routers/workflow";
import { RunRefresher } from "~/app/_components/run-refresher";
import { ClientDateTime } from "~/app/_components/client-datetime";
import { cn } from "~/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RunViewer } from "~/app/_components/run-viewer";

export default async function RunPage({
  params,
}: {
  params: { runId: string };
}) {
  noStore();

  const runId = params.runId;
  const runsData = await api.workflow.getRuns.query();
  const run = runsData.runs.find((r) => r.publicId === runId);

  if (!run) {
    return notFound();
  }

  return <WorkflowView run={run} />;
}

async function WorkflowView({ run }: { run: RunProjection }) {
  noStore();

  const nodes = run.nodes;
  const serviceMappings = run.nodesServiceMappings;
  const statusHistory = run.nodeDeploymentStatuses.sort(
    (a, b) => b.recoredAt.getTime() - a.recoredAt.getTime(),
  );

  const history = statusHistory.map((s) => {
    const node = nodes.find((n) => n.publicId === s.nodeId);
    const nodeServiceMapping = serviceMappings.find(
      (sm) => sm.nodeId === s.nodeId,
    );
    return {
      node,
      nodeId: s.nodeId,
      status: s.recoredStatus,
      recordedAt: s.recoredAt,
      railwayServiceId: nodeServiceMapping?.railwayServiceId ?? "",
    };
  });

  return (
    <main className="flex h-full min-h-screen w-screen bg-white">
      <RunRefresher run={run} />
      <div className="z-10 grid h-full max-w-md flex-1 flex-shrink-0 grid-cols-1 grid-rows-[auto_minmax(0px,_1fr)] shadow-md">
        <div className="b flex-grow-0 flex-col space-y-2 border-x px-4 pb-4">
          <Link
            className="bg-red flex items-center gap-2 border-b py-4 font-medium text-gray-700"
            href="/"
          >
            <ArrowLeft size={18} /> Return to editor
          </Link>
          <div className="py-2">
            <h2 className="text-2xl font-semibold">Run Details</h2>
            <h3 className="text-sm">
              Kicked off <ClientDateTime date={run.startedAt} />
            </h3>
          </div>
          <div>
            <div
              className={cn(
                "inline-block w-auto rounded-full px-5 py-1 text-sm font-semibold ring-2 ring-inset ring-foreground",
                run.status === "FAILED" &&
                  "bg-red-50 text-red-700  ring-red-600/10",
                run.status === "COMPLETED" &&
                  "bg-sky-50 text-sky-700  ring-sky-600/20",
              )}
            >
              {run.status}
            </div>
          </div>
        </div>
        <div className="flex h-full flex-col gap-3 border pt-4">
          <h2 className="flex-grow-0 px-4 text-xs font-semibold text-slate-800">
            EVENT HISTORY {history.length > 0 ? <>({history.length})</> : ""}
          </h2>
          <ScrollArea className="h-full max-h-full overflow-hidden">
            <div className="flex h-full flex-col justify-start gap-2 px-4 pb-4">
              {history.map((historyEvent) => {
                return (
                  <div
                    key={historyEvent.recordedAt.getTime()}
                    title={JSON.stringify(historyEvent, null, 2)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-4 text-sm",
                      historyEvent.status === "FAILED" &&
                        "border-2 border-red-600/10 bg-red-50 text-red-700",
                      historyEvent.status === "SUCCESS" &&
                        "bg-sky-50 text-sky-700  ring-sky-600/20",
                    )}
                  >
                    <div className="">
                      <div className="text-xs">
                        <ClientDateTime date={historyEvent.recordedAt} />
                      </div>
                      <div className="text-lg font-medium">
                        {historyEvent.node?.name ?? historyEvent.nodeId}
                      </div>
                      <div className="font-mono text-xs">
                        <code>{historyEvent.nodeId}</code>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "inline-block w-auto rounded-full px-5 py-1 text-sm font-semibold text-foreground/70 ring-2 ring-inset ring-foreground/40",
                        historyEvent.status === "FAILED" &&
                          "bg-red-50 text-red-700  ring-red-600/10",
                        historyEvent.status === "SUCCESS" &&
                          "bg-sky-50 text-sky-700  ring-sky-600/20",
                      )}
                    >
                      {historyEvent.status === "DEPLOYING"
                        ? "STARTED"
                        : historyEvent.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        {/* <div className="flex flex-col border-x">
          <div className="flex-shrink-0 bg-slate-50 py-4 shadow-inner">
            <pre className="mx-4 max-h-[600px] overflow-x-auto overflow-y-auto text-xs">
              {JSON.stringify(run, null, 2)}
            </pre>
          </div>
        </div> */}
      </div>
      <div className="flex flex-1">
        <RunViewer
          key={run.publicId}
          workflowNodes={run.nodes}
          workflowEdges={run.edges}
        />
      </div>
    </main>
  );
}

import { unstable_noStore as noStore } from "next/cache";
import { CreateWorkflow } from "~/app/_components/create-workflow";
import { api } from "~/trpc/server";
import { FlowBoard } from "./_components/flowboard";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";

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
  const wf = await api.workflow.getLatest.query();

  const runWorkflow = {
    isLoading: false,
  };
  return (
    <main className="flex h-full min-h-screen w-screen">
      <div className="grid h-full max-w-md flex-1 flex-shrink-0 grid-cols-1 grid-rows-[auto_minmax(0px,_1fr)] shadow">
        <div className="flex-grow-0 flex-col border-b bg-white px-4 py-4">
          <h2 className="text-xl font-semibold">{wf.name}</h2>
          <p className="text-sm text-muted-foreground">
            Edit or execute your workflow
          </p>
        </div>
        {/* <div className="flex h-full flex-grow-0 flex-col"> */}
        <div className="flex h-full flex-col gap-3 pt-4">
          <h2 className="flex-grow-0 px-4 text-xs font-semibold text-slate-800">
            EXECUTION HISTORY
          </h2>
          <ScrollArea className="h-full max-h-full overflow-hidden">
            <div className="flex h-full flex-col justify-start gap-2 px-4 pb-4">
              {Array.from({ length: 2 }, (v, i) => i).map((v) => {
                return (
                  <div key={v} className="rounded-lg border px-4 py-4">
                    <div className="font-semibold">Succeeded {v}</div>
                    <div className="text-sm text-slate-700">
                      Executed{" "}
                      <span className="font-semibold text-slate-800">
                        2 minutes ago
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {/* </div> */}
        </div>
        <div className="flex flex-col ">
          <div className="flex-shrink-0 bg-slate-50 py-4 shadow-inner">
            <pre className="mx-4 overflow-x-auto text-xs">
              {JSON.stringify(wf, null, 2)}
            </pre>
          </div>
          <div className="flex-shrink-0 justify-self-end px-4 py-4">
            <Button
              type="submit"
              disabled={runWorkflow.isLoading}
              className="w-full"
            >
              {runWorkflow.isLoading ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-1">
        <FlowBoard />
      </div>
    </main>
  );
}

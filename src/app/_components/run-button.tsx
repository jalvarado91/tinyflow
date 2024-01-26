"use client";

import { ToastAction } from "@radix-ui/react-toast";
import { type TRPCClientErrorLike } from "@trpc/client";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { type AppRouter } from "~/server/api/root";
import { type WorkflowProjection } from "~/server/api/routers/workflow";
import { api } from "~/trpc/react";

export function RunButton({ workflow }: { workflow: WorkflowProjection }) {
  const runWorkflow = api.workflow.run.useMutation({
    onSuccess: () => {
      console.log("On success");
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't run your workflow",
        description: `${err.message}. Please try again.`,
        action: (
          <ToastAction
            onClick={() => window.location.reload()}
            altText={"Try again"}
          >
            Refresh
          </ToastAction>
        ),
      });
    },
  });

  function onRun() {
    runWorkflow.mutate({
      workflowId: workflow.publicId,
    });
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={onRun}
        type="submit"
        disabled={
          !workflow.isValidDag || !workflow.isRunnable || runWorkflow.isLoading
        }
        className="w-full"
      >
        {runWorkflow.isLoading ? "Running..." : "Run"}
      </Button>
      {!workflow.isValidDag && (
        <div className="text-xs font-semibold text-red-500">
          Workflow either has cycles or is not fully connected
        </div>
      )}
      {!workflow.isRunnable && (
        <div className="text-xs font-semibold text-red-500">
          Some tasks are missing a container images
        </div>
      )}
    </div>
  );
}
"use client";

import React, { memo } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  useNodeId,
  useNodes,
  useStore,
  useReactFlow,
} from "reactflow";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { type WorkflowNodeProjection } from "~/server/api/routers/workflow";
import * as z from "zod";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useToast } from "~/components/ui/use-toast";
import { type TRPCClientErrorLike } from "@trpc/client";
import { type AppRouter } from "~/server/api/root";

const taskFormSchema = z.object({
  containerImage: z.string().min(2),
  variables: z
    .array(
      z.object({
        name: z.string().min(1, "Name can't be empty"),
        value: z.string().min(1, "Value can't be empty"),
      }),
    )
    .optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

function WorkflowNode({
  data,
  selected,
  id,
}: NodeProps<WorkflowNodeProjection>) {
  const router = useRouter();
  const { toast } = useToast();
  const isRoot = data.isRoot;
  const hasInput = data.hasInput;

  const defaultFormvalues: Partial<TaskFormValues> = {
    containerImage: data.containerImage,
    variables: data.variables,
  };

  const reactFlow = useReactFlow();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: defaultFormvalues,
    mode: "onChange",
  });

  const updateWorkflow = api.workflow.updateNode.useMutation({
    onSuccess: (newNodeData) => {
      const relevantNode = reactFlow.getNode(id);
      if (relevantNode) {
        const otherNodes = reactFlow.getNodes().filter((v) => v.id !== id);
        reactFlow.setNodes([
          ...otherNodes,
          {
            ...relevantNode,
            data: newNodeData,
          },
        ]);
      }

      toast({
        title: "Task changes have been saved.",
      });
      router.refresh();
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast({
        variant: "destructive",
        title: "Oh no! Couldn't save your changes",
        description: `${err.message}. Please try again.`,
      });
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "variables",
    control: form.control,
  });

  function onSubmit(values: TaskFormValues) {
    console.log("onSubmit", { values });

    updateWorkflow.mutate({
      id: data.publicId,
      values,
    });
  }

  function onDelete() {
    console.log("onDelete");
  }

  return (
    <Dialog>
      <DialogTrigger>
        <div
          className={cn(
            "justify-start rounded-md border border-slate-200 bg-white px-4 py-2 text-left shadow-md",
            selected && "outline outline-2",
          )}
        >
          <div className="item flex">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-gray-100">
              {data.containerImage ? "👍" : "⚠️"}
            </div>
            <div className="ml-2 flex flex-col gap-4">
              <div>
                <div className="text-lg font-bold">{data.name}</div>
                <div className="text-xs text-gray-500 ">
                  <code>{data.publicId}</code>
                </div>
              </div>
              {data.containerImage ? (
                <div className="text-sm text-gray-500">
                  {data.containerImage}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  Missing container image
                </div>
              )}
            </div>
          </div>

          {hasInput && (
            <Handle
              type="target"
              position={Position.Left}
              className="!bg-zinc-50 outline outline-zinc-900"
            />
          )}
          {!isRoot && (
            <Handle
              type="source"
              position={Position.Right}
              className="!bg-zinc-50 outline outline-zinc-900"
            />
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Edit {data.name}</DialogTitle>
              <DialogDescription>
                {"Make changes to your task. Click save when you're done."}
              </DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="containerImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Container Image</FormLabel>
                  <FormControl>
                    <Input placeholder="hello-world" {...field} />
                  </FormControl>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      Enter a Docker image from DockerHub, GHCR, or quay.io.{" "}
                      Image must exit once processing is completed.
                    </div>
                    <div className="rounded bg-zinc-100 px-4 py-2 text-zinc-600">
                      <div>Examples </div>
                      <ul className="list-inside list-disc">
                        <li>hello-world</li>
                        <li>ghcr.io/username/repo:latest</li>
                        <li>quay.io/username/repo:tag</li>
                      </ul>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <FormItem>
                <FormLabel>Variables</FormLabel>
                <FormDescription className="mb-4">
                  Add variables to your task container. <br />
                  <span className="text-xs font-semibold">
                    <code>INPUT_URL</code>
                  </span>{" "}
                  and{" "}
                  <span className="text-xs font-semibold">
                    <code>OUTPUT_POST_URL</code>
                  </span>{" "}
                  will also be injected.
                </FormDescription>
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-4">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-1 gap-2">
                        <FormField
                          name={`variables.${index}.name`}
                          defaultValue={`${field.name}`}
                          render={({ field }) => (
                            <div className="flex flex-1 flex-col gap-2">
                              <FormControl>
                                <Input placeholder="VARIABLE NAME" {...field} />
                              </FormControl>
                              <FormMessage />
                            </div>
                          )}
                        />
                        <FormField
                          name={`variables.${index}.value`}
                          defaultValue={`${field.value}`}
                          render={({ field }) => (
                            <div className="flex flex-1 flex-col gap-2">
                              <FormControl>
                                <Input placeholder="VALUE" {...field} />
                              </FormControl>
                              <FormMessage />
                            </div>
                          )}
                        />
                        <FormMessage />
                      </div>
                      <Button
                        className="flex-shrink-0"
                        type="button"
                        variant="outline"
                        title="delete variable"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </FormItem>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ name: "", value: "" })}
              >
                Add variable
              </Button>
            </div>
            <DialogFooter>
              {!isRoot && (
                <Button
                  onClick={onDelete}
                  type="button"
                  disabled={updateWorkflow.isLoading}
                  variant="destructive"
                >
                  Delete task
                </Button>
              )}
              <Button disabled={updateWorkflow.isLoading} type="submit">
                {updateWorkflow.isLoading ? "Saving..." : "Save task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default memo(WorkflowNode);

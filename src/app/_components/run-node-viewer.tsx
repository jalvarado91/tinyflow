"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { type RunNodeProjection } from "~/server/api/routers/workflow";
import { AlertTriangle, Box } from "lucide-react";
import { Label } from "~/components/ui/label";
import { ClientDateTime } from "./client-datetime";

function RunNodeViewer({ data, selected, id }: NodeProps<RunNodeProjection>) {
  const isRoot = data.isRoot;
  const isInput = data.isInput;

  const railwayServiceId = data.serviceMapping?.railwayServiceId ?? "";

  const latestStatusEvent = data.history[0];

  return (
    <Dialog key={latestStatusEvent?.recordedAt.getTime() ?? data.publicId}>
      <DialogTrigger>
        <div
          className={cn(
            "justify-start rounded-md border border-slate-200 bg-white px-3 py-2 text-left shadow",
            (selected || latestStatusEvent) && "outline outline-2",
            latestStatusEvent &&
              latestStatusEvent.recordedStatus === "DEPLOYING" &&
              "outline-orange-300",
            latestStatusEvent &&
              latestStatusEvent.recordedStatus === "FAILED" &&
              "outline-red-600",
            latestStatusEvent &&
              latestStatusEvent.recordedStatus === "SUCCESS" &&
              "outline-sky-600",
          )}
        >
          <div className="item flex">
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {latestStatusEvent && (
                    <div
                      className={cn(
                        "inline-block size-1 w-auto rounded-full p-1 font-medium leading-none text-foreground/70 ring-1 ring-inset ring-foreground/40",
                        latestStatusEvent.recordedStatus === "DEPLOYING" &&
                          "bg-orange-300 ring-orange-600/10",
                        latestStatusEvent.recordedStatus === "FAILED" &&
                          "bg-red-500 ring-red-600/10",
                        latestStatusEvent.recordedStatus === "SUCCESS" &&
                          "bg-sky-500 ring-sky-600/20",
                      )}
                    ></div>
                  )}
                  {data.name}{" "}
                </div>
                <div className="text-xs text-gray-500 ">
                  <code>{data.publicId}</code>
                </div>
              </div>
              {data.containerImage ? (
                <div>
                  <div className="inline-flex items-center gap-1 rounded-full border  border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-zinc-600">
                    <Box size={14} />
                    {data.containerImage}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="inline-flex items-center gap-1 rounded-full border  border-orange-200 bg-orange-100 px-2 py-1 text-xs font-medium text-orange-600/65">
                    <AlertTriangle size={12} />
                    Missing container image
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isInput && (
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
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {data.name}{" "}
              {latestStatusEvent && (
                <div
                  className={cn(
                    "inline-block w-auto rounded-full px-4 py-1 text-xs font-semibold leading-tight text-foreground/70 ring-2 ring-inset ring-foreground/40",
                    latestStatusEvent.recordedStatus === "FAILED" &&
                      "bg-red-50 text-red-700  ring-red-600/10",
                    latestStatusEvent.recordedStatus === "SUCCESS" &&
                      "bg-sky-50 text-sky-700  ring-sky-600/20",
                  )}
                >
                  {latestStatusEvent.recordedStatus === "DEPLOYING"
                    ? "STARTED"
                    : latestStatusEvent.recordedStatus}
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="font-mono">
              {data.publicId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label>Container Image</Label>
            <div>
              <div className="inline-flex items-center gap-1 rounded-full border  border-gray-200 bg-gray-100 px-2 py-1 text-sm font-medium text-zinc-600">
                <Box size={14} />
                {data.containerImage}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Railway Service Id</Label>
            <div>
              <div className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-1 py-px font-mono text-sm text-zinc-600">
                <code>{railwayServiceId}</code>
              </div>
            </div>
          </div>
          <div>
            <div className="space-y-2">
              <Label>Variables</Label>
              {data.variables.length === 0 && (
                <div className="text-sm">None configured</div>
              )}
              {data.variables.map((variable) => (
                <div key={variable.name} className="space-y-4">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-1 gap-2">
                      <div className="flex flex-1 flex-col gap-2">
                        <Input disabled value={variable.name} />
                      </div>

                      <div className="flex flex-1 flex-col gap-2">
                        <Input disabled value={variable.value} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <br />
          <DialogTitle className="text-sm">History</DialogTitle>

          <div className="flex flex-col gap-y-2">
            {data.history.map((event) => {
              return (
                <div
                  key={event.recordedAt.getTime()}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-2 text-sm",
                    event.recordedStatus === "FAILED" &&
                      "border-2 border-red-600/10 bg-red-50 text-red-700",
                    event.recordedStatus === "SUCCESS" &&
                      "bg-sky-50 text-sky-700  ring-sky-600/20",
                  )}
                >
                  <div className="">
                    <div className="text-sm">
                      <ClientDateTime date={event.recordedAt} />
                    </div>
                  </div>

                  <div
                    className={cn(
                      "inline-block w-auto rounded-full px-5 py-1 text-sm font-semibold text-foreground/70 ring-2 ring-inset ring-foreground/40",
                      event.recordedStatus === "FAILED" &&
                        "bg-red-50 text-red-700  ring-red-600/10",
                      event.recordedStatus === "SUCCESS" &&
                        "bg-sky-50 text-sky-700  ring-sky-600/20",
                    )}
                  >
                    {event.recordedStatus === "DEPLOYING"
                      ? "STARTED"
                      : event.recordedStatus}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <DialogClose>
              <Button type="submit">Close</Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(RunNodeViewer);

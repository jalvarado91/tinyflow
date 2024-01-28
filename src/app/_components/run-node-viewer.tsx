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
import { type WorkflowNodeProjection } from "~/server/api/routers/workflow";
import { AlertTriangle, Box } from "lucide-react";
import { Label } from "~/components/ui/label";

function RunNodeViewer({
  data,
  selected,
  id,
}: NodeProps<WorkflowNodeProjection>) {
  const isRoot = data.isRoot;
  const isInput = data.isInput;

  return (
    <Dialog>
      <DialogTrigger>
        <div
          className={cn(
            "justify-start rounded-md border border-slate-200 bg-white px-3 py-2 text-left shadow",
            selected && "outline outline-2",
          )}
        >
          <div className="item flex">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold">{data.name}</div>
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
        <div className="space-y-6">
          <DialogHeader>
            <DialogTitle>{data.name}</DialogTitle>
            <DialogDescription>
              {"Make changes to your task. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Container Image</Label>
            <div>
              <div className="inline-flex items-center gap-1 rounded-full border  border-gray-200 bg-gray-100 px-2 py-1 text-sm font-medium text-zinc-600">
                <Box size={14} />
                {data.containerImage}
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

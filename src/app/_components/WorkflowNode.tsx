"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { cn } from "~/lib/utils";
import { type WorkflowNodeProjection } from "~/server/api/routers/workflow";

function WorkflowNode({ data, selected }: NodeProps<WorkflowNodeProjection>) {
  const isRoot = data.isRoot;
  const hasInput = data.hasInput;

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 bg-white px-4 py-2 shadow-md",
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
            <div className="text-sm text-gray-500">{data.containerImage}</div>
          ) : (
            <div className="text-sm text-gray-500">Missing container image</div>
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
  );
}

export default memo(WorkflowNode);

import { type Db } from "mongodb";
import {
  type WorkflowNode,
  type RunNodeDepStatus,
  type WorkflowRun,
  type Workflow,
  type RunNodeServiceMapping,
  type RunStatus,
} from "~/server/api/routers/workflow";
import { createDbConnection } from "~/server/db/db";
import { createService } from "~/server/railway-client";

export const dynamic = "force-dynamic";

async function recordDeploymentEvent(
  db: Db,
  workflowId: string,
  payload: DeploymentWebhookPayload,
) {
  const railwayServiceId = payload.service.id;
  const runsCollection = db.collection<WorkflowRun>("runs");
  const run = await runsCollection.findOne({
    workflowPublicId: workflowId,
    nodesServiceMappings: {
      $elemMatch: {
        railwayServiceId: railwayServiceId,
      },
    },
  });

  if (!run) {
    const msg = `Couldn't find run by containing a railway service id ${railwayServiceId}`;
    console.log("Error", msg);
    throw new Error(msg);
  }

  // If we already finished processing this run, we can ignore future events
  // like railways' REMOVED events
  if (run.status === "COMPLETED" || run.status === "FAILED") {
    console.log(
      `BAILED on incoming event for service ${railwayServiceId}, with status ${payload.status}`,
    );
    return;
  }

  const relevantNodeMapping = run.nodesServiceMappings.find(
    (sm) => sm.railwayServiceId === railwayServiceId,
  );

  if (!relevantNodeMapping) {
    throw new Error(
      `Node with railway service ${railwayServiceId} doesn't exist in run`,
    );
  }

  const relevantNodeId = relevantNodeMapping.nodeId;
  const now = new Date();

  const newNodeDepStatus = {
    nodeId: relevantNodeId,
    recordedStatus: payload.status,
    recoredAt: now,
  } satisfies RunNodeDepStatus;

  const newStatuses = [...run.nodeDeploymentStatuses, newNodeDepStatus];
  run.nodeDeploymentStatuses = newStatuses;

  const nodesToRun = getNextNodesToRun(run, newNodeDepStatus);

  console.log("nodesToRun:", nodesToRun);

  if (nodesToRun.length === 0) {
    // If we don't have any more nodes to run we either:
    // - Ran into a failuire, in which case we mark the run as FAILED and save current updates.
    // - We are currently dealing with the root, which
    //   - Completed successfully, so we mark the run as COMPLETED
    //   - Or is still in flight so we continue
    // - We still have things in flight, so we save the current status and move on. Next event should resolve

    let newStatus: RunStatus = "RUNNING";

    if (payload.status === "FAILED") {
      newStatus = "FAILED";
    } else {
      const currentNode = run.nodes.find((n) => n.publicId === relevantNodeId)!;
      const isCurrentRoot = currentNode.isRoot;
      if (isCurrentRoot) {
        newStatus = payload.status === "SUCCESS" ? "COMPLETED" : "RUNNING";
      }
    }

    run.status = newStatus;
    run.updatedAt = now;

    console.log("beforeupdate", payload.status, run.status);
    await runsCollection.updateOne(
      {
        _id: run._id,
      },
      {
        $set: {
          status: newStatus,
          nodeDeploymentStatuses: newStatuses,
          updatedAt: now,
        },
      },
    );

    // TODO: Emit realtime even here

    return;
  }

  // TODO: Emit realtime even here

  const workflowCollection = db.collection<Workflow>("workflow");
  const workflow = await workflowCollection.findOne({
    publicId: workflowId,
  });

  if (!workflow) {
    throw new Error(`Couldn't find workflow id ${workflowId}`);
  }

  const createServicesRes = await Promise.all(
    nodesToRun.map(async (n) => {
      const createRes = await createService(
        workflow.apiKey,
        workflow.projectId,
        `${n.name} at ${now.getTime()}`,
        n.containerImage!,
        n.variables,
      );

      return {
        nodeId: n.publicId,
        railwayServiceId: createRes.serviceCreate.id,
      } as const;
    }),
  );

  const newMappings = createServicesRes.map<RunNodeServiceMapping>((r) => ({
    nodeId: r.nodeId,
    railwayServiceId: r.railwayServiceId,
  }));

  // record new service mappings
  const newNodeServiceMappings = [...run.nodesServiceMappings, ...newMappings];
  run.nodesServiceMappings = newNodeServiceMappings;

  console.log("recordDeploymentEvent new nodes", {
    workflowRun: run,
    res: createServicesRes.map(
      ({ nodeId, railwayServiceId }) => `${nodeId}: ${railwayServiceId} `,
    ),
  });

  run.updatedAt = now;
  await runsCollection.updateOne(
    {
      _id: run._id,
    },
    {
      $set: {
        nodeDeploymentStatuses: newStatuses,
        nodesServiceMappings: newNodeServiceMappings,
        updatedAt: now,
      },
    },
  );

  // TODO emit another realtime event
}

function getNextNodesToRun(
  workflowRun: WorkflowRun,
  currentStatus: RunNodeDepStatus,
): Array<WorkflowNode> {
  const nextNodes: Array<WorkflowNode> = [];
  if (currentStatus.recordedStatus === "SUCCESS") {
    const edgesWhereCurrentNodeIsSource = workflowRun.edges.filter(
      (e) => e.source === currentStatus.nodeId,
    );

    if (edgesWhereCurrentNodeIsSource.length === 0) {
      return nextNodes;
    }

    const completedNodes = workflowRun.nodeDeploymentStatuses
      .filter((status) => status.recordedStatus === "SUCCESS")
      .map((status) => status.nodeId);

    const ranNodes = workflowRun.nodeDeploymentStatuses.map(
      (status) => status.nodeId,
    );

    console.log("getNextNodesToRun currentStatus", currentStatus);
    console.log(
      "getNextNodesToRun outgoing edges",
      edgesWhereCurrentNodeIsSource,
    );
    console.log("getNextNodesToRun completedNodes", completedNodes);
    console.log("getNextNodesToRun ranNodes", ranNodes);

    edgesWhereCurrentNodeIsSource.forEach((edge) => {
      const nodeCandidate = workflowRun.nodes.find(
        (n) => n.publicId === edge.target,
      )!;

      const hasRan = ranNodes.includes(nodeCandidate.publicId);
      if (hasRan) {
        return;
      }

      const edgesIntoCandidate = workflowRun.edges.filter(
        (e) => e.target === nodeCandidate.publicId,
      );

      console.log("edgesIntoCandidate", edgesIntoCandidate);

      const allIncomingCompleted = edgesIntoCandidate.every((e) =>
        completedNodes.includes(e.source),
      );

      if (!allIncomingCompleted) {
        return;
      }

      nextNodes.push(nodeCandidate);
    });
  }
  return nextNodes;
}

export async function POST(
  request: Request,
  { params }: { params: { workflowId: string } },
) {
  const workflowId = params.workflowId;
  const payload = (await request.json()) as DeploymentWebhookPayload;

  const shouldHandle = ["DEPLOYING", "SUCCESS", "FAILED"].includes(
    payload.status,
  );
  if (!shouldHandle) {
    console.log(
      `Correctly ignored event ${payload.status} for service ${payload.service.id}`,
    );
    return;
  }

  const db = await createDbConnection();
  await recordDeploymentEvent(db, workflowId, payload);

  return new Response("Success!", {
    status: 200,
  });
}

interface DeploymentWebhookPayload {
  type: "DEPLOY";
  project: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
  };
  deployment: {
    id: string;
    meta: {
      image: string;
      logsV2: boolean;
      volumeMounts: unknown[];
      serviceManifest: Record<string, unknown>;
    };
    creator: {
      id: string;
      name: string;
      avatar: string;
    };
  };
  environment: {
    id: string;
    name: string;
  };
  status: "DEPLOYING" | "SUCCESS" | "FAILED";
  timestamp: string;
  service: {
    id: string;
    name: string;
  };
}

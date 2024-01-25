export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { workflowId: string } },
) {
  const workFlowId = params.workflowId;
  const req = (await request.json()) as unknown;
  console.log(`Webhook call for wf: ${workFlowId}" with`, req);

  return new Response("Success!", {
    status: 200,
  });
}

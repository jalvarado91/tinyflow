export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { workflowId: string } },
) {
  const workflowId = params.workflowId;
  const req = (await request.json()) as unknown;
  console.log(`Webhook call for wf: ${workflowId}" with`, req);

  return new Response("Success!", {
    status: 200,
  });
}

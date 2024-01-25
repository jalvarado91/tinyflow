import { request, gql } from "graphql-request";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";

export const apiUrl = "https://backboard.railway.app/graphql/v2";

export async function createProjectWebhook(
  token: string,
  projectId: string,
  webhookUrl: string,
) {
  const mutation: TypedDocumentNode<
    { id: string; lastStatus: string },
    { projectId: string; url: string }
  > = parse(gql`
    mutation CreateWebhook($projectId: String!, $url: String!) {
      webhookCreate(input: { projectId: $projectId, url: $url }) {
        id
        lastStatus
      }
    }
  `);

  const variables = {
    projectId,
    url: webhookUrl,
  };

  const data = await request(apiUrl, mutation, variables, {
    Authorization: `Bearer ${token}`,
  });

  return data;
}

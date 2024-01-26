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

export async function createService(
  token: string,
  projectId: string,
  name: string,
  containerImage: string,
  variables: Array<{ name: string; value: string }>,
) {
  const mutation: TypedDocumentNode<
    {
      serviceCreate: {
        id: string;
        name: string;
      };
    },
    {
      name: string;
      image: string;
      projectId: string;
      variables: Record<string, string>;
    }
  > = parse(gql`
    mutation CreateService(
      $projectId: String!
      $name: String!
      $image: String!
      $variables: ServiceVariables
    ) {
      serviceCreate(
        input: {
          name: $name
          projectId: $projectId
          source: { image: $image }
          variables: $variables
        }
      ) {
        id
        name
        deployments {
          edges {
            node {
              id
              status
            }
          }
        }
      }
    }
  `);

  const data = await request(
    apiUrl,
    mutation,
    {
      name,
      projectId,
      image: containerImage,
      variables: variables.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.name]: curr.value,
        };
      }, {}),
    },
    {
      Authorization: `Bearer ${token}`,
    },
  );

  return data;
}

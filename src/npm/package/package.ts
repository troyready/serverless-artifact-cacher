/**
 * \<npmendpoint\>/ API
 *
 * @packageDocumentation
 */

import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import "source-map-support/register";
import { app } from "../NpmApp";

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const npmPackageName = decodeURIComponent(event!.pathParameters!.proxy);
  const npmPackage = app.getNpmPackage(npmPackageName);
  return {
    body: await npmPackage.getRegistryEntry(),
    headers: { "Content-Type": "application/vnd.npm.install-v1+json" },
    statusCode: 200,
  };
};

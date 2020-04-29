/**
 * \<npmendpoint\>/ API
 *
 * @packageDocumentation
 */

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from "aws-lambda";
import "source-map-support/register";
import { NpmPackage } from '../NpmPackage';

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const cacheUriPrefix = "https://" + event!.requestContext.domainName +
    "/" + event!.requestContext.stage + "/npm-dlredirect";
  const npmPackageName = decodeURIComponent(event!.pathParameters!.proxy);
  const npmPackage = new NpmPackage(cacheUriPrefix, npmPackageName);
  return {
    body: await npmPackage.getRegistryEntry(),
    headers: { "Content-Type": "application/vnd.npm.install-v1+json" },
    statusCode: 200,
  }

};

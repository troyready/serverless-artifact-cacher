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
import { APP, NpmApp } from "../NpmApp";

export class PackageHandler {
  constructor(private app: NpmApp = APP) {}

  async handle(
    event: APIGatewayProxyEvent,
    context: Context,
  ): Promise<APIGatewayProxyResult> {
    const npmPackageName = decodeURIComponent(event!.pathParameters!.proxy);
    const npmPackage = this.app.getNpmPackage(npmPackageName);
    return {
      body: await npmPackage.getRegistryEntry(),
      headers: { "Content-Type": "application/vnd.npm.install-v1+json" },
      statusCode: 200,
    };
  }
}

const HANDLER = new PackageHandler();

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = (event, context) => {
  return HANDLER.handle(event, context);
};

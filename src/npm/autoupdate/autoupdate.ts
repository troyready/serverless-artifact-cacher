/**
 * Automatic updater function for npm cache
 *
 * @packageDocumentation
 */
import {
  Context,
  Handler,
  ScheduledEvent,
  APIGatewayProxyEvent,
} from "aws-lambda";
import { APP, NpmApp } from "../NpmApp";
import "source-map-support/register";

export class AutoUpdateHandler {
  constructor(private app: NpmApp = APP) {}

  async handle(event: ScheduledEvent, context: Context): Promise<any> {
    var packageUpdates: Promise<any>[] = [];
    for await (const packageName of this.app.s3Cache.list()) {
      const npmPackage = this.app.getNpmPackage(packageName);
      packageUpdates.push(npmPackage.updateRegistryEntry());
    }
    await Promise.all(packageUpdates);
    return {
      body: JSON.stringify({ message: "done" }),
      statusCode: 200,
    };
  }
}

const HANDLER = new AutoUpdateHandler();

/** AWS Lambda entrypoint */
export let handler: Handler = async (event, context): Promise<any> => {
  return HANDLER.handle(event, context);
};

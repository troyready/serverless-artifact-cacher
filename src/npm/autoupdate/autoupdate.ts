/**
 * Automatic updater function for npm cache
 *
 * @packageDocumentation
 */
import { Context, Handler, ScheduledEvent } from "aws-lambda";
import { app } from "../NpmApp";
import "source-map-support/register";

/** AWS Lambda entrypoint */
export let handler: Handler = async (
  event: ScheduledEvent,
  context: Context,
): Promise<any> => {
  var packageUpdates: Promise<any>[] = [];
  for await (const packageName of app.s3Cache.list()) {
    const npmPackage = app.getNpmPackage(packageName);
    packageUpdates.push(npmPackage.updateRegistryEntry());
  }
  await Promise.all(packageUpdates);
  return {
    body: JSON.stringify({ message: "done" }),
    statusCode: 200,
  };
};

/**
 * Automatic updater function for npm cache
 *
 * @packageDocumentation
 */
import { Context, Handler, ScheduledEvent } from "aws-lambda";
import { S3Cache } from '../S3Cache'
import { NpmPackage } from '../NpmPackage'
import "source-map-support/register";

const NPM_CACHE_DOWNLOAD_URI = process.env.NPM_CACHE_DOWNLOAD_URI!;

/** AWS Lambda entrypoint */
export let handler: Handler = async (
  event: ScheduledEvent,
  context: Context,
): Promise<any> => {
  const s3Cache = new S3Cache();
  var packageUpdates: Promise<any>[] = [];
  for await (const packageName of s3Cache.list()) {
    const npmPackage = new NpmPackage(NPM_CACHE_DOWNLOAD_URI, packageName);
    packageUpdates.push(npmPackage.updateRegistryEntry());
  }
  await Promise.all(packageUpdates);
  return {
    body: JSON.stringify({ message: "done" }),
    statusCode: 200,
  };
};

/**
 * Automatic updater function for npm cache
 *
 * @packageDocumentation
 */

import { Context, Handler, ScheduledEvent } from "aws-lambda";
import { ScanPaginator } from "@aws/dynamodb-query-iterator";
import * as DynamoDB from "aws-sdk/clients/dynamodb";
import { getRegistryEntryForPackage } from "../util/registry";
import "source-map-support/register";
import * as util from "util";
import * as zlib from "zlib";

const DDBDocClient = new DynamoDB.DocumentClient();
const zlibInflatePromise = util.promisify(zlib.inflate);
const tableName = process.env.DDB_TABLE!;
const NPM_CACHE_DOWNLOAD_URI = process.env.NPM_CACHE_DOWNLOAD_URI!;

/** Parse compressed DDB entry */
async function parseDdbEntry(compressedData: any): Promise<any> {
  const inflatedData: any = await zlibInflatePromise(compressedData);
  return JSON.parse(inflatedData.toString());
}

/** Update DDB entry with new packages */
async function updateDdbEntry(entry: any): Promise<any> {
  var packageName = entry.PackageName;
  var downloadUriPrefix = NPM_CACHE_DOWNLOAD_URI + "/" + packageName + "/";

  // Retrieve upstream registryData & DDB cached ddbData
  var [registryData, ddbData] = (await Promise.all([
    getRegistryEntryForPackage(packageName),
    parseDdbEntry(entry["CompressedRegistryData"]),
  ])) as any;

  if (Date.parse(ddbData["modified"]) < Date.parse(registryData["modified"])) {
    console.log(
      "Package " +
        packageName +
        " has been modified upstream; updating its ddb entry",
    );
    Object.keys(registryData).forEach(function(value, _index, _array) {
      if (value === "versions") {
        Object.keys(registryData["versions"]).forEach(function(
          versionNumber,
          _versionIndex,
          _versionArray,
        ) {
          // Leaving existing entries untouched.
          if (!(versionNumber in ddbData["versions"])) {
            console.log(
              "Adding new version " +
                versionNumber +
                " to " +
                packageName +
                " entry.",
            );
            ddbData["versions"][versionNumber] =
              registryData["versions"][versionNumber];
            // update download links to point to proxy endpoint
            ddbData["versions"][versionNumber]["dist"]["tarball"] =
              downloadUriPrefix + versionNumber;
          }
        });
      } else {
        ddbData[value] = registryData[value];
      }
    });
    await DDBDocClient.put({
      TableName: tableName,
      Item: {
        PackageName: packageName,
        CompressedRegistryData: zlib.deflateSync(JSON.stringify(ddbData)),
      },
    }).promise();
  }
}

/** AWS Lambda entrypoint */
export let handler: Handler = async (
  event: ScheduledEvent,
  context: Context,
): Promise<any> => {
  const paginator = new ScanPaginator((DDBDocClient as unknown) as DynamoDB, {
    TableName: tableName,
  });

  var packageUpdates: Promise<any>[] = [];
  for await (const page of paginator) {
    for (const i in page.Items) {
      packageUpdates.push(updateDdbEntry(page.Items[i]));
    }
  }

  await Promise.all(packageUpdates);

  return {
    body: JSON.stringify({ message: "done" }),
    statusCode: 200,
  };
};

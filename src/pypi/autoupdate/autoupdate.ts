/**
 * Automatic updater function for pypi cache
 *
 * @packageDocumentation
 */

import { Context, Handler, ScheduledEvent } from "aws-lambda";
import { ScanPaginator } from "@aws/dynamodb-query-iterator";
import * as DynamoDB from "aws-sdk/clients/dynamodb";
import { getPyPiFilesForPackage } from "../util/pypi";
import "source-map-support/register";

const DDBDocClient = new DynamoDB.DocumentClient();
const tableName = process.env.DDB_TABLE!;

/** Update DDB entry with new packages */
async function updateDdbEntry(entry: any): Promise<any> {
  var packageName = entry.PackageName;

  // Retrieve upstream pypi file list
  var pypiFiles = await getPyPiFilesForPackage(packageName);

  // add new files
  var filesAdded: boolean = false;
  Object.keys(pypiFiles).forEach(function(value, _index, _array) {
    if (!(value in entry["PackageFiles"])) {
      filesAdded = true;
      console.log(
        "Adding new file " + value + " to " + packageName + " entry.",
      );
      entry["PackageFiles"][value] = pypiFiles[value];
    }
  });

  // update ddb entry
  if (filesAdded) {
    await DDBDocClient.put({
      TableName: tableName,
      Item: entry,
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

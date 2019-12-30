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
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { getRegistryEntryForPackage } from "../util/registry";
import "source-map-support/register";
import * as zlib from "zlib";

const DDBDocClient = new DocumentClient();
const tableName = process.env.DDB_TABLE!;

/** Get or create DDB entry with map of files for package and return it
 *
 * Registry data is stored compressed in DDB for 2 reasons:
 * 1) Not all registry data maps cleanly to a DDB item (e.g. empty strings)
 * 2) Some items (e.g. @types/node) have too much data to store uncompressed
 */
async function getPackageJson(
  packageName: string,
  downloadPrefix: string,
): Promise<string> {
  try {
    console.log(
      "Checking " + tableName + " for existing " + packageName + " entry.",
    );
    const cachedList = await DDBDocClient.get({
      TableName: tableName,
      Key: { PackageName: packageName },
    }).promise();
    console.log("Existing package found; returning it.");
    return zlib.inflateSync(cachedList.Item!.CompressedRegistryData).toString();
  } catch (ddbGetError) {
    console.log(
      "No existing " +
        packageName +
        " entry found; retrieving it from upstream.",
    );
    var registryData = await getRegistryEntryForPackage(packageName);

    // update download links to point to proxy endpoint
    Object.keys(registryData["versions"]).forEach(function(
      value,
      _index,
      _array,
    ) {
      registryData["versions"][value]["dist"]["tarball"] =
        downloadPrefix + value;
    });

    await DDBDocClient.put({
      TableName: tableName,
      Item: {
        PackageName: packageName,
        CompressedRegistryData: zlib.deflateSync(JSON.stringify(registryData)),
      },
    }).promise();
    return JSON.stringify(registryData);
  }
}

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  var npmPackageName = decodeURIComponent(event!.pathParameters!.proxy);
  var downloadUriPrefix =
    "https://" +
    event!.requestContext.domainName +
    "/" +
    event!.requestContext.stage +
    "/npm-dlredirect/" +
    npmPackageName +
    "/";

  return {
    body: await getPackageJson(npmPackageName, downloadUriPrefix),
    headers: { "Content-Type": "application/vnd.npm.install-v1+json" },
    statusCode: 200,
  };
};

/**
 * \<npmendpoint\>/ API
 *
 * @packageDocumentation
 */

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from "aws-lambda";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { getRegistryEntryForPackage } from "../util/registry";
import "source-map-support/register";
import * as zlib from "zlib";

export const DDBDocClient = new DocumentClient();
const tableName = process.env.DDB_TABLE!;

export class DDBCache {

  tableName: string = tableName;
  
  documentClient: DocumentClient = DDBDocClient;

  put(npmPackageName: string, registryEntry: any): Promise<any> {
    return this.documentClient.put({
      TableName: this.tableName,
      Item: {
        PackageName: npmPackageName,
        CompressedRegistryData: zlib.deflateSync(JSON.stringify(registryEntry)),
      },
    }).promise()
  }

  get(npmPackageName: string): Promise<string> {
    console.log(`Checking ${this.tableName} for existing ${npmPackageName} entry.`);
    return this.documentClient.get({
      TableName: this.tableName,
      Key: { PackageName: npmPackageName },
    }).promise().then(response => {
      console.log("Existing package found; returning it.");
      return zlib.inflateSync(response.Item!.CompressedRegistryData).toString();
    });

  }

}

export class NpmPackage {

  cache: DDBCache = new DDBCache();

  constructor(
    public cacheUriPrefix: string,
    public npmPackageName: string) {
  }

  getRegistryEntryFromNpm(): Promise<any> {
    return getRegistryEntryForPackage(this.npmPackageName);
  }

  cacheRegistryEntry(registryEntry): Promise<any> {
    // update download links to point to proxy endpoint
    const versions = registryEntry["versions"];
    Object.keys(versions).forEach((key) => {
      versions[key]["dist"]["tarball"] = `${this.cacheUriPrefix}/${this.npmPackageName}/${key}`
    });
    return this.cache.put(this.npmPackageName, registryEntry);
  }

  getRegistryEntryFromCache(): Promise<string> {
    return this.cache.get(this.npmPackageName);
  }

  /** 
   * Get or create DDB entry with map of files for package and return it
   *
   * Registry data is stored compressed in DDB for 2 reasons:
   * 1) Not all registry data maps cleanly to a DDB item (e.g. empty strings)
   * 2) Some items (e.g. @types/node) have too much data to store uncompressed
   */
  getRegistryEntry(): Promise<string> {
    return this.getRegistryEntryFromCache()
      .catch(error => this.getRegistryEntryFromNpm()
        .then(registryEntry => this.cacheRegistryEntry(registryEntry)
          .then(() => JSON.stringify(registryEntry)))
      )
  }

}

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

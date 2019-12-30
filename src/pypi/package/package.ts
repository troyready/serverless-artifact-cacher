/**
 * \<pypiendpoint\>/<\packagename\> API
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
import { getPyPiFilesForPackage } from "../util/pypi";
import "source-map-support/register";

const DDBDocClient = new DocumentClient();
const tableName = process.env.DDB_TABLE!;

/** Get or create DDB entry with map of files for package and return it */
async function getPackageFiles(packageName: string): Promise<any> {
  try {
    const cachedList = await DDBDocClient.get({
      TableName: tableName,
      Key: { PackageName: packageName },
    }).promise();
    return cachedList.Item!.PackageFiles;
  } catch (err) {
    // No cached entry yet exists; create it
    const packageFiles = await getPyPiFilesForPackage(packageName);
    await DDBDocClient.put({
      TableName: tableName,
      Item: { PackageName: packageName, PackageFiles: packageFiles },
    }).promise();
    return packageFiles;
  }
}

/** Create HTML list of packages for response */
function createHtmlList(
  packageName: string,
  packageFiles: any,
  downloadUriPrefix: string,
): string {
  let responseHTML = `<!DOCTYPE html>
  <html>
    <head>
      <title>Links for ${packageName}</title>
    </head>
    <body>
      <h1>Links for ${packageName}</h1>
`;
  for (const x in packageFiles) {
    responseHTML += `      <a href="${downloadUriPrefix + x}"${
      "data-requires-python" in packageFiles[x]
        ? ' data-requires-python="' +
          packageFiles[x]["data-requires-python"] +
          '"'
        : ""
    }>${x}</a><br/>
`;
  }
  responseHTML += `    </body>
</html>
`;
  return responseHTML;
}

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  var pypiPackageName = event!.pathParameters!.proxy;

  var downloadUriPrefix =
    "https://" +
    event!.requestContext.domainName +
    "/" +
    event!.requestContext.stage +
    "/pypi-dlredirect/" +
    pypiPackageName +
    "/";

  const packageFiles = await getPackageFiles(pypiPackageName);

  return {
    body: createHtmlList(pypiPackageName, packageFiles, downloadUriPrefix),
    headers: { "Content-Type": "text/html" },
    statusCode: 200,
  };
};

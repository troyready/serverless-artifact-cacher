/**
 * \<pypiendpoint\>/ API
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
import "source-map-support/register";

const DDBDocClient = new DocumentClient();
const tableName = process.env.DDB_TABLE!;

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  var hrefPrefix = "/" + event!.requestContext.stage + "/pypi";

  const scanResult = await DDBDocClient.scan({
    TableName: tableName,
  }).promise();

  let responseHTML = `<!DOCTYPE html>
  <html>
    <head>
      <title>Simple index</title>
    </head>
    <body>
`;
  for (const i in scanResult.Items) {
    responseHTML += `      <a href="${hrefPrefix}/${scanResult.Items[i].PackageName}/">${scanResult.Items[i].PackageName}</a><br/>
`;
  }
  responseHTML += `    </body>
</html>
`;

  return {
    body: responseHTML,
    headers: { "Content-Type": "text/html" },
    statusCode: 200,
  };
};

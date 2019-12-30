/**
 * \<npmendpoint\>/- API
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

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  return {
    body: "",
    headers: {
      "npm-notice":
        "update to the newest npm client for improved search results: npmjs.com/get-npm",
    },
    statusCode: 406,
  };
};

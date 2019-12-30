import { handler } from "./hyphen";

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

describe("Test handler", () => {
  test("Verify 406 is returned", async () => {
    function unusedCallback<T>() {
      return (undefined as any) as T;
    }

    const data = await handler(
      {} as APIGatewayProxyEvent,
      {} as Context,
      unusedCallback<any>(),
    );
    expect((data as APIGatewayProxyResult).statusCode).toBe(406);
  });
});

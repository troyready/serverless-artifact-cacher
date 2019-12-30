/**
 * \<npm-support-endpoint\>/dlredirect API
 *
 * @packageDocumentation
 */

import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import * as request from "request-promise-native";
import "source-map-support/register";
import { cacheOnS3 } from "../../util/cache";
import { S3Adapter } from "../../util/s3";

const bucketName = process.env.BUCKET_NAME!;
const urlExpiry = 21600; // 6 hours; max for url from metadata creds
const s3Client = new S3Adapter();

/** Return S3 link to python package */
async function getPackageLink(
  packageName: string,
  packageVersion: string,
): Promise<string> {
  var s3Key = packageName + "/" + packageVersion + ".tgz";

  try {
    await s3Client
      .headObject({
        Bucket: bucketName!,
        Key: s3Key,
      })
      .promise();
    console.log(
      "Found " +
        packageName +
        " version " +
        packageVersion +
        " in cache; skipping redownload.",
    );
  } catch (err) {
    if (err.code === "NotFound") {
      console.log(
        packageName +
          " version " +
          packageVersion +
          " not found in cache; uploading to s3.",
      );
      // would be nice to be able to get just the specific version details
      // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#getpackageversion
      // but this won't always work (e.g. 401 "ERROR: you cannot fetch versions for scoped packages")
      const upstreamList = await request.get({
        uri: "https://registry.npmjs.org/" + packageName,
      });
      await cacheOnS3(
        JSON.parse(upstreamList)["versions"][packageVersion]["dist"]["tarball"],
        s3Client,
        bucketName,
        s3Key,
      );
    } else {
      throw err;
    }
  }
  return await s3Client.getSignedUrlPromise("getObject", {
    Bucket: bucketName,
    Expires: urlExpiry,
    Key: s3Key,
  });
}

/** AWS Lambda entrypoint */
export let handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  var urlMatch = event!.pathParameters!.proxy.match(/(.*)\/(.*)$/);
  var npmPackageName = urlMatch![1];
  var npmPackageVersion = urlMatch![2];

  const downloadLink = await getPackageLink(npmPackageName, npmPackageVersion);

  const response = {
    body: "",
    statusCode: 302,
    headers: {
      Location: downloadLink,
    },
  };

  return response;
};

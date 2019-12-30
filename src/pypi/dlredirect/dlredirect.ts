/**
 * \<pypi-support-endpoint\>/dlredirect API
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
import * as cheerio from "cheerio";
import "source-map-support/register";
import { cacheOnS3 } from "../../util/cache";
import { S3Adapter } from "../../util/s3";

const bucketName = process.env.BUCKET_NAME!;
const urlExpiry = 21600; // 6 hours; max for url from metadata creds
const s3Client = new S3Adapter();

/** Return S3 link to python package */
async function getPackageLink(
  packageName: string,
  fileName: string,
): Promise<string> {
  var s3Key = packageName + "/" + fileName;

  try {
    await s3Client
      .headObject({
        Bucket: bucketName!,
        Key: s3Key,
      })
      .promise();
    console.log("Found " + fileName + " in cache; skipping redownload.");
  } catch (err) {
    if (err.code === "NotFound") {
      console.log(fileName + " not found in cache; uploading to s3.");
      const upstreamList = await request.get({
        uri: "https://pypi.org/simple/" + packageName + "/",
      });
      var parsedupstreamList = cheerio.load(upstreamList);
      var upstreamUrl = "";
      parsedupstreamList
        .root()
        .find("a")
        .each(function(_index, _element) {
          if (parsedupstreamList(this).text() === fileName) {
            upstreamUrl = parsedupstreamList(this).attr("href")!;
          }
        });
      await cacheOnS3(upstreamUrl, s3Client, bucketName, s3Key);
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
  var pypiPackageName = event!.pathParameters!.proxy.split("/")[0];
  var pypiPackageFile = event!.pathParameters!.proxy.split("/")[1];

  const downloadLink = await getPackageLink(pypiPackageName, pypiPackageFile);

  const response = {
    body: "",
    statusCode: 302,
    headers: {
      Location: downloadLink,
    },
  };

  return response;
};

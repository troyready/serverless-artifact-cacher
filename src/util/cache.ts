/**
 * cache util module
 *
 * @packageDocumentation
 */

import { S3Adapter } from "./s3";
import bl from "bl";
import * as request from "request-promise-native";

/** Place URL contents on S3 */
export let cacheOnS3 = async (
  url: string,
  s3Client: S3Adapter,
  s3Bucket: string,
  s3Key: string,
): Promise<any> => {
  var mimeType = "";
  await new Promise((resolve, reject) => {
    request
      .get(url)
      .on("response", function(response) {
        mimeType = response.headers["content-type"]!;
      })
      .pipe(
        bl(function(error, data) {
          s3Client
            .putObject({
              Bucket: s3Bucket,
              Key: s3Key,
              ContentType: mimeType,
              Body: data,
            })
            .promise()
            .then(resolve, reject);
        }),
      );
  });
};

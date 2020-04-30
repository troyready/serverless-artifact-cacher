import { S3 } from "aws-sdk";
import * as zlib from "zlib";
import { ListObjectsV2Request } from "aws-sdk/clients/s3";

const BUCKET_NAME: string = process.env.BUCKET_NAME!;
const INDEX_NAME: string = "index.gz";

export class S3Cache {
  bucketName: string = BUCKET_NAME;
  maxKeys: number | undefined = undefined;
  s3: S3 = new S3();

  put(npmPackageName: string, registryEntry: string): Promise<any> {
    console.log(
      `Caching ${npmPackageName} registry entry in ${this.bucketName}.`,
    );
    return this.s3
      .putObject({
        Bucket: this.bucketName!,
        Key: `${npmPackageName}/${INDEX_NAME}`,
        ContentType: "application/x-gzip",
        Body: zlib.gzipSync(registryEntry),
      })
      .promise();
  }

  get(npmPackageName: string): Promise<string> {
    console.log(
      `Checking ${this.bucketName} for existing ${npmPackageName} registry entry.`,
    );
    return this.s3
      .getObject({
        Bucket: this.bucketName!,
        Key: `${npmPackageName}/${INDEX_NAME}`,
      })
      .promise()
      .then(data => {
        console.log(
          `Existing ${npmPackageName} registry entry found; returning it.`,
        );
        const buffer = data.Body as Buffer;
        return zlib.gunzipSync(buffer).toString();
      });
  }

  async *list(): any {
    const opts = {
      Bucket: this.bucketName,
      MaxKeys: this.maxKeys,
      Delimiter: "/",
    } as ListObjectsV2Request;
    do {
      const response = await this.s3.listObjectsV2(opts).promise();
      opts.ContinuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
      const keys =
        response.CommonPrefixes?.map(prefix => prefix.Prefix?.slice(0, -1)) ||
        [];
      for (const key of keys) {
        yield key;
      }
    } while (opts.ContinuationToken);
  }
}

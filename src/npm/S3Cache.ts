import { S3 } from "aws-sdk";
import * as zlib from "zlib";
import { ListObjectsV2Request } from "aws-sdk/clients/s3";

const INDEX_NAME: string = "index.gz";

/*
 * A registry entry cache backed by S3
 */
export class S3Cache {
  maxKeys: number | undefined = undefined;

  constructor(private s3: S3, private bucketName: string) {}

  /*
   * stores the registry entry in the cache
   */
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

  /*
   * gets the registry from the cache
   */
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

  /*
   * Generator that returns an async iterable with all npm package keys in the cache.
   *
   * Clients can access the package names with following code:
   *
   * <pre>
   * for await (const packageName of s3Cache.list()) {
   *   // do stuff
   * }
   * </pre>
   */
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

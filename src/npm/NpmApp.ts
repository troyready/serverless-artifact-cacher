import { S3 } from "aws-sdk";
import { S3Cache } from "./S3Cache";
import { NpmPackage } from "./NpmPackage";

const BUCKET_NAME: string = process.env.BUCKET_NAME!;
const NPM_CACHE_DOWNLOAD_URI = process.env.NPM_CACHE_DOWNLOAD_URI!;

/*
 * Entry point to access any service of the NPM artifact cacher.
 * It creates all instances and provides a single point of access
 * to lambda handlers.
 */
export class NpmApp {
  readonly s3: S3 = new S3();
  readonly s3Cache = new S3Cache(this.s3, BUCKET_NAME);

  getNpmPackage(packageName: string) {
    return new NpmPackage(this.s3Cache, NPM_CACHE_DOWNLOAD_URI, packageName);
  }
}

// app singleton
export const APP = new NpmApp();

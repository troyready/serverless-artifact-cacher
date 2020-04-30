import * as AWS from "aws-sdk";
import { S3Cache } from "./S3Cache";
import * as sinon from "sinon";
import * as zlib from "zlib";

describe("S3Cache", () => {
  test("stores a registry entry", async () => {
    const registryEntry = "bar";
    const Body = zlib.gzipSync(registryEntry);

    const putStub = sinon.stub();
    putStub.returns({ promise: () => Promise.resolve() });
    const getStub = sinon.stub();
    getStub.returns({ promise: () => Promise.resolve({ Body }) });

    const cache: S3Cache = new S3Cache();
    cache.bucketName = "bucketName";
    cache.s3 = { getObject: getStub, putObject: putStub } as any;
    await cache.put("foo", registryEntry);
    const actual = await cache.get("foo");

    expect(actual).toBe(registryEntry);
    sinon.assert.calledWith(putStub, {
      Bucket: "bucketName",
      Key: "foo/index.gz",
      ContentType: "application/x-gzip",
      Body,
    });
    sinon.assert.calledWith(getStub, {
      Bucket: "bucketName",
      Key: "foo/index.gz",
    });
  });

  test("list packages", async () => {
    const listStub = sinon.stub();
    listStub.returns({
      promise: () =>
        Promise.resolve({
          IsTruncated: false,
          CommonPrefixes: [{ Prefix: "foo/" }],
        }),
    });
    const cache: S3Cache = new S3Cache();
    cache.bucketName = "bucketName";
    cache.s3 = { listObjectsV2: listStub } as any;
    const list: string[] = [];
    for await (const key of cache.list()) {
      list.push(key);
    }
    expect(list.length).toBe(1);
    expect(list[0]).toBe("foo");
  });
});

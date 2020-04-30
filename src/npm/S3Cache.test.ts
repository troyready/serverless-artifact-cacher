import * as AWS from "aws-sdk";
import { S3Cache } from "./S3Cache";
import * as zlib from "zlib";

describe("S3Cache", () => {
  test("stores a registry entry", async () => {
    const registryEntry = "bar";
    const Body = zlib.gzipSync(registryEntry);

    const putStub = jest.fn();
    putStub.mockReturnValue({ promise: () => Promise.resolve() });
    const getStub = jest.fn();
    getStub.mockReturnValue({ promise: () => Promise.resolve({ Body }) });

    const cache: S3Cache = new S3Cache(
      { getObject: getStub, putObject: putStub } as any,
      "bucketName",
    );
    await cache.put("foo", registryEntry);
    const actual = await cache.get("foo");

    expect(actual).toBe(registryEntry);
    expect(putStub).toHaveBeenCalledWith({
      Bucket: "bucketName",
      Key: "foo/index.gz",
      ContentType: "application/x-gzip",
      Body,
    });
    expect(getStub).toHaveBeenCalledWith({
      Bucket: "bucketName",
      Key: "foo/index.gz",
    });
  });

  test("list packages", async () => {
    const listStub = jest.fn();
    listStub.mockReturnValue({
      promise: () =>
        Promise.resolve({
          IsTruncated: false,
          CommonPrefixes: [{ Prefix: "foo/" }],
        }),
    });
    const cache: S3Cache = new S3Cache(
      { listObjectsV2: listStub } as any,
      "bucketName",
    );
    const list: string[] = [];
    for await (const key of cache.list()) {
      list.push(key);
    }
    expect(list.length).toBe(1);
    expect(list[0]).toBe("foo");
  });
});

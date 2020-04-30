import { NpmPackage } from "./NpmPackage";
import { S3Cache } from "./S3Cache";

describe("NpmPackage", () => {
  let npmPackage: NpmPackage;
  let getRegistryEntryFromNpmStub: jest.Mock;
  let s3ListStub: jest.Mock;
  let s3GetObjectStub: jest.Mock;
  let s3PutObjectStub: jest.Mock;

  beforeEach(() => {
    const cacheUriPrefix = "http://localhost";
    const npmPackageName = "lodash";
    getRegistryEntryFromNpmStub = jest.fn();
    s3ListStub = jest.fn();
    s3GetObjectStub = jest.fn();
    s3PutObjectStub = jest.fn();
    const s3Cache: S3Cache = {
      list: s3ListStub,
      get: s3GetObjectStub,
      put: s3PutObjectStub,
    } as any;
    npmPackage = new NpmPackage(s3Cache, cacheUriPrefix, npmPackageName);
    npmPackage.getRegistryEntryFromNpm = getRegistryEntryFromNpmStub;
  });

  describe("getRegistryEntry", () => {
    test("returns an existing registry entry", async () => {
      // prepare stub
      const metadata = { foo: "bar" };
      s3GetObjectStub.mockResolvedValue(JSON.stringify(metadata));
      // get registry entry
      const registryEntry: string = await npmPackage.getRegistryEntry();
      expect(JSON.parse(registryEntry)).toStrictEqual(metadata);
    });

    test("returns and caches a new registry entry", async () => {
      // prepare stubs
      const expectedRegistryEntry = {
        versions: { "1.0": { dist: { tarball: "tarball" } } },
      };
      getRegistryEntryFromNpmStub.mockResolvedValue(expectedRegistryEntry);
      s3GetObjectStub.mockRejectedValue("");
      s3PutObjectStub.mockResolvedValue("");
      // get registry entry
      const registryEntry: string = await npmPackage.getRegistryEntry();
      expect(s3GetObjectStub).toHaveBeenCalledWith("lodash");
      expect(s3PutObjectStub).toHaveBeenCalledWith(
        npmPackage.npmPackageName,
        JSON.stringify(expectedRegistryEntry),
      );
      expect(JSON.parse(registryEntry)).toStrictEqual(expectedRegistryEntry);
    });
  });

  describe("update", () => {
    // this verifies a seamless migration from ddb to s3
    // when update is called then the registry entry is stored in s3
    test("must not fail if the entry is not cached", async () => {
      const modified = new Date().toISOString();
      s3GetObjectStub.mockRejectedValue("");
      s3PutObjectStub.mockResolvedValue("");
      const expectedRegistryEntry = {
        modified,
        versions: { "1.0": { dist: { tarball: "tarball" } } },
      };
      getRegistryEntryFromNpmStub.mockResolvedValue(expectedRegistryEntry);
      await npmPackage.updateRegistryEntry();
      expect(s3PutObjectStub.mock.calls.length).toBe(1);
    });

    test("cache is not updated if not stale", async () => {
      const modified = new Date().toISOString();
      s3GetObjectStub.mockResolvedValue(JSON.stringify({ modified }));
      getRegistryEntryFromNpmStub.mockResolvedValue({ modified });
      await npmPackage.updateRegistryEntry();
      expect(s3PutObjectStub).toHaveBeenCalledTimes(0);
    });

    test("existing cache entries remain unchanged", async () => {
      s3GetObjectStub.mockResolvedValue(
        JSON.stringify({
          modified: new Date(0).toISOString(),
          versions: {
            "1.0": { dist: { key: "foo" } },
          },
        }),
      );
      getRegistryEntryFromNpmStub.mockResolvedValue({
        modified: new Date(1).toISOString(),
        versions: {
          "1.0": { dist: { key: "bar" } },
        },
      });
      s3PutObjectStub.mockResolvedValue("");
      await npmPackage.updateRegistryEntry();
      expect(s3PutObjectStub).toHaveBeenCalledTimes(1);
      const args = s3PutObjectStub.mock.calls[0];
      expect(args[0]).toBe("lodash");
      expect(JSON.parse(args[1])).toStrictEqual({
        modified: "1970-01-01T00:00:00.001Z",
        versions: {
          "1.0": {
            dist: {
              key: "foo",
              tarball: "http://localhost/lodash/1.0",
            },
          },
        },
      });
    });

    test("new entries are appended", async () => {
      s3GetObjectStub.mockResolvedValue(
        JSON.stringify({
          modified: new Date(0).toISOString(),
          versions: {
            "1.0": { dist: {} },
          },
        }),
      );
      getRegistryEntryFromNpmStub.mockResolvedValue({
        modified: new Date(1).toISOString(),
        versions: {
          "2.0": { dist: {} },
        },
      });
      s3PutObjectStub.mockResolvedValue("");
      await npmPackage.updateRegistryEntry();
      const args = s3PutObjectStub.mock.calls[0];
      expect(args[0]).toBe("lodash");
      expect(JSON.parse(args[1])).toStrictEqual({
        modified: "1970-01-01T00:00:00.001Z",
        versions: {
          "1.0": { dist: { tarball: "http://localhost/lodash/1.0" } },
          "2.0": { dist: { tarball: "http://localhost/lodash/2.0" } },
        },
      });
    });
  });
});

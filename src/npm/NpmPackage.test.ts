import * as AWS from "aws-sdk";
import { NpmPackage } from "./NpmPackage";
import * as sinon from "sinon";
import * as zlib from "zlib";
import { S3 } from "aws-sdk";
import { S3Cache } from "./S3Cache";

describe("NpmPackage", () => {
  let npmPackage: any;

  beforeEach(() => {
    const getRegistryEntryFromNpmStub = sinon.stub();
    const s3ListStub = sinon.stub() as any;
    const s3GetObjectStub = sinon.stub() as any;
    const s3PutObjectStub = sinon.stub() as any;
    const cacheUriPrefix = "http://localhost";
    const npmPackageName = "lodash";
    npmPackage = new NpmPackage(cacheUriPrefix, npmPackageName);
    npmPackage.getRegistryEntryFromNpm = getRegistryEntryFromNpmStub;
    npmPackage.cache = {
      list: s3ListStub,
      get: s3GetObjectStub,
      put: s3PutObjectStub,
    } as S3Cache;
  });

  describe("getRegistryEntry", () => {
    test("returns an existing registry entry", async () => {
      // prepare stub
      const metadata = { foo: "bar" };
      npmPackage.cache.get.resolves(JSON.stringify(metadata));
      // get registry entry
      const registryEntry: string = await npmPackage.getRegistryEntry();
      expect(JSON.parse(registryEntry)).toStrictEqual(metadata);
    });

    test("returns and caches a new registry entry", async () => {
      // prepare stubs
      const expectedRegistryEntry = {
        versions: { "1.0": { dist: { tarball: "tarball" } } },
      };
      npmPackage.getRegistryEntryFromNpm.resolves(expectedRegistryEntry);
      npmPackage.cache.get.rejects();
      npmPackage.cache.put.resolves();
      // get registry entry
      const registryEntry: string = await npmPackage.getRegistryEntry();
      sinon.assert.calledWith(npmPackage.cache.get, "lodash");
      sinon.assert.calledWith(
        npmPackage.cache.put,
        npmPackage.npmPackageName,
        JSON.stringify(expectedRegistryEntry),
      );
      expect(JSON.parse(registryEntry)).toStrictEqual(expectedRegistryEntry);
    });
  });

  describe("update", () => {
    test("fails if there's no cached npm package", () => {
      npmPackage.cache.get.rejects();
      return expect(npmPackage.updateRegistryEntry()).rejects.toThrow();
    });

    test("cache is not updated if not stale", async () => {
      const modified = new Date().toISOString();
      npmPackage.cache.get.resolves(JSON.stringify({ modified }));
      npmPackage.getRegistryEntryFromNpm.resolves({ modified });
      await npmPackage.updateRegistryEntry();
      sinon.assert.notCalled(npmPackage.cache.put);
    });

    test("existing cache entries remain unchanged", async () => {
      npmPackage.cache.get.resolves(
        JSON.stringify({
          modified: new Date(0).toISOString(),
          versions: {
            "1.0": { dist: { key: "foo" } },
          },
        }),
      );
      npmPackage.getRegistryEntryFromNpm.resolves({
        modified: new Date(1).toISOString(),
        versions: {
          "1.0": { dist: { key: "bar" } },
        },
      });
      npmPackage.cache.put.resolves();
      await npmPackage.updateRegistryEntry();
      sinon.assert.calledOnce(npmPackage.cache.put);
      const args = npmPackage.cache.put.getCalls()[0].args;
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
      npmPackage.cache.get.resolves(
        JSON.stringify({
          modified: new Date(0).toISOString(),
          versions: {
            "1.0": { dist: {} },
          },
        }),
      );
      npmPackage.getRegistryEntryFromNpm.resolves({
        modified: new Date(1).toISOString(),
        versions: {
          "2.0": { dist: {} },
        },
      });
      npmPackage.cache.put.resolves();
      await npmPackage.updateRegistryEntry();
      const args = npmPackage.cache.put.getCalls()[0].args;
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

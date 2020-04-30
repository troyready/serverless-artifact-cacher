import { NpmPackage } from "./NpmPackage";
import * as sinon from "sinon";
import { S3Cache } from "./S3Cache";

describe("NpmPackage", () => {
  let npmPackage: NpmPackage;
  let getRegistryEntryFromNpmStub: sinon.SinonStub;
  let s3ListStub: sinon.SinonStub;
  let s3GetObjectStub: sinon.SinonStub;
  let s3PutObjectStub: sinon.SinonStub;

  beforeEach(() => {
    const cacheUriPrefix = "http://localhost";
    const npmPackageName = "lodash";
    getRegistryEntryFromNpmStub = sinon.stub();
    s3ListStub = sinon.stub();
    s3GetObjectStub = sinon.stub();
    s3PutObjectStub = sinon.stub();
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
      s3GetObjectStub.resolves(JSON.stringify(metadata));
      // get registry entry
      const registryEntry: string = await npmPackage.getRegistryEntry();
      expect(JSON.parse(registryEntry)).toStrictEqual(metadata);
    });

    test("returns and caches a new registry entry", async () => {
      // prepare stubs
      const expectedRegistryEntry = {
        versions: { "1.0": { dist: { tarball: "tarball" } } },
      };
      getRegistryEntryFromNpmStub.resolves(expectedRegistryEntry);
      s3GetObjectStub.rejects();
      s3PutObjectStub.resolves();
      // get registry entry
      const registryEntry: string = await npmPackage.getRegistryEntry();
      sinon.assert.calledWith(s3GetObjectStub, "lodash");
      sinon.assert.calledWith(
        s3PutObjectStub,
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
      s3GetObjectStub.rejects();
      s3PutObjectStub.resolves();
      const expectedRegistryEntry = {
        modified,
        versions: { "1.0": { dist: { tarball: "tarball" } } },
      };
      getRegistryEntryFromNpmStub.resolves(expectedRegistryEntry);
      await npmPackage.updateRegistryEntry();
      expect(s3PutObjectStub.getCalls().length).toBe(1);
    });

    test("cache is not updated if not stale", async () => {
      const modified = new Date().toISOString();
      s3GetObjectStub.resolves(JSON.stringify({ modified }));
      getRegistryEntryFromNpmStub.resolves({ modified });
      await npmPackage.updateRegistryEntry();
      sinon.assert.notCalled(s3PutObjectStub);
    });

    test("existing cache entries remain unchanged", async () => {
      s3GetObjectStub.resolves(
        JSON.stringify({
          modified: new Date(0).toISOString(),
          versions: {
            "1.0": { dist: { key: "foo" } },
          },
        }),
      );
      getRegistryEntryFromNpmStub.resolves({
        modified: new Date(1).toISOString(),
        versions: {
          "1.0": { dist: { key: "bar" } },
        },
      });
      s3PutObjectStub.resolves();
      await npmPackage.updateRegistryEntry();
      sinon.assert.calledOnce(s3PutObjectStub);
      const args = s3PutObjectStub.getCalls()[0].args;
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
      s3GetObjectStub.resolves(
        JSON.stringify({
          modified: new Date(0).toISOString(),
          versions: {
            "1.0": { dist: {} },
          },
        }),
      );
      getRegistryEntryFromNpmStub.resolves({
        modified: new Date(1).toISOString(),
        versions: {
          "2.0": { dist: {} },
        },
      });
      s3PutObjectStub.resolves();
      await npmPackage.updateRegistryEntry();
      const args = s3PutObjectStub.getCalls()[0].args;
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

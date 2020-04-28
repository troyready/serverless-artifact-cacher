import * as AWS from "aws-sdk";
import { handler, NpmPackage } from "./package";
import * as sinon from 'sinon';
import * as zlib from "zlib";

describe("Package handler", () => {

  test("returns existing registry entry", async () => {
    const cacheUriPrefix = 'http://localhost';
    const npmPackageName = 'lodash';
    const npmPackage: NpmPackage = new NpmPackage(cacheUriPrefix, npmPackageName);

    // prepare stub
    const metadata = { foo: 'bar' };
    const CompressedRegistryData = zlib.deflateSync(JSON.stringify(metadata));
    const response: any = { promise: () => Promise.resolve({ Item: { CompressedRegistryData } }) };
    const documentClient: any = sinon.stub();
    documentClient.get = sinon.stub(documentClient, 'get');
    documentClient.get.returns(response);
    npmPackage.documentClient = documentClient;

    // get registry entry    
    const registryEntry: string = await npmPackage.getRegistryEntry();
    expect(JSON.parse(registryEntry)).toStrictEqual(metadata);
  });

  test("returns and caches registry entry", async () => {
    const cacheUriPrefix = 'http://localhost';
    const npmPackageName = 'lodash';
    const npmPackage: NpmPackage = new NpmPackage(cacheUriPrefix, npmPackageName);


    // prepare stubs
    const getRegistryEntryFromNpmStub = sinon.stub();
    npmPackage.getRegistryEntryFromNpm = getRegistryEntryFromNpmStub;
    const expectedRegistryEntry = { versions: { "1.0": { dist: { tarball: "tarball" } } } };
    getRegistryEntryFromNpmStub.resolves(expectedRegistryEntry);

    const documentClient: any = sinon.stub();
    documentClient.get = sinon.stub();
    documentClient.get.returns({ promise: () => Promise.reject() });
    documentClient.put = sinon.stub();
    documentClient.put.returns({ promise: () => Promise.resolve() });
    npmPackage.documentClient = documentClient;
    npmPackage.tableName = "table"

    // get registry entry    
    const registryEntry: string = await npmPackage.getRegistryEntry();
    sinon.assert.calledWith(documentClient.get, {
      Key: { PackageName: "lodash" },
      TableName: "table"
    });
    sinon.assert.calledWith(documentClient.put, {
      TableName: "table",
      Item: {
        PackageName: npmPackageName,
        CompressedRegistryData: zlib.deflateSync(JSON.stringify(expectedRegistryEntry)),
      }
    });
    expect(JSON.parse(registryEntry)).toStrictEqual(expectedRegistryEntry);

  });

});

import * as AWS from "aws-sdk";
import { handler, NpmPackage } from "./package";
import * as sinon from 'sinon';

describe("Package handler", () => {

  test("returns existing registry entry", async () => {
    const cacheUriPrefix = 'http://localhost';
    const npmPackageName = 'lodash';
    const npmPackage: NpmPackage = new NpmPackage(cacheUriPrefix, npmPackageName);

    // prepare stub
    const metadata = { foo: 'bar' };
    sinon.stub(npmPackage.cache, 'get').resolves(JSON.stringify(metadata));

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
    const getStub = sinon.stub(npmPackage.cache, 'get');
    getStub.rejects();
    const putStub = sinon.stub(npmPackage.cache, 'put');
    putStub.resolves();

    // get registry entry    
    const registryEntry: string = await npmPackage.getRegistryEntry();
    sinon.assert.calledWith(getStub, 'lodash');
    sinon.assert.calledWith(putStub, npmPackageName, expectedRegistryEntry);
    expect(JSON.parse(registryEntry)).toStrictEqual(expectedRegistryEntry);

  });

});

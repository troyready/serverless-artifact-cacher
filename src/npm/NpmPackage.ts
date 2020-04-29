import * as request from "request-promise-native";
import { S3Cache } from './S3Cache';
import { version } from "punycode";

export class NpmPackage {

  cache: S3Cache = new S3Cache();

  constructor(
    cacheUriPrefix: string,
    public npmPackageName: string,
    public downloadUriPrefix: string = `${cacheUriPrefix}/${npmPackageName}`) {
  }

  getVersionUri(version: string): string {
    return `${this.downloadUriPrefix}/${version}`;
  }

  getRegistryEntryFromNpm(): Promise<any> {
    console.log(`Retrieving ${this.npmPackageName} registry entry from upstream.`);
    return request.get({
      uri: "https://registry.npmjs.org/" + this.npmPackageName,
      headers: { Accept: "application/vnd.npm.install-v1+json" },
    }).then(response => JSON.parse(response));
  }

  getRegistryEntryFromCache(): Promise<string> {
    return this.cache.get(this.npmPackageName);
  }

  cacheRegistryEntry(registryEntry): Promise<any> {
    const versions = registryEntry["versions"];
    Object.keys(versions).forEach((version) => {
      versions[version]["dist"]["tarball"] = this.getVersionUri(version);
    });
    return this.cache.put(this.npmPackageName, JSON.stringify(registryEntry));
  }

  /** 
   * Get or create DDB entry with map of files for package and return it
   *
   * Registry data is stored compressed in DDB for 2 reasons:
   * 1) Not all registry data maps cleanly to a DDB item (e.g. empty strings)
   * 2) Some items (e.g. @types/node) have too much data to store uncompressed
   */
  getRegistryEntry(): Promise<string> {
    return this.getRegistryEntryFromCache()
      .catch(error => this.getRegistryEntryFromNpm()
        .then(registryEntry => this.cacheRegistryEntry(registryEntry)
          .then(() => JSON.stringify(registryEntry)))
      )
  }

  async updateRegistryEntry(): Promise<any> {
    // Retrieve upstream registryData & DDB cached ddbData
    var [npmData, cachedData] = await Promise.all([
      this.getRegistryEntryFromNpm(),
      this.getRegistryEntryFromCache().then(str => JSON.parse(str)),
    ]);
    let npmUpdate: number = Date.parse(npmData["modified"]);
    const cacheUpdate: number = Date.parse(cachedData["modified"])
    if (cacheUpdate < npmUpdate) {
      console.log(`Package ${this.npmPackageName} has been modified upstream; updating its ddb entry`);
      const cachedVersions = new Set(Object.keys(cachedData["versions"]));
      Object.keys(npmData).forEach((value) => {
        if (value === "versions") {
          Object.keys(npmData["versions"]).forEach(versionNumber => {
            // Leave existing entries untouched.
            if (!cachedVersions.has(versionNumber)) {
              console.log(`Adding new version  ${versionNumber} to ${this.npmPackageName} entry.`);
              cachedData["versions"][versionNumber] = npmData["versions"][versionNumber];
            }
          });
        } else {
          cachedData[value] = npmData[value];
        }
      });
      await this.cacheRegistryEntry(cachedData);
    }
  }

}
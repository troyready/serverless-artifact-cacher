/**
 * registry util module
 *
 * @packageDocumentation
 */

import * as request from "request-promise-native";
import "source-map-support/register";

/** Get npm.js registry entry for package */
export let getRegistryEntryForPackage = async (
  packageName: string,
): Promise<any> => {
  console.log(`Retrieving ${packageName} registry entry from upstream.`);
  return JSON.parse(
    await request.get({
      uri: "https://registry.npmjs.org/" + packageName,
      headers: { Accept: "application/vnd.npm.install-v1+json" },
    }),
  );
};

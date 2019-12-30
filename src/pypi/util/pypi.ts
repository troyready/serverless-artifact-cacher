/**
 * pypi util module
 *
 * @packageDocumentation
 */

import * as cheerio from "cheerio";
import * as request from "request-promise-native";
import "source-map-support/register";

/** Get pypi files for package */
export let getPyPiFilesForPackage = async (
  packageName: string,
): Promise<any> => {
  var packageFiles: any = {};

  const upstreamList = await request.get({
    uri: "https://pypi.org/simple/" + packageName + "/",
  });
  var parsedupstreamList = cheerio.load(upstreamList);
  parsedupstreamList
    .root()
    .find("a")
    .each(function(_index, _element) {
      const fileName = parsedupstreamList(this).text();
      packageFiles[fileName] = {};

      if (parsedupstreamList(this).attr("data-requires-python")) {
        packageFiles[fileName]["data-requires-python"] = parsedupstreamList(
          this,
        ).attr("data-requires-python");
      }
      // console.log(parsedupstreamList(this).attr('href'));
      // // https://files.pythonhosted.org/packages/92/0a/bab0248a52a80a4cf109eb464303146a3d96df2fe34513b72c63ff5865f7/runway-1.3.3.tar.gz#sha256=bbcf06528298bf7b42d503ef7190bb54989e973d1f444ff581871cbbdefcb841

      // console.log(parsedupstreamList(this).text());
      // // runway-1.3.3.tar.gz
    });
  return packageFiles;
};
